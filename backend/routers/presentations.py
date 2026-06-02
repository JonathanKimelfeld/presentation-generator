import uuid
import copy
import logging
from collections import defaultdict
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from database import get_db
from models.presentation import Presentation
from models.version import Version
from schemas.presentation import PresentationCreate, PresentationConfig
from schemas.version import VersionResponse
from schemas.slide import SlidePatch
from llm.calls import generate_outline, generate_slides
from llm.client import LLMError
from resources.fetcher import fetch_all_topic_resources

router = APIRouter(prefix="/presentations", tags=["presentations"])


def _position_sequence():
    for a in "abcdefghijklmnopqrstuvwxyz":
        for b in "abcdefghijklmnopqrstuvwxyz":
            yield a + b


def _version_to_response(v: Version) -> dict:
    return {
        "id": v.id,
        "presentation_id": v.presentation_id,
        "parent_id": v.parent_id,
        "created_at": v.created_at.isoformat() if isinstance(v.created_at, datetime) else v.created_at,
        "source": v.source,
        "prompt_used": v.prompt_used,
        "config": v.config,
        "outline": v.outline,
        "slides": v.slides,
        "confidence": v.confidence,
    }


def _fill_visual_images(slides: list, outline_dict: dict, presentation_topic: str, include_visuals: bool) -> None:
    """Fill image_url for visual-layout slides by querying Wikipedia/Tavily."""
    if not include_visuals:
        return
    try:
        from images.fetcher import fetch_slide_image
    except ImportError:
        return
    topic_titles = {t["id"]: t["title"] for t in outline_dict.get("topics", [])}
    for slide in slides:
        if slide.layout == "visual":
            topic_title = topic_titles.get(slide.topic_id, presentation_topic)
            image_query = slide.content.get("image_query", "") or slide.title
            try:
                url = fetch_slide_image(image_query, topic_title, presentation_topic)
                slide.content["image_url"] = url or ""
            except Exception as e:
                logging.warning(f"Image fetch failed for slide '{slide.title}': {e}")
                slide.content["image_url"] = ""


def _format_resources_for_llm(resources_by_topic_orm: dict) -> dict:
    """Convert ORM resource objects to plain dicts indexed for LLM prompt."""
    formatted = {}
    for topic_id, resources in resources_by_topic_orm.items():
        if not resources:
            continue
        formatted[topic_id] = [
            {
                "index": i + 1,
                "title": r.title,
                "url": r.url,
                "source_type": r.source_type,
                "description": r.description or "",
            }
            for i, r in enumerate(resources[:8])
        ]
    return formatted


@router.post("")
def create_presentation(body: PresentationCreate, db: Session = Depends(get_db)):
    config = body.config or PresentationConfig()
    config_dict = config.model_dump()

    pres_id = str(uuid.uuid4())
    version_id = str(uuid.uuid4())

    try:
        outline = generate_outline(body.topic, config)
    except LLMError as e:
        return JSONResponse(
            status_code=500,
            content={"error": "generation_failed", "detail": str(e)},
        )

    # Fetch resources before slide generation so the LLM can reference them
    try:
        resources_by_topic_orm = fetch_all_topic_resources(
            pres_id, version_id, outline.model_dump(), body.topic,
            config.resource_filters.model_dump(), db,
        )
    except Exception as e:
        logging.error(f"Resource fetch failed during creation: {e}")
        resources_by_topic_orm = {}

    formatted_resources = _format_resources_for_llm(resources_by_topic_orm)

    try:
        slides = generate_slides(body.topic, config, outline, resources_by_topic=formatted_resources)
    except LLMError as e:
        return JSONResponse(
            status_code=500,
            content={"error": "generation_failed", "detail": str(e)},
        )

    # Fill images for visual slides before committing
    _fill_visual_images(slides, outline.model_dump(), body.topic, config.include_visuals)

    # Assign canonical positions
    pos_gen = _position_sequence()
    for slide in slides:
        slide.position = next(pos_gen)

    # Backfill slide_ids into outline topics
    topic_to_slides: dict[str, list[str]] = defaultdict(list)
    for slide in slides:
        topic_to_slides[slide.topic_id].append(slide.id)
    for topic in outline.topics:
        topic.slide_ids = topic_to_slides.get(topic.id, [])

    agg_score = (
        sum(s.confidence.score for s in slides) / len(slides) if slides else 0.0
    )

    pres = Presentation(
        id=pres_id,
        topic=body.topic,
        config=config_dict,
        created_at=datetime.now(timezone.utc),
    )
    db.add(pres)

    version = Version(
        id=version_id,
        presentation_id=pres_id,
        parent_id=None,
        created_at=datetime.now(timezone.utc),
        source="generated",
        prompt_used=None,
        config=config_dict,
        outline=outline.model_dump(),
        slides=[s.model_dump() for s in slides],
        confidence={"score": round(agg_score, 4), "flags": []},
    )
    db.add(version)
    db.flush()

    pres.current_version_id = version.id
    db.commit()
    db.refresh(version)

    return _version_to_response(version)


@router.get("/{presentation_id}/versions/{version_id}", response_model=VersionResponse)
def get_version(presentation_id: str, version_id: str, db: Session = Depends(get_db)):
    version = db.query(Version).filter(
        Version.id == version_id,
        Version.presentation_id == presentation_id,
    ).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    return _version_to_response(version)


@router.patch("/{presentation_id}/slides/{slide_id}", response_model=VersionResponse)
def patch_slide(presentation_id: str, slide_id: str, body: SlidePatch, db: Session = Depends(get_db)):
    pres = db.query(Presentation).filter(Presentation.id == presentation_id).first()
    if not pres:
        raise HTTPException(status_code=404, detail="Presentation not found")

    current = db.query(Version).filter(Version.id == pres.current_version_id).first()
    if not current:
        raise HTTPException(status_code=404, detail="Current version not found")

    new_slides = copy.deepcopy(current.slides)
    patched = False
    for slide in new_slides:
        if slide["id"] == slide_id:
            if body.content is not None:
                slide["content"] = body.content
            if body.position is not None:
                slide["position"] = body.position
            if body.speaker_notes is not None:
                slide["speaker_notes"] = body.speaker_notes
            patched = True
            break

    if not patched:
        raise HTTPException(status_code=404, detail="Slide not found in current version")

    new_version = Version(
        id=str(uuid.uuid4()),
        presentation_id=presentation_id,
        parent_id=current.id,
        created_at=datetime.now(timezone.utc),
        source="direct_edit",
        prompt_used=None,
        config=current.config,
        outline=copy.deepcopy(current.outline),
        slides=new_slides,
        confidence=copy.deepcopy(current.confidence),
    )
    db.add(new_version)
    db.flush()

    pres.current_version_id = new_version.id
    db.commit()
    db.refresh(new_version)

    return _version_to_response(new_version)
