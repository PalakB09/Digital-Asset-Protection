from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import uuid4

from app.database import get_db
from app.models.telegram import MonitoredChannel
from pydantic import BaseModel

router = APIRouter(prefix="/telegram", tags=["Telegram"])

class AddChannelRequest(BaseModel):
    channel_username: str

@router.get("/channels")
def list_monitored_channels(db: Session = Depends(get_db)):
    """List all monitored Telegram channels."""
    channels = db.query(MonitoredChannel).all()
    return channels

@router.post("/channels")
def add_monitored_channel(req: AddChannelRequest, db: Session = Depends(get_db)):
    """Manually add a Telegram channel to monitor."""
    uname = req.channel_username.replace("@", "").lower().strip()
    if not uname:
        raise HTTPException(400, "Invalid username")
        
    existing = db.query(MonitoredChannel).filter(MonitoredChannel.channel_username == uname).first()
    if existing:
        raise HTTPException(400, "Channel already monitored")
        
    mc = MonitoredChannel(
        id=str(uuid4()),
        channel_username=uname,
        added_via_keyword="manual_ui",
        is_active=True
    )
    db.add(mc)
    db.commit()
    db.refresh(mc)
    return mc

@router.put("/channels/{channel_id}/toggle")
def toggle_channel(channel_id: str, db: Session = Depends(get_db)):
    """Toggle monitoring status of a channel."""
    mc = db.query(MonitoredChannel).filter(MonitoredChannel.id == channel_id).first()
    if not mc:
        raise HTTPException(404, "Channel not found")
        
    mc.is_active = not mc.is_active
    db.commit()
    db.refresh(mc)
    return mc
