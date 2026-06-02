import uuid
import logging
from datetime import datetime, timezone
from models.topic_resource import TopicResource
from resources.tavily_client import search_resources


def fetch_topic_resources(
    presentation_id: str,
    version_id: str,
    topic_id: str,
    topic_title: str,
    presentation_topic: str,
    resource_filters: dict,
    db,
) -> list:
    # Idempotent — skip if already fetched for this version+topic
    existing = db.query(TopicResource).filter(
        TopicResource.version_id == version_id,
        TopicResource.topic_id == topic_id,
    ).first()
    if existing:
        return (
            db.query(TopicResource)
            .filter(TopicResource.version_id == version_id, TopicResource.topic_id == topic_id)
            .order_by(TopicResource.priority)
            .all()
        )

    query = f"{presentation_topic} - {topic_title}"
    raw = search_resources(query, resource_filters, max_results=12)

    seen = set()
    unique = []
    for r in raw:
        if r["url"] not in seen:
            seen.add(r["url"])
            unique.append(r)

    unique.sort(key=lambda x: x["relevance_score"], reverse=True)
    top = unique[:8]

    saved = []
    for i, r in enumerate(top):
        resource = TopicResource(
            id=str(uuid.uuid4()),
            presentation_id=presentation_id,
            version_id=version_id,
            topic_id=topic_id,
            url=r["url"],
            title=r["title"],
            description=r["description"],
            source_type=r["source_type"],
            relevance_score=r["relevance_score"],
            priority=i,
            is_selected=True,
            created_at=datetime.now(timezone.utc),
        )
        db.add(resource)
        saved.append(resource)

    try:
        db.commit()
    except Exception as e:
        logging.error(f"Failed to save resources for topic {topic_id}: {e}")
        db.rollback()

    return saved


def fetch_all_topic_resources(
    presentation_id: str,
    version_id: str,
    outline: dict,
    presentation_topic: str,
    resource_filters: dict,
    db,
) -> dict:
    result = {}
    for topic in outline.get("topics", []):
        try:
            resources = fetch_topic_resources(
                presentation_id=presentation_id,
                version_id=version_id,
                topic_id=topic["id"],
                topic_title=topic["title"],
                presentation_topic=presentation_topic,
                resource_filters=resource_filters,
                db=db,
            )
            result[topic["id"]] = resources
        except Exception as e:
            logging.error(f"Resource fetch failed for topic {topic['id']}: {e}")
            result[topic["id"]] = []
    return result
