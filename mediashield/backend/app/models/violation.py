from datetime import datetime
from uuid import uuid4
from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey, Boolean, Text
from app.database import Base


class Violation(Base):
    __tablename__ = "violations"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    phash_distance = Column(Integer, nullable=True)
    clip_similarity = Column(Float, nullable=True)
    confidence_score = Column(Float, nullable=True)
    asset_id = Column(String, ForeignKey("assets.id"), nullable=False)
    source_url = Column(String, default="upload")
    platform = Column(String, default="unknown")
    confidence = Column(Float, nullable=False)
    match_tier = Column(String, nullable=False)  # HIGH or MEDIUM
    match_type = Column(String, nullable=False)   # phash or clip
    image_path = Column(String, nullable=False)
    watermark_verified = Column(Boolean, default=False)
    attribution = Column(String, nullable=True)
    processing_status = Column(String, default="done")  # pending, processing, done, failed
    detection_stage_results = Column(Text, nullable=True)  # JSON string
    created_at = Column(DateTime, default=datetime.utcnow)
    leaked_by = Column(String, nullable=True)

    # Insights & AI columns
    views = Column(Integer, default=0)
    likes = Column(Integer, default=0)
    threat_score = Column(Float, default=0.0)
    ssim_score = Column(Float, nullable=True)     # for Alteration Analysis
    scraped_text = Column(Text, nullable=True)     # for Gemini NLP

    def to_dict(self):
        return {
            "id": self.id,
            "asset_id": self.asset_id,
            "source_url": self.source_url,
            "platform": self.platform,
            "confidence": self.confidence,
            "match_tier": self.match_tier,
            "match_type": self.match_type,
            "image_path": self.image_path,
            "watermark_verified": self.watermark_verified,
            "attribution": self.attribution,
            "processing_status": self.processing_status,
            "detection_stage_results": self.detection_stage_results,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "leaked_by": self.leaked_by,
            "views": self.views,
            "likes": self.likes,
            "threat_score": self.threat_score,
            "ssim_score": self.ssim_score,
            "scraped_text": self.scraped_text,
        }


class PropagationEdge(Base):
    __tablename__ = "propagation_edges"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    source_asset_id = Column(String, ForeignKey("assets.id"), nullable=False)
    violation_id = Column(String, ForeignKey("violations.id"), nullable=False)
    platform = Column(String, default="unknown")
    discovered_at = Column(DateTime, default=datetime.utcnow)
    leaked_by = Column(String, nullable=True)
    watermark_id = Column(String, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "source_asset_id": self.source_asset_id,
            "violation_id": self.violation_id,
            "platform": self.platform,
            "discovered_at": self.discovered_at.isoformat() if self.discovered_at else None,
            "leaked_by": self.leaked_by,
            "watermark_id": self.watermark_id,
        }
