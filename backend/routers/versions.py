import uuid
import copy
import logging
from collections import defaultdict
from datetime import datetime, timezone
from fastapi import APIRouter, Body, BackgroundTasks, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from database import get_db
from models.presentation import Presentation
from models.version import Version
from schemas.presentation import PresentationConfig
from schemas.version import VersionResponse, VersionSummary, PatchRequest, RegenRequest, RefineOutlineRequest
from schemas.domain import Slide as DomainSlide
from llm.calls import generate_outline, generate_slides, patch_slides, refine_outline, RegenRequiredError
from llm.client import LLMError
from resources.fetcher import fetch_all_topic_resources

router = APIRouter(prefix="/presentations", tags=["versions"])


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
                logging.error(f"Image fetch failed for slide '{slide.title}': {e}")
                slide.content["image_url"] = ""


def _format_resources_for_llm(resources_by_topic_orm: dict) -> dict:
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


def _bg_fetch_new_topics(presentation_id: str, version_id: str, new_topic_ids: list[str], outline: dict, topic: str, resource_filters: dict):
    from database import SessionLocal
    db = SessionLocal()
    try:
        for t in outline.get("topics", []):
            if t["id"] in new_topic_ids:
                from resources.fetcher import fetch_topic_resources
                fetch_topic_resources(presentation_id, version_id, t["id"], t["title"], topic, resource_filters, db)
    except Exception as e:
        import logging
        logging.error(f"Background new-topic resource fetch failed: {e}")
    finally:
        db.close()


@router.get("/{presentation_id}/versions", response_model=list[VersionSummary])
def list_versions(presentation_id: str, db: Session = Depends(get_db)):
    versions = (
        db.query(Version)
        .filter(Version.presentation_id == presentation_id)
        .order_by(Version.created_at.asc())
        .all()
    )
    return [
        {
            "id": v.id,
            "created_at": v.created_at.isoformat() if isinstance(v.created_at, datetime) else v.created_at,
            "source": v.source,
            "prompt_used": v.prompt_used,
            "confidence": v.confidence,
        }
        for v in versions
    ]


@router.post("/{presentation_id}/patch")
def patch_version(presentation_id: str, body: PatchRequest, db: Session = Depends(get_db)):
    pres = db.query(Presentation).filter(Presentation.id == presentation_id).first()
    if not pres:
        raise HTTPException(status_code=404, detail="Presentation not found")

    current = db.query(Version).filter(Version.id == pres.current_version_id).first()
    if not current:
        raise HTTPException(status_code=404, detail="Current version not found")

    config = PresentationConfig(**(current.config or {}))

    # Outline-level patch (empty target list) always requires full regeneration
    if not body.target_slide_ids:
        return JSONResponse(
            status_code=409,
            content={"error": "regen_required", "detail": "Outline-level changes require full regeneration"},
        )

    # Filter to only targeted slides
    targeted = [
        DomainSlide.model_validate(s)
        for s in current.slides
        if s["id"] in body.target_slide_ids
    ]
    if not targeted:
        raise HTTPException(status_code=400, detail="No matching slide ids in current version")

    try:
        patch_entries = patch_slides(targeted, body.prompt, config)
    except RegenRequiredError:
        return JSONResponse(
            status_code=409,
            content={
                "error": "regen_required",
                "detail": "This change requires full regeneration",
            },
        )
    except LLMError as e:
        return JSONResponse(
            status_code=500,
            content={"error": "generation_failed", "detail": str(e)},
        )

    # Apply patches to full slide list
    patch_map = {p.slide_id: p.fields for p in patch_entries}
    new_slides = copy.deepcopy(current.slides)
    for slide in new_slides:
        if slide["id"] in patch_map:
            slide.update(patch_map[slide["id"]])

    new_version = Version(
        id=str(uuid.uuid4()),
        presentation_id=presentation_id,
        parent_id=current.id,
        created_at=datetime.now(timezone.utc),
        source="ai_patch",
        prompt_used=body.prompt,
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


@router.post("/{presentation_id}/refine-outline")
def refine_outline_version(presentation_id: str, body: RefineOutlineRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    pres = db.query(Presentation).filter(Presentation.id == presentation_id).first()
    if not pres:
        raise HTTPException(status_code=404, detail="Presentation not found")

    current = db.query(Version).filter(Version.id == pres.current_version_id).first()
    if not current:
        raise HTTPException(status_code=404, detail="Current version not found")

    config = PresentationConfig(**(current.config or {}))

    try:
        new_outline = refine_outline(pres.topic, config, current.outline, body.prompt)
    except LLMError as e:
        return JSONResponse(
            status_code=500,
            content={"error": "generation_failed", "detail": str(e)},
        )

    new_version = Version(
        id=str(uuid.uuid4()),
        presentation_id=presentation_id,
        parent_id=current.id,
        created_at=datetime.now(timezone.utc),
        source="outline_refined",
        prompt_used=body.prompt,
        config=current.config,
        outline=new_outline.model_dump(),
        slides=copy.deepcopy(current.slides),
        confidence=copy.deepcopy(current.confidence),
    )
    db.add(new_version)
    db.flush()

    pres.current_version_id = new_version.id
    db.commit()
    db.refresh(new_version)

    old_ids = {t["id"] for t in current.outline.get("topics", [])}
    new_ids = [t.id for t in new_outline.topics if t.id not in old_ids]
    if new_ids:
        config_obj = PresentationConfig(**(current.config or {}))
        background_tasks.add_task(
            _bg_fetch_new_topics,
            presentation_id,
            new_version.id,
            new_ids,
            new_outline.model_dump(),
            pres.topic,
            config_obj.resource_filters.model_dump(),
        )

    return _version_to_response(new_version)


@router.post("/{presentation_id}/regen")
def regen_version(presentation_id: str, background_tasks: BackgroundTasks, body: RegenRequest = Body(default=RegenRequest()), db: Session = Depends(get_db)):
    pres = db.query(Presentation).filter(Presentation.id == presentation_id).first()
    if not pres:
        raise HTTPException(status_code=404, detail="Presentation not found")

    current = db.query(Version).filter(Version.id == pres.current_version_id).first()
    if not current:
        raise HTTPException(status_code=404, detail="Current version not found")

    config = PresentationConfig(**(current.config or {}))
    new_version_id = str(uuid.uuid4())

    try:
        outline = generate_outline(pres.topic, config)
    except LLMError as e:
        return JSONResponse(
            status_code=500,
            content={"error": "generation_failed", "detail": str(e)},
        )

    # Fetch resources before slide generation
    try:
        resources_by_topic_orm = fetch_all_topic_resources(
            presentation_id, new_version_id, outline.model_dump(), pres.topic,
            config.resource_filters.model_dump(), db,
        )
    except Exception as e:
        logging.error(f"Resource fetch failed during regen: {e}")
        resources_by_topic_orm = {}

    formatted_resources = _format_resources_for_llm(resources_by_topic_orm)

    try:
        slides = generate_slides(pres.topic, config, outline, resources_by_topic=formatted_resources)
    except LLMError as e:
        return JSONResponse(
            status_code=500,
            content={"error": "generation_failed", "detail": str(e)},
        )

    # Fill images for visual slides before committing
    _fill_visual_images(slides, outline.model_dump(), pres.topic, config.include_visuals)

    pos_gen = _position_sequence()
    for slide in slides:
        slide.position = next(pos_gen)

    topic_to_slides: dict[str, list[str]] = defaultdict(list)
    for slide in slides:
        topic_to_slides[slide.topic_id].append(slide.id)
    for topic in outline.topics:
        topic.slide_ids = topic_to_slides.get(topic.id, [])

    agg_score = (
        sum(s.confidence.score for s in slides) / len(slides) if slides else 0.0
    )

    new_version = Version(
        id=new_version_id,
        presentation_id=presentation_id,
        parent_id=current.id,
        created_at=datetime.now(timezone.utc),
        source="ai_regen",
        prompt_used=body.prompt,
        config=current.config,
        outline=outline.model_dump(),
        slides=[s.model_dump() for s in slides],
        confidence={"score": round(agg_score, 4), "flags": []},
    )
    db.add(new_version)
    db.flush()

    pres.current_version_id = new_version.id
    db.commit()
    db.refresh(new_version)

    return _version_to_response(new_version)
