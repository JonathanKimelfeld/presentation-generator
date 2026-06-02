import json
import re

from llm.client import LLMError
from schemas.domain import Outline, Slide, PatchEntry


class LLMParseError(LLMError):
    def __init__(self, message: str, raw: str):
        super().__init__(message)
        self.raw = raw


class LLMValidationError(LLMError):
    def __init__(self, message: str, data: dict):
        super().__init__(message)
        self.data = data


def extract_json(raw: str) -> dict:
    text = raw.strip()
    # Strip markdown fences: ```json ... ``` or ``` ... ```
    text = re.sub(r"^```(?:json)?\s*\n?", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\n?```\s*$", "", text)
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise LLMParseError(f"JSON parse error: {e}", raw)


def validate_outline(data: dict) -> Outline:
    try:
        return Outline.model_validate(data)
    except Exception as e:
        raise LLMValidationError(f"Outline validation failed: {e}", data)


def validate_slides(data: dict) -> list[Slide]:
    try:
        return [Slide.model_validate(s) for s in data.get("slides", [])]
    except Exception as e:
        raise LLMValidationError(f"Slides validation failed: {e}", data)


def validate_patch(data: dict) -> list[PatchEntry]:
    try:
        return [PatchEntry.model_validate(p) for p in data.get("patches", [])]
    except Exception as e:
        raise LLMValidationError(f"Patch validation failed: {e}", data)
