from pydantic import BaseModel, Field
from typing import Optional, Literal


class ResourceFilter(BaseModel):
    videos: bool = True
    articles: bool = True
    papers: bool = True
    courses: bool = True


class PresentationConfig(BaseModel):
    audience: str = ""
    tone: str = "formal"
    depth: int = 3
    length: int = 20
    compactness: int = 3
    scope: str = ""
    style: str = "minimal"
    content_mode: Literal["verbose", "minimal"] = "verbose"
    include_visuals: bool = True
    resource_filters: ResourceFilter = Field(default_factory=ResourceFilter)
    resource_priority: list[str] = Field(default_factory=lambda: ["video", "paper", "course", "article"])


class PresentationCreate(BaseModel):
    topic: str
    config: Optional[PresentationConfig] = None


class PresentationResponse(BaseModel):
    id: str
    topic: str
    config: Optional[PresentationConfig]
    created_at: str
    current_version_id: Optional[str]

    class Config:
        from_attributes = True
