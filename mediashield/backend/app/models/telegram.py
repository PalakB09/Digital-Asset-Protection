from sqlalchemy import Column, String, Boolean, DateTime
import datetime
from sqlalchemy.orm import declarative_base

# Use the same base as other models
from app.database import Base

class MonitoredChannel(Base):
    __tablename__ = "monitored_channels"

    id = Column(String, primary_key=True, index=True)
    channel_username = Column(String, unique=True, index=True)
    added_via_keyword = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    last_checked_at = Column(DateTime, default=datetime.datetime.utcnow)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
