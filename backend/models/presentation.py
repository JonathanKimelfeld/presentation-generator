from sqlalchemy import Column, String, DateTime, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from database import Base


class Presentation(Base):
    __tablename__ = "presentations"

    id = Column(String, primary_key=True, index=True)
    topic = Column(String, nullable=False)
    config = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    current_version_id = Column(String, nullable=True)

    versions = relationship("Version", back_populates="presentation", foreign_keys="Version.presentation_id")
