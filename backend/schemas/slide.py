from pydantic import BaseModel
from typing import Optional, Any


class SlidePatch(BaseModel):
    content: Optional[dict[str, Any]] = None
    position: Optional[str] = None
    speaker_notes: Optional[str] = None
