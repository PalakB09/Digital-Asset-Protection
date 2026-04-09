"""
Graph service — builds propagation graph data from SQLite for D3.js visualization.
"""

from sqlalchemy.orm import Session
from app.models.asset import Asset
from app.models.violation import Violation, PropagationEdge


def get_propagation_graph(asset_id: str, db: Session) -> dict:
    """
    Build a D3.js-compatible force-directed graph with Recipient Topology.

    Topology:  Original Asset  →  Recipient (who)  →  Violation (where)

    Returns:
    {
        "nodes": [
            {"id": "...", "label": "...", "type": "original"|"recipient"|"violation", ...},
            ...
        ],
        "links": [
            {"source": "...", "target": "...", "label": "...", "confidence": ..., ...},
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
        "id": str(asset.id),
        "label": asset.name,
        "type": "original",
        "platform": "registered",
        "created_at": asset.created_at.isoformat() if asset.created_at else None,
    })

    # Tracking recipients to avoid duplicate nodes
    added_recipients: set[str] = set()

    # Get all propagation edges for this asset
    edges = db.query(PropagationEdge).filter(
        PropagationEdge.source_asset_id == asset_id
    ).all()

    for edge in edges:
        # Get the violation details
        violation = db.query(Violation).filter(
            Violation.id == edge.violation_id
        ).first()
        if not violation:
            continue

        # --- 1. Identify the Recipient (The "Who") ---
        leaker_name = violation.leaked_by if violation.leaked_by else "Unknown Source"
        recipient_node_id = f"recipient_{leaker_name.replace(' ', '_')}"

        # --- 2. Add Recipient Node if not already added ---
        if recipient_node_id not in added_recipients:
            nodes.append({
                "id": recipient_node_id,
                "label": leaker_name,
                "type": "recipient",
            })
            # Link Asset → Recipient
            links.append({
                "source": str(asset.id),
                "target": recipient_node_id,
                "label": "Assigned to" if violation.leaked_by else "Unknown Leak",
            })
            added_recipients.add(recipient_node_id)

        # --- 3. Add Platform Violation Node (The "Where") ---
        violation_node_id = str(violation.id)
        nodes.append({
            "id": violation_node_id,
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

        # --- 4. Link Recipient → Violation ---
        links.append({
            "source": recipient_node_id,
            "target": violation_node_id,
            "label": "Leaked to",
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
