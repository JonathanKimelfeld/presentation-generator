from fastapi import APIRouter
from images.fetcher import fetch_slide_image

router = APIRouter(prefix="/presentations", tags=["images"])

_image_cache: dict[str, str | None] = {}


@router.get("/{presentation_id}/slides/{slide_id}/image")
def get_slide_image(
    presentation_id: str,
    slide_id: str,
    slide_title: str = "",
    topic: str = "",
    presentation_topic: str = "",
):
    cache_key = f"{slide_id}:{slide_title}:{topic}"
    if cache_key in _image_cache:
        return {"url": _image_cache[cache_key]}
    url = fetch_slide_image(slide_title or topic, topic, presentation_topic)
    _image_cache[cache_key] = url
    return {"url": url}
