from sqlalchemy import Column, String, Text, DateTime
from datetime import datetime
from app.database import Base

class JobRecord(Base):
    __tablename__ = "jobs"

    id = Column(String, primary_key=True, index=True)
    job_type = Column(String, index=True)
    payload_json = Column(Text)
    status = Column(String, default="pending", index=True) # pending, processing, done, failed
    result_json = Column(Text, nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)

    def to_dict(self):
        import json
        return {
            "id": self.id,
            "job_type": self.job_type,
            "payload": json.loads(self.payload_json) if self.payload_json else {},
            "status": self.status,
            "result": json.loads(self.result_json) if self.result_json else None,
            "error": self.error,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "finished_at": self.finished_at.isoformat() if self.finished_at else None,
        }
