"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { getGraphData, getAsset, type GraphData, type GraphNode, type Asset } from "@/lib/api";

export default function GraphDetailPage() {
  const params = useParams();
  const assetId = params.id as string;
  const svgRef = useRef<SVGSVGElement>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: GraphNode } | null>(null);

  useEffect(() => {
    Promise.all([
      getGraphData(assetId),
      getAsset(assetId),
    ])
      .then(([graph, assetData]) => {
        setGraphData(graph);
        setAsset(assetData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [assetId]);

  const renderGraph = useCallback(() => {
    if (!svgRef.current || !graphData || graphData.nodes.length === 0) return;

    const svg = svgRef.current;
    const width = svg.clientWidth;
    const height = svg.clientHeight;
    const centerX = width / 2;
    const centerY = height / 2;

    // Clear existing content
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    // Create defs for gradients, arrows, and filters
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");

    // Arrow marker — asset-to-recipient (green)
    const markerGreen = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    markerGreen.setAttribute("id", "arrow-green");
    markerGreen.setAttribute("viewBox", "-0 -5 10 10");
    markerGreen.setAttribute("refX", "20");
    markerGreen.setAttribute("refY", "0");
    markerGreen.setAttribute("markerWidth", "6");
    markerGreen.setAttribute("markerHeight", "6");
    markerGreen.setAttribute("orient", "auto");
    const arrowGreen = document.createElementNS("http://www.w3.org/2000/svg", "path");
    arrowGreen.setAttribute("d", "M 0,-5 L 10,0 L 0,5");
    arrowGreen.setAttribute("fill", "#00d4aa");
    markerGreen.appendChild(arrowGreen);
    defs.appendChild(markerGreen);

    // Arrow marker — recipient-to-violation (orange)
    const markerOrange = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    markerOrange.setAttribute("id", "arrow-orange");
    markerOrange.setAttribute("viewBox", "-0 -5 10 10");
    markerOrange.setAttribute("refX", "22");
    markerOrange.setAttribute("refY", "0");
    markerOrange.setAttribute("markerWidth", "6");
    markerOrange.setAttribute("markerHeight", "6");
    markerOrange.setAttribute("orient", "auto");
    const arrowOrange = document.createElementNS("http://www.w3.org/2000/svg", "path");
    arrowOrange.setAttribute("d", "M 0,-5 L 10,0 L 0,5");
    arrowOrange.setAttribute("fill", "#f59e0b");
    markerOrange.appendChild(arrowOrange);
    defs.appendChild(markerOrange);

    // Glow filter
    const filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
    filter.setAttribute("id", "glow");
    const feGaussian = document.createElementNS("http://www.w3.org/2000/svg", "feGaussianBlur");
    feGaussian.setAttribute("stdDeviation", "3");
    feGaussian.setAttribute("result", "coloredBlur");
    filter.appendChild(feGaussian);
    const feMerge = document.createElementNS("http://www.w3.org/2000/svg", "feMerge");
    const feMergeNode1 = document.createElementNS("http://www.w3.org/2000/svg", "feMergeNode");
    feMergeNode1.setAttribute("in", "coloredBlur");
    const feMergeNode2 = document.createElementNS("http://www.w3.org/2000/svg", "feMergeNode");
    feMergeNode2.setAttribute("in", "SourceGraphic");
    feMerge.appendChild(feMergeNode1);
    feMerge.appendChild(feMergeNode2);
    filter.appendChild(feMerge);
    defs.appendChild(filter);

    svg.appendChild(defs);

    // Separate nodes by type
    const nodes = graphData.nodes;
    const links = graphData.links;
    const recipientNodes = nodes.filter(n => n.type === "recipient");
    const violationNodes = nodes.filter(n => n.type === "violation");

    // Position nodes in a two-ring radial layout
    // Inner ring: recipients, Outer ring: violations
    const innerRadius = Math.min(width, height) * 0.18;
    const outerRadius = Math.min(width, height) * 0.36;

    type PositionedNode = GraphNode & { x: number; y: number };
    const positionedNodes: PositionedNode[] = nodes.map((node) => {
      if (node.type === "original") {
        return { ...node, x: centerX, y: centerY };
      }
      if (node.type === "recipient") {
        const idx = recipientNodes.indexOf(node);
        const count = recipientNodes.length;
        const angle = (idx / Math.max(count, 1)) * 2 * Math.PI - Math.PI / 2;
        return {
          ...node,
          x: centerX + Math.cos(angle) * innerRadius,
          y: centerY + Math.sin(angle) * innerRadius,
        };
      }
      // violation
      const idx = violationNodes.indexOf(node);
      const count = violationNodes.length;
      const angle = (idx / Math.max(count, 1)) * 2 * Math.PI - Math.PI / 2;
      return {
        ...node,
        x: centerX + Math.cos(angle) * outerRadius,
        y: centerY + Math.sin(angle) * outerRadius,
      };
    });

    const nodeMap = new Map(positionedNodes.map(n => [n.id, n]));

    // Draw links
    links.forEach((link) => {
      const source = nodeMap.get(link.source as string);
      const target = nodeMap.get(link.target as string);
      if (!source || !target) return;

      const isToRecipient = target.type === "recipient";
      const strokeColor = isToRecipient ? "#00d4aa" : "#f59e0b";
      const markerRef = isToRecipient ? "url(#arrow-green)" : "url(#arrow-orange)";

      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(source.x));
      line.setAttribute("y1", String(source.y));
      line.setAttribute("x2", String(target.x));
      line.setAttribute("y2", String(target.y));
      line.setAttribute("stroke", strokeColor);
      line.setAttribute("stroke-width", "2");
      line.setAttribute("stroke-opacity", "0.55");
      line.setAttribute("marker-end", markerRef);
      svg.appendChild(line);

      // Link label at midpoint
      const midX = (source.x + target.x) / 2;
      const midY = (source.y + target.y) / 2;
      const labelText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      labelText.setAttribute("x", String(midX));
      labelText.setAttribute("y", String(midY - 8));
      labelText.setAttribute("text-anchor", "middle");
      labelText.setAttribute("fill", "#8888a0");
      labelText.setAttribute("font-size", "9");
      if (link.confidence != null) {
        labelText.textContent = `${link.label ?? ""} ${(link.confidence * 100).toFixed(0)}%`;
      } else {
        labelText.textContent = link.label ?? "";
      }
      svg.appendChild(labelText);
    });

    // Helper: draw hexagon path
    const hexPath = (cx: number, cy: number, r: number) => {
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
      });
      return pts.join(" ");
    };

    // Draw nodes
    positionedNodes.forEach((node) => {
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.style.cursor = "pointer";

      if (node.type === "original") {
        // Hexagon for original asset
        const hex = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        hex.setAttribute("points", hexPath(node.x, node.y, 22));
        hex.setAttribute("fill", "#00d4aa");
        hex.setAttribute("stroke", "#00d4aa");
        hex.setAttribute("stroke-width", "2");
        hex.setAttribute("stroke-opacity", "0.5");
        hex.setAttribute("filter", "url(#glow)");
        g.appendChild(hex);

        // Icon
        const icon = document.createElementNS("http://www.w3.org/2000/svg", "text");
        icon.setAttribute("x", String(node.x));
        icon.setAttribute("y", String(node.y + 5));
        icon.setAttribute("text-anchor", "middle");
        icon.setAttribute("font-size", "16");
        icon.textContent = "🛡️";
        g.appendChild(icon);

        // Label below
        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.setAttribute("x", String(node.x));
        label.setAttribute("y", String(node.y + 38));
        label.setAttribute("text-anchor", "middle");
        label.setAttribute("fill", "#f0f0f5");
        label.setAttribute("font-size", "11");
        label.setAttribute("font-weight", "600");
        label.textContent = node.label;
        g.appendChild(label);

      } else if (node.type === "recipient") {
        // Circle for recipient
        const isUnknown = node.label === "Unknown Source";
        const fillColor = isUnknown ? "#ef4444" : "#f59e0b";
        const strokeColor = isUnknown ? "#b91c1c" : "#d97706";

        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", String(node.x));
        circle.setAttribute("cy", String(node.y));
        circle.setAttribute("r", "16");
        circle.setAttribute("fill", fillColor);
        circle.setAttribute("stroke", strokeColor);
        circle.setAttribute("stroke-width", "3");
        circle.setAttribute("stroke-opacity", "0.6");
        circle.setAttribute("filter", "url(#glow)");
        g.appendChild(circle);

        // Icon
        const icon = document.createElementNS("http://www.w3.org/2000/svg", "text");
        icon.setAttribute("x", String(node.x));
        icon.setAttribute("y", String(node.y + 5));
        icon.setAttribute("text-anchor", "middle");
        icon.setAttribute("font-size", "13");
        icon.textContent = isUnknown ? "❓" : "🕵️";
        g.appendChild(icon);

        // Label below
        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.setAttribute("x", String(node.x));
        label.setAttribute("y", String(node.y + 32));
        label.setAttribute("text-anchor", "middle");
        label.setAttribute("fill", fillColor);
        label.setAttribute("font-size", "10");
        label.setAttribute("font-weight", "700");
        label.textContent = node.label;
        g.appendChild(label);

      } else {
        // Rounded rectangle for violation
        const hasLeaker = !!node.leaked_by;
        const fillColor = hasLeaker ? "#f87171" : "#ff6584";
        const rectW = 28;
        const rectH = 28;

        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("x", String(node.x - rectW / 2));
        rect.setAttribute("y", String(node.y - rectH / 2));
        rect.setAttribute("width", String(rectW));
        rect.setAttribute("height", String(rectH));
        rect.setAttribute("rx", "6");
        rect.setAttribute("ry", "6");
        rect.setAttribute("fill", fillColor);
        rect.setAttribute("stroke", hasLeaker ? "#b91c1c" : "#ff6584");
        rect.setAttribute("stroke-width", "2");
        rect.setAttribute("stroke-opacity", "0.5");
        g.appendChild(rect);

        // Icon
        const icon = document.createElementNS("http://www.w3.org/2000/svg", "text");
        icon.setAttribute("x", String(node.x));
        icon.setAttribute("y", String(node.y + 5));
        icon.setAttribute("text-anchor", "middle");
        icon.setAttribute("font-size", "12");
        icon.textContent = "⚠️";
        g.appendChild(icon);

        // Label below
        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.setAttribute("x", String(node.x));
        label.setAttribute("y", String(node.y + 24));
        label.setAttribute("text-anchor", "middle");
        label.setAttribute("fill", "#f0f0f5");
        label.setAttribute("font-size", "9");
        label.setAttribute("font-weight", "600");
        label.textContent = node.platform ?? node.label;
        g.appendChild(label);
      }

      // Tooltip on hover for all nodes
      g.addEventListener("mouseenter", (e) => {
        setTooltip({ x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY, node });
      });
      g.addEventListener("mouseleave", () => {
        setTooltip(null);
      });

      svg.appendChild(g);
    });
  }, [graphData]);

  useEffect(() => {
    renderGraph();
    window.addEventListener("resize", renderGraph);
    return () => window.removeEventListener("resize", renderGraph);
  }, [renderGraph]);

  if (loading) {
    return (
      <div className="flex justify-center items-center" style={{ height: "60vh" }}>
        <div className="spinner" style={{ width: 40, height: 40 }}></div>
      </div>
    );
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-5xl mb-4">🕸️</p>
        <p className="text-lg font-medium mb-2">No graph data available</p>
      </div>
    );
  }

  const recipientCount = graphData.nodes.filter(n => n.type === "recipient").length;
  const violationCount = graphData.nodes.filter(n => n.type === "violation").length;

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <a href="/graph" className="text-sm" style={{ color: "var(--accent-primary)" }}>← Back to Graphs</a>
        </div>
        <h1 className="text-3xl font-bold mb-2">Propagation Graph</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          {asset?.name} — {recipientCount} recipient{recipientCount !== 1 ? 's' : ''}, {violationCount} violation{violationCount !== 1 ? 's' : ''} detected
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-6 mb-4 text-xs" style={{ color: "var(--text-secondary)" }}>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3" style={{ background: "#00d4aa", clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }}></div>
          <span>Original Asset</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ background: "#f59e0b" }}></div>
          <span>Recipient (Who)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ background: "#ef4444" }}></div>
          <span>Unknown Source</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded" style={{ background: "#ff6584" }}></div>
          <span>Violation (Where)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-0.5" style={{ background: "#00d4aa" }}></div>
          <span>Assigned</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-0.5" style={{ background: "#f59e0b" }}></div>
          <span>Leaked</span>
        </div>
      </div>

      {/* Graph */}
      <div className="card overflow-hidden relative" style={{ height: "500px" }}>
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          style={{ background: "var(--bg-secondary)" }}
        />

        {/* Tooltip */}
        {tooltip && (
          <div
            className="graph-tooltip"
            style={{
              left: tooltip.x - 280,
              top: tooltip.y - 200,
            }}
          >
            <p className="font-semibold text-sm mb-1">{tooltip.node.label}</p>
            <p>Type: <span className="font-medium" style={{
              color: tooltip.node.type === "original" ? "#00d4aa"
                   : tooltip.node.type === "recipient" ? "#f59e0b"
                   : "#ff6584"
            }}>{tooltip.node.type}</span></p>
            {tooltip.node.platform && (
              <p>Platform: <span className="font-medium">{tooltip.node.platform}</span></p>
            )}
            {tooltip.node.confidence != null && (
              <p>Confidence: <span className="font-medium">{(tooltip.node.confidence * 100).toFixed(1)}%</span></p>
            )}
            {tooltip.node.match_type && (
              <p>Match: <span className="font-medium">{tooltip.node.match_type}</span></p>
            )}
            {tooltip.node.leaked_by && (
              <p className="text-red-400">Leaked By: <span className="font-bold">{tooltip.node.leaked_by}</span></p>
            )}
            {tooltip.node.created_at && (
              <p>Time: <span className="font-medium">{new Date(tooltip.node.created_at).toLocaleString()}</span></p>
            )}
          </div>
        )}
      </div>

      {/* Stats below graph */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <div className="stats-card">
          <p className="text-2xl font-bold" style={{ color: "var(--accent-primary)" }}>
            {graphData.nodes.length}
          </p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Total Nodes</p>
        </div>
        <div className="stats-card">
          <p className="text-2xl font-bold" style={{ color: "#f59e0b" }}>
            {recipientCount}
          </p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Recipients</p>
        </div>
        <div className="stats-card">
          <p className="text-2xl font-bold" style={{ color: "#ff6584" }}>
            {violationCount}
          </p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Violations</p>
        </div>
        <div className="stats-card">
          <p className="text-2xl font-bold" style={{ color: "var(--accent-secondary)" }}>
            {graphData.links.length}
          </p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Propagation Links</p>
        </div>
      </div>
    </div>
  );
}

