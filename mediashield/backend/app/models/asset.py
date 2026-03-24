from datetime import datetime
from uuid import uuid4
from sqlalchemy import Column, String, DateTime
from app.database import Base


class Asset(Base):
    __tablename__ = "assets"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    name = Column(String, nullable=False)
    original_path = Column(String, nullable=False)
    phash = Column(String, index=True, nullable=False)
    embedding_id = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "original_path": self.original_path,
            "phash": self.phash,
            "embedding_id": self.embedding_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
