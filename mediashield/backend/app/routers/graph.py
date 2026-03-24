"""
Graph router — serve propagation graph data for D3.js visualization.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.graph_service import get_propagation_graph, get_all_assets_with_violations

router = APIRouter(prefix="/graph", tags=["Graph"])


@router.get("")
async def list_graph_assets(db: Session = Depends(get_db)):
    """List all assets with their violation counts (for graph overview)."""
    return get_all_assets_with_violations(db)


@router.get("/{asset_id}")
async def get_graph(asset_id: str, db: Session = Depends(get_db)):
    """
    Get propagation graph data for a specific asset.
    Returns D3.js-compatible nodes + links JSON.
    """
    graph = get_propagation_graph(asset_id, db)
    if not graph["nodes"]:
        raise HTTPException(status_code=404, detail="Asset not found")
    return graph
