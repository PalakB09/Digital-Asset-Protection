"""
Graph service — builds propagation graph data from SQLite for D3.js visualization.
"""

from sqlalchemy.orm import Session
from app.models.asset import Asset
from app.models.violation import Violation, PropagationEdge


def get_propagation_graph(asset_id: str, db: Session) -> dict:
    """
    Build a D3.js-compatible force-directed graph for a given asset.
    
    Returns:
    {
        "nodes": [
            {"id": "...", "label": "...", "type": "original"|"violation", "platform": "..."},
            ...
        ],
        "links": [
            {"source": "...", "target": "...", "confidence": 0.95, "discovered_at": "..."},
            ...
        ]
    }
    """
    # Get the original asset
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        return {"nodes": [], "links": []}

    nodes = []
    links = []

    # Root node: the original asset
    nodes.append({
        "id": asset.id,
        "label": asset.name,
        "type": "original",
        "platform": "registered",
        "created_at": asset.created_at.isoformat() if asset.created_at else None,
    })

    # Get all propagation edges for this asset
    edges = db.query(PropagationEdge).filter(
        PropagationEdge.source_asset_id == asset_id
    ).all()

    for edge in edges:
        # Get the violation details
        violation = db.query(Violation).filter(
            Violation.id == edge.violation_id
        ).first()

        if violation:
            # Add violation as a node
            nodes.append({
                "id": violation.id,
                "label": f"{violation.platform} - {violation.match_type}",
                "type": "violation",
                "platform": violation.platform,
                "confidence": violation.confidence,
                "match_tier": violation.match_tier,
                "match_type": violation.match_type,
                "source_url": violation.source_url,
                "created_at": violation.created_at.isoformat() if violation.created_at else None,
                "leaked_by": violation.leaked_by,
            })

            # Add edge (link)
            links.append({
                "source": asset.id,
                "target": violation.id,
                "confidence": violation.confidence,
                "match_type": violation.match_type,
                "discovered_at": edge.discovered_at.isoformat() if edge.discovered_at else None,
            })

    return {"nodes": nodes, "links": links}


def get_all_assets_with_violations(db: Session) -> list[dict]:
    """
    Get all assets that have at least one violation, for the graph overview.
    """
    assets = db.query(Asset).all()
    result = []

    for asset in assets:
        violation_count = db.query(Violation).filter(
            Violation.asset_id == asset.id
        ).count()

        result.append({
            "id": asset.id,
            "name": asset.name,
            "asset_type": asset.asset_type,
            "violation_count": violation_count,
            "created_at": asset.created_at.isoformat() if asset.created_at else None,
        })

    return result
