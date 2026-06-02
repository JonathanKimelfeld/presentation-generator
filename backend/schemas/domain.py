from __future__ import annotations
from typing import Any
from pydantic import BaseModel


class ConfidenceFlag(BaseModel):
    type: str
    detail: str
    affected_slide_ids: list[str] = []


class Confidence(BaseModel):
    score: float
    flags: list[ConfidenceFlag] = []


class OutlineTopic(BaseModel):
    id: str
    title: str
    weight: int
    slide_count: int
    estimated_minutes: int
    rationale: str
    slide_ids: list[str] = []
    confidence: Confidence


class Outline(BaseModel):
    topics: list[OutlineTopic]


class Slide(BaseModel):
    id: str
    topic_id: str
    position: str
    title: str
    layout: str
    content: dict[str, Any]
    speaker_notes: str
    estimated_minutes: int
    confidence: Confidence


class PatchEntry(BaseModel):
    slide_id: str
    fields: dict[str, Any]
