from sqlalchemy import Column, String, DateTime, Float, Integer, Boolean, ForeignKey
from datetime import datetime, timezone
from database import Base

class TopicResource(Base):
    __tablename__ = "topic_resources"
    id = Column(String, primary_key=True, index=True)
    presentation_id = Column(String, ForeignKey("presentations.id"), nullable=False)
    version_id = Column(String, ForeignKey("versions.id"), nullable=False)
    topic_id = Column(String, nullable=False)
    url = Column(String, nullable=False)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    source_type = Column(String, nullable=False)  # video|article|paper|course
    relevance_score = Column(Float, default=0.5)
    priority = Column(Integer, default=0)
    is_selected = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
