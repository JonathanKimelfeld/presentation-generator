from sqlalchemy import Column, String, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from database import Base


class Version(Base):
    __tablename__ = "versions"

    id = Column(String, primary_key=True, index=True)
    presentation_id = Column(String, ForeignKey("presentations.id"), nullable=False)
    parent_id = Column(String, ForeignKey("versions.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    source = Column(String, nullable=False)
    prompt_used = Column(String, nullable=True)
    outline = Column(JSON, nullable=False)
    slides = Column(JSON, nullable=False)
    config = Column(JSON, nullable=True)
    confidence = Column(JSON, nullable=False)

    presentation = relationship("Presentation", back_populates="versions", foreign_keys=[presentation_id])
