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

    // Create defs for gradients and arrows
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");

    // Arrow marker
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    marker.setAttribute("id", "arrowhead");
    marker.setAttribute("viewBox", "-0 -5 10 10");
    marker.setAttribute("refX", "20");
    marker.setAttribute("refY", "0");
    marker.setAttribute("markerWidth", "6");
    marker.setAttribute("markerHeight", "6");
    marker.setAttribute("orient", "auto");
    const arrowPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    arrowPath.setAttribute("d", "M 0,-5 L 10,0 L 0,5");
    arrowPath.setAttribute("fill", "#6c63ff");
    marker.appendChild(arrowPath);
    defs.appendChild(marker);

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

    // Position nodes in a radial layout
    const nodes = graphData.nodes;
    const links = graphData.links;

    type PositionedNode = GraphNode & { x: number; y: number };
    const positionedNodes: PositionedNode[] = nodes.map((node, i) => {
      if (node.type === "original") {
        return { ...node, x: centerX, y: centerY };
      }
      const angle = ((i - 1) / (nodes.length - 1)) * 2 * Math.PI - Math.PI / 2;
      const radius = Math.min(width, height) * 0.3;
      return {
        ...node,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      };
    });

    const nodeMap = new Map(positionedNodes.map(n => [n.id, n]));

    // Draw links
    links.forEach((link) => {
      const source = nodeMap.get(link.source as string);
      const target = nodeMap.get(link.target as string);
      if (!source || !target) return;

      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(source.x));
      line.setAttribute("y1", String(source.y));
      line.setAttribute("x2", String(target.x));
      line.setAttribute("y2", String(target.y));
      line.setAttribute("stroke", "#6c63ff");
      line.setAttribute("stroke-width", "2");
      line.setAttribute("stroke-opacity", "0.5");
      line.setAttribute("marker-end", "url(#arrowhead)");
      svg.appendChild(line);

      // Confidence label on link
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", String((source.x + target.x) / 2));
      text.setAttribute("y", String((source.y + target.y) / 2 - 8));
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("fill", "#8888a0");
      text.setAttribute("font-size", "10");
      text.textContent = `${(link.confidence * 100).toFixed(0)}%`;
      svg.appendChild(text);
    });

    // Draw nodes
    positionedNodes.forEach((node) => {
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.style.cursor = "pointer";

      // Node circle
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", String(node.x));
      circle.setAttribute("cy", String(node.y));
      circle.setAttribute("r", node.type === "original" ? "20" : "14");

      if (node.type === "original") {
        circle.setAttribute("fill", "#00d4aa");
        circle.setAttribute("filter", "url(#glow)");
      } else if (node.leaked_by) {
        circle.setAttribute("fill", "#f87171");
        circle.setAttribute("filter", "url(#glow)");
      } else {
        circle.setAttribute("fill", "#ff6584");
      }

      circle.setAttribute("stroke", node.type === "original" ? "#00d4aa" : (node.leaked_by ? "#b91c1c" : "#ff6584"));
      circle.setAttribute("stroke-width", node.leaked_by ? "4" : "2");
      circle.setAttribute("stroke-opacity", "0.5");
      g.appendChild(circle);

      // Node icon
      const icon = document.createElementNS("http://www.w3.org/2000/svg", "text");
      icon.setAttribute("x", String(node.x));
      icon.setAttribute("y", String(node.y + 5));
      icon.setAttribute("text-anchor", "middle");
      icon.setAttribute("font-size", node.type === "original" ? "16" : "12");
      icon.textContent = node.type === "original" ? "🛡️" : (node.leaked_by ? "🕵️" : "⚠️");
      g.appendChild(icon);

      // Node label
      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", String(node.x));
      label.setAttribute("y", String(node.y + (node.type === "original" ? 36 : 30)));
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("fill", node.leaked_by ? "#f87171" : "#f0f0f5");
      label.setAttribute("font-size", "11");
      label.setAttribute("font-weight", "600");
      label.textContent = node.type === "original" ? node.label : (node.leaked_by ? `Leak: ${node.leaked_by}` : node.platform);
      g.appendChild(label);

      // Tooltip on hover
      g.addEventListener("mouseenter", (e) => {
        circle.setAttribute("r", node.type === "original" ? "24" : "18");
        setTooltip({ x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY, node });
      });
      g.addEventListener("mouseleave", () => {
        circle.setAttribute("r", node.type === "original" ? "20" : "14");
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

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <a href="/graph" className="text-sm" style={{ color: "var(--accent-primary)" }}>← Back to Graphs</a>
        </div>
        <h1 className="text-3xl font-bold mb-2">Propagation Graph</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          {asset?.name} — {graphData.nodes.length - 1} violation{graphData.nodes.length - 1 !== 1 ? 's' : ''} detected
        </p>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 mb-4 text-xs" style={{ color: "var(--text-secondary)" }}>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ background: "#00d4aa" }}></div>
          <span>Original Asset</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ background: "#ff6584" }}></div>
          <span>Detected Violation</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-0.5" style={{ background: "#6c63ff" }}></div>
          <span>Propagation Link</span>
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
            <p>Type: <span className="font-medium">{tooltip.node.type}</span></p>
            <p>Platform: <span className="font-medium">{tooltip.node.platform}</span></p>
            {tooltip.node.confidence && (
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
          <p className="text-2xl font-bold" style={{ color: "var(--accent-secondary)" }}>
            {graphData.links.length}
          </p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Propagation Links</p>
        </div>
        <div className="stats-card">
          <p className="text-2xl font-bold" style={{ color: "var(--accent-tertiary)" }}>
            {new Set(graphData.nodes.filter(n => n.type === "violation").map(n => n.platform)).size}
          </p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Platforms</p>
        </div>
        <div className="stats-card">
          <p className="text-2xl font-bold" style={{ color: "#ffb347" }}>
            {graphData.links.length > 0
              ? (graphData.links.reduce((sum, l) => sum + l.confidence, 0) / graphData.links.length * 100).toFixed(0)
              : 0}%
          </p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Avg Confidence</p>
        </div>
      </div>
    </div>
  );
}
