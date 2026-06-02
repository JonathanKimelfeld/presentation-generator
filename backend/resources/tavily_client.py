import os
import logging
from urllib.parse import urlparse

TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")

PAPER_DOMAINS = [
    "scholar.google.com", "arxiv.org", "researchgate.net", "jstor.org",
    "pubmed.ncbi.nlm.nih.gov", "acm.org", "ieee.org", "springer.com", "nature.com",
]
COURSE_DOMAINS = [
    "coursera.org", "edx.org", "khanacademy.org", "udemy.com",
    "mit.edu", "ocw.mit.edu", "brilliant.org",
]
VIDEO_DOMAINS = ["youtube.com"]
WIKI_DOMAINS = ["wikipedia.org", "wikimedia.org", "wikidata.org"]


def detect_source_type(url: str) -> str:
    domain = urlparse(url).netloc.lower().replace("www.", "")
    if "youtube.com" in domain:
        return "video"
    if any(d in domain for d in ["arxiv.org", "scholar.google", "researchgate.net",
                                   "jstor.org", "pubmed.ncbi", "acm.org", "ieee.org",
                                   "springer.com", "nature.com"]):
        return "paper"
    if any(d in domain for d in ["coursera.org", "edx.org", "khanacademy.org",
                                   "udemy.com", "mit.edu", "brilliant.org"]):
        return "course"
    return "article"


def search_resources(query: str, resource_filters: dict, max_results: int = 8) -> list[dict]:
    if not TAVILY_API_KEY or TAVILY_API_KEY == "tvly-YOUR_KEY_HERE":
        logging.warning("TAVILY_API_KEY not configured — skipping resource search")
        return []

    try:
        from tavily import TavilyClient
        client = TavilyClient(api_key=TAVILY_API_KEY)
    except Exception as e:
        logging.error(f"Tavily client init failed: {e}")
        return []

    base_query = f"{query} explained"

    # Only restrict domains when articles are disabled
    include_domains = []
    articles_enabled = resource_filters.get("articles", True)
    if not articles_enabled:
        if resource_filters.get("papers", True):
            include_domains.extend(PAPER_DOMAINS)
        if resource_filters.get("courses", True):
            include_domains.extend(COURSE_DOMAINS)
        if resource_filters.get("videos", True):
            include_domains.extend(VIDEO_DOMAINS)

    kwargs = {
        "query": base_query,
        "search_depth": "advanced",
        "max_results": max_results,
        "exclude_domains": WIKI_DOMAINS,
    }
    if include_domains:
        kwargs["include_domains"] = include_domains

    try:
        response = client.search(**kwargs)
    except Exception as e:
        logging.error(f"Tavily search failed for '{base_query}': {e}")
        return []

    resources = []
    for r in response.get("results", []):
        url = r.get("url", "")
        if not url:
            continue
        source_type = detect_source_type(url)

        if source_type == "video" and not resource_filters.get("videos", True):
            continue
        if source_type == "paper" and not resource_filters.get("papers", True):
            continue
        if source_type == "course" and not resource_filters.get("courses", True):
            continue
        if source_type == "article" and not resource_filters.get("articles", True):
            continue

        resources.append({
            "url": url,
            "title": r.get("title", "Untitled"),
            "description": (r.get("content") or "")[:300],
            "source_type": source_type,
            "relevance_score": float(r.get("score", 0.5)),
        })

    return resources
