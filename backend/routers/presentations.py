import uuid
import copy
from collections import defaultdict
from datetime import datetime, timezone
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
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


def _bg_fetch_resources(presentation_id: str, version_id: str, outline: dict, topic: str, resource_filters: dict):
    from database import SessionLocal
    db = SessionLocal()
    try:
        fetch_all_topic_resources(presentation_id, version_id, outline, topic, resource_filters, db)
    except Exception as e:
        import logging
        logging.error(f"Background resource fetch failed: {e}")
    finally:
        db.close()


@router.post("")
def create_presentation(body: PresentationCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    config = body.config or PresentationConfig()
    config_dict = config.model_dump()

    try:
        outline = generate_outline(body.topic, config)
        slides = generate_slides(body.topic, config, outline)
    except LLMError as e:
        return JSONResponse(
            status_code=500,
            content={"error": "generation_failed", "detail": str(e)},
        )

    # Assign canonical positions (overrides whatever the LLM chose)
    pos_gen = _position_sequence()
    for slide in slides:
        slide.position = next(pos_gen)

    # Backfill slide_ids into outline topics
    topic_to_slides: dict[str, list[str]] = defaultdict(list)
    for slide in slides:
        topic_to_slides[slide.topic_id].append(slide.id)
    for topic in outline.topics:
        topic.slide_ids = topic_to_slides.get(topic.id, [])

    # Aggregate confidence = mean of slide scores
    agg_score = (
        sum(s.confidence.score for s in slides) / len(slides) if slides else 0.0
    )

    pres_id = str(uuid.uuid4())
    pres = Presentation(
        id=pres_id,
        topic=body.topic,
        config=config_dict,
        created_at=datetime.now(timezone.utc),
    )
    db.add(pres)

    version = Version(
        id=str(uuid.uuid4()),
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

    background_tasks.add_task(
        _bg_fetch_resources,
        pres_id,
        version.id,
        outline.model_dump(),
        body.topic,
        config.resource_filters.model_dump(),
    )

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
