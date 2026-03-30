from datetime import datetime
from uuid import uuid4
from sqlalchemy import Column, String, DateTime, Integer
from app.database import Base


class Asset(Base):
    __tablename__ = "assets"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    name = Column(String, nullable=False)
    original_path = Column(String, nullable=False)
    phash = Column(String, index=True, nullable=False)
    embedding_id = Column(String, nullable=False)
    watermark_key = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    asset_type = Column(String, nullable=True, default="image")   # "image" or "video"
    frame_count = Column(Integer, nullable=True)                   # only for videos

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "original_path": self.original_path,
            "phash": self.phash,
            "embedding_id": self.embedding_id,
            "watermark_key": self.watermark_key,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "asset_type": self.asset_type,
            "frame_count": self.frame_count,
        }
