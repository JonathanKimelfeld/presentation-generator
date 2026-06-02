from schemas.presentation import PresentationConfig
from schemas.domain import Outline, Slide, PatchEntry
from llm.client import call_llm, LLMError
from llm.parser import (
    extract_json,
    validate_outline,
    validate_slides,
    validate_patch,
    LLMParseError,
    LLMValidationError,
)
from llm.prompts import outline_prompt, slides_prompt, patch_prompt, refine_outline_prompt

_RETRY_SUFFIX = (
    "\n\nYour previous response could not be parsed. "
    "Return only valid JSON matching the exact schema. "
    "No prose, no markdown."
)


class RegenRequiredError(LLMError):
    pass


def _call_with_retry(system: str, user: str, parse_fn, max_tokens: int = 4000):
    try:
        raw = call_llm(system, user, max_tokens)
        data = extract_json(raw)
        return parse_fn(data)
    except (LLMParseError, LLMValidationError):
        raw = call_llm(system, user + _RETRY_SUFFIX, max_tokens)
        data = extract_json(raw)
        return parse_fn(data)


def generate_outline(topic: str, config: PresentationConfig) -> Outline:
    system, user = outline_prompt(topic, config)
    return _call_with_retry(system, user, validate_outline)


def generate_slides(topic: str, config: PresentationConfig, outline: Outline, resources_by_topic: dict | None = None) -> list[Slide]:
    system, user = slides_prompt(topic, config, outline, resources_by_topic=resources_by_topic)
    return _call_with_retry(system, user, validate_slides, max_tokens=16000)


def refine_outline(topic: str, config: PresentationConfig, current_outline: dict, user_note: str) -> Outline:
    system, user = refine_outline_prompt(topic, config, current_outline, user_note)
    return _call_with_retry(system, user, validate_outline)


def patch_slides(slides: list[Slide], user_note: str, config: PresentationConfig) -> list[PatchEntry]:
    system, user = patch_prompt(slides, user_note, config)

    def _parse(data: dict) -> list[PatchEntry]:
        if data.get("requires_regen"):
            raise RegenRequiredError("LLM indicated this change requires full regeneration")
        return validate_patch(data)

    return _call_with_retry(system, user, _parse)
