import time
from schemas.presentation import PresentationConfig
from schemas.domain import Outline, Slide, PatchEntry
from llm.client import call_llm, LLMError
from llm.parser import (
    extract_json,
    validate_outline,
    validate_slides,
    validate_patch,
    validate_normalization_result,
    validate_validation_result,
    LLMParseError,
    LLMValidationError,
)
from llm.prompts import outline_prompt, slides_prompt, patch_prompt, refine_outline_prompt, normalize_prompt, validation_prompt
from logger import get_logger

logger = get_logger("llm")

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
    except (LLMParseError, LLMValidationError) as e:
        logger.warning(f"LLM parse error, retrying: {e}")
        raw = call_llm(system, user + _RETRY_SUFFIX, max_tokens)
        data = extract_json(raw)
        return parse_fn(data)


def generate_outline(topic: str, config: PresentationConfig) -> Outline:
    logger.info(f"generate_outline starting: topic='{topic[:50]}'")
    t0 = time.monotonic()
    system, user = outline_prompt(topic, config)
    result = _call_with_retry(system, user, validate_outline)
    logger.info(f"generate_outline complete: {time.monotonic() - t0:.2f}s")
    return result


def generate_slides(topic: str, config: PresentationConfig, outline: Outline, resources_by_topic: dict | None = None) -> list[Slide]:
    logger.info(f"generate_slides starting: topic='{topic[:50]}' topics={len(outline.topics)}")
    t0 = time.monotonic()
    system, user = slides_prompt(topic, config, outline, resources_by_topic=resources_by_topic)
    result = _call_with_retry(system, user, validate_slides, max_tokens=16000)
    logger.info(f"generate_slides complete: {time.monotonic() - t0:.2f}s slides={len(result)}")
    return result


def refine_outline(topic: str, config: PresentationConfig, current_outline: dict, user_note: str) -> Outline:
    logger.info(f"refine_outline starting: topic='{topic[:50]}'")
    t0 = time.monotonic()
    system, user = refine_outline_prompt(topic, config, current_outline, user_note)
    result = _call_with_retry(system, user, validate_outline)
    logger.info(f"refine_outline complete: {time.monotonic() - t0:.2f}s")
    return result


def patch_slides(slides: list[Slide], user_note: str, config: PresentationConfig) -> list[PatchEntry]:
    logger.info(f"patch_slides starting: slides={len(slides)}")
    t0 = time.monotonic()
    system, user = patch_prompt(slides, user_note, config)

    def _parse(data: dict) -> list[PatchEntry]:
        if data.get("requires_regen"):
            raise RegenRequiredError("LLM indicated this change requires full regeneration")
        return validate_patch(data)

    result = _call_with_retry(system, user, _parse)
    logger.info(f"patch_slides complete: {time.monotonic() - t0:.2f}s patches={len(result)}")
    return result


def normalize_topic(topic: str) -> dict:
    logger = logging.getLogger(__name__)
    logger.info("LLM call starting [normalize]")
    import time
    t0 = time.monotonic()
    system, user = normalize_prompt(topic)
    result = _call_with_retry(system, user, validate_normalization_result, max_tokens=200)
    logger.info(f"LLM call complete [normalize] duration={time.monotonic() - t0:.1f}s")
    return result


def validate_intent(
    user_prompt: str,
    presentation_topic: str,
    slide_context: list[dict],
    mode: str,
    config: dict,
    context: str = "unknown",
) -> dict:
    logger = logging.getLogger(__name__)

    logger.info(
        f"Validating intent [{context}]: "
        f"prompt='{user_prompt[:60]}' "
        f"mode={mode}"
    )

    system, user = validation_prompt(
        user_prompt, presentation_topic, slide_context, mode, config
    )
    result = _call_with_retry(system, user, validate_validation_result, max_tokens=1024)

    logger.info(
        f"Validation result [{context}]: "
        f"action={result['action']} "
        f"confidence={result['confidence']}"
    )

    if result["action"] == "reject":
        logger.warning(
            f"Intent rejected [{context}]: "
            f"reason='{result['reason']}'"
        )

    return result
