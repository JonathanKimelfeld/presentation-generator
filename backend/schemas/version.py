from pydantic import BaseModel
from typing import Optional, Any
from schemas.presentation import PresentationConfig


class VersionResponse(BaseModel):
    id: str
    presentation_id: str
    parent_id: Optional[str]
    created_at: str
    source: str
    prompt_used: Optional[str]
    config: Optional[PresentationConfig]
    outline: dict[str, Any]
    slides: list[dict[str, Any]]
    confidence: dict[str, Any]

    class Config:
        from_attributes = True


class VersionSummary(BaseModel):
    id: str
    created_at: str
    source: str
    prompt_used: Optional[str]
    confidence: dict[str, Any]

    class Config:
        from_attributes = True


class PatchRequest(BaseModel):
    prompt: str
    target_slide_ids: list[str]


class RegenRequest(BaseModel):
    prompt: Optional[str] = None


class RefineOutlineRequest(BaseModel):
    prompt: str
