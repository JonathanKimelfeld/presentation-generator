import logging
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models.topic_resource import TopicResource
from models.presentation import Presentation
from models.version import Version
from schemas.presentation import PresentationConfig
from resources.fetcher import fetch_topic_resources, fetch_all_topic_resources

router = APIRouter(prefix="/presentations", tags=["resources"])


def _to_dict(r: TopicResource) -> dict:
    return {
        "id": r.id,
        "presentation_id": r.presentation_id,
        "version_id": r.version_id,
        "topic_id": r.topic_id,
        "url": r.url,
        "title": r.title,
        "description": r.description,
        "source_type": r.source_type,
        "relevance_score": r.relevance_score,
        "priority": r.priority,
        "is_selected": r.is_selected,
        "created_at": r.created_at.isoformat() if isinstance(r.created_at, datetime) else r.created_at,
    }


@router.get("/{presentation_id}/resources")
def get_resources(presentation_id: str, version_id: str, db: Session = Depends(get_db)):
    rows = (
        db.query(TopicResource)
        .filter(
            TopicResource.presentation_id == presentation_id,
            TopicResource.version_id == version_id,
        )
        .order_by(TopicResource.topic_id, TopicResource.priority)
        .all()
    )
    grouped: dict = {}
    for r in rows:
        grouped.setdefault(r.topic_id, []).append(_to_dict(r))
    return grouped


class ResourceFetchRequest(BaseModel):
    version_id: str
    topic_id: Optional[str] = None


@router.post("/{presentation_id}/resources/fetch")
def fetch_resources(presentation_id: str, body: ResourceFetchRequest, db: Session = Depends(get_db)):
    pres = db.query(Presentation).filter(Presentation.id == presentation_id).first()
    if not pres:
        raise HTTPException(status_code=404, detail="Presentation not found")

    version = db.query(Version).filter(Version.id == body.version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    config = PresentationConfig(**(version.config or {}))
    filters = config.resource_filters.model_dump()

    outline = version.outline
    grouped: dict = {}

    if body.topic_id:
        topic = next((t for t in outline.get("topics", []) if t["id"] == body.topic_id), None)
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found in version")
        resources = fetch_topic_resources(
            presentation_id=presentation_id,
            version_id=body.version_id,
            topic_id=topic["id"],
            topic_title=topic["title"],
            presentation_topic=pres.topic,
            resource_filters=filters,
            db=db,
        )
        grouped[body.topic_id] = [_to_dict(r) for r in resources]
    else:
        result = fetch_all_topic_resources(
            presentation_id=presentation_id,
            version_id=body.version_id,
            outline=outline,
            presentation_topic=pres.topic,
            resource_filters=filters,
            db=db,
        )
        for tid, resources in result.items():
            grouped[tid] = [_to_dict(r) for r in resources]

    return grouped


class ResourcePatch(BaseModel):
    is_selected: Optional[bool] = None
    priority: Optional[int] = None


@router.patch("/{presentation_id}/resources/{resource_id}")
def update_resource(
    presentation_id: str, resource_id: str, body: ResourcePatch, db: Session = Depends(get_db)
):
    r = db.query(TopicResource).filter(
        TopicResource.id == resource_id,
        TopicResource.presentation_id == presentation_id,
    ).first()
    if not r:
        raise HTTPException(status_code=404, detail="Resource not found")

    if body.is_selected is not None:
        r.is_selected = body.is_selected
    if body.priority is not None:
        r.priority = body.priority

    db.commit()
    db.refresh(r)
    return _to_dict(r)


@router.delete("/{presentation_id}/resources/{resource_id}")
def delete_resource(presentation_id: str, resource_id: str, db: Session = Depends(get_db)):
    r = db.query(TopicResource).filter(
        TopicResource.id == resource_id,
        TopicResource.presentation_id == presentation_id,
    ).first()
    if not r:
        raise HTTPException(status_code=404, detail="Resource not found")
    db.delete(r)
    db.commit()
    return {"deleted": True}
