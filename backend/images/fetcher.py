import os
import logging
import requests

TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")


def fetch_wikipedia_image(query: str) -> str | None:
    """Search Wikipedia and return the lead thumbnail for the most relevant article."""
    try:
        api = "https://en.wikipedia.org/w/api.php"
        search = requests.get(api, params={
            "action": "query",
            "list": "search",
            "srsearch": query,
            "srlimit": 3,
            "format": "json",
            "utf8": 1,
        }, timeout=6)
        results = search.json().get("query", {}).get("search", [])
        for result in results:
            title = result.get("title", "")
            if not title:
                continue
            img_resp = requests.get(api, params={
                "action": "query",
                "titles": title,
                "prop": "pageimages",
                "pithumbsize": 800,
                "format": "json",
            }, timeout=6)
            pages = img_resp.json().get("query", {}).get("pages", {})
            for page in pages.values():
                thumb = page.get("thumbnail", {})
                if thumb and thumb.get("source"):
                    return thumb["source"]
    except Exception as e:
        logging.warning(f"Wikipedia image fetch failed for '{query}': {e}")
    return None


def fetch_tavily_image(query: str) -> str | None:
    """Use Tavily with include_images=True to find a relevant image URL."""
    if not TAVILY_API_KEY or TAVILY_API_KEY == "tvly-YOUR_KEY_HERE":
        return None
    try:
        from tavily import TavilyClient
        client = TavilyClient(api_key=TAVILY_API_KEY)
        response = client.search(
            query=query,
            search_depth="basic",
            max_results=3,
            include_images=True,
        )
        for img in response.get("images", []):
            url = img if isinstance(img, str) else (img.get("url") if isinstance(img, dict) else None)
            if url and url.startswith("http"):
                return url
    except Exception as e:
        logging.warning(f"Tavily image fetch failed for '{query}': {e}")
    return None


def fetch_slide_image(image_query: str, topic_title: str, presentation_topic: str) -> str | None:
    """Fetch an image — Wikipedia first, Tavily fallback."""
    queries = [image_query, f"{topic_title} {presentation_topic}", presentation_topic]
    for q in queries:
        url = fetch_wikipedia_image(q)
        if url:
            return url
    for q in queries[:2]:
        url = fetch_tavily_image(q)
        if url:
            return url
    return None
