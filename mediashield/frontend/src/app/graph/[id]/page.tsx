"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { getGraphData, getAsset, type GraphData, type GraphNode, type Asset } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { MetricCard } from "@/components/ui/MetricCard";
import { Skeleton } from "@/components/ui/Skeleton";

// ─── Graph Legend ─────────────────────────────────────────────────────────────
function GraphLegend() {
  const items = [
    { color: "var(--neu-primary)", label: "Origin node" },
    { color: "var(--neu-info)", label: "First spread" },
    { color: "var(--neu-surface-dk)", label: "Further spread" },
    { color: "var(--neu-danger)", label: "Violation node" },
  ];
  return (
    <div className="absolute top-4 right-4 neu-raised px-4 py-3 opacity-90 backdrop-blur-sm shadow-[var(--neu-shadow-lg)] pointer-events-none">
      <p className="text-[10px] font-bold text-[var(--neu-text-faint)] uppercase tracking-widest mb-3">Legend</p>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.color} className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-[4px] shrink-0 neu-inset" style={{ background: item.color }} />
            <span className="text-[12px] font-bold text-[var(--neu-text)]">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Node Tooltip ─────────────────────────────────────────────────────────────
function NodeTooltip({ node, x, y }: { node: GraphNode; x: number; y: number }) {
  const typeVariant = {
    original:  "info" as const,
    recipient: "pending" as const,
    violation: "violation" as const,
  };
  return (
    <div
      className="fixed z-50 neu-raised px-5 py-4 pointer-events-none animate-in fade-in zoom-in-95 duration-200"
      style={{ left: x + 16, top: y - 8, maxWidth: 300 }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Badge variant={typeVariant[node.type]}>{node.type}</Badge>
        {node.platform && <Badge variant="neutral">{node.platform}</Badge>}
      </div>
      <p className="text-[14px] font-bold text-[var(--neu-text)] mb-2 truncate" title={node.label}>
        {node.label}
      </p>
      {node.source_url && (
        <p className="text-[11px] font-mono text-[var(--neu-primary)] truncate mb-2" title={node.source_url}>
          {node.source_url.length > 40 ? `${node.source_url.slice(0, 40)}…` : node.source_url}
        </p>
      )}
      {node.confidence != null && (
        <p className="text-[11px] font-sans text-[var(--neu-text-muted)]">Confidence: <strong className="font-mono text-[var(--neu-text)]">{(node.confidence * 100).toFixed(1)}%</strong></p>
      )}
      {node.created_at && (
        <p className="text-[11px] font-mono text-[var(--neu-text-faint)] mt-2">{new Date(node.created_at).toLocaleString()}</p>
      )}
      {node.leaked_by && (
        <p className="text-[11px] font-mono font-bold text-[var(--neu-danger)] mt-2">Leaked by: {node.leaked_by}</p>
      )}
    </div>
  );
}

// ─── SVG Graph Canvas ─────────────────────────────────────────────────────────
function GraphCanvas({ graphData }: { graphData: GraphData }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: GraphNode } | null>(null);

  type PositionedNode = GraphNode & { x: number; y: number };

  const renderGraph = useCallback(() => {
    if (!svgRef.current || !graphData || graphData.nodes.length === 0) return;
    const svg = svgRef.current;
    // use computed style values for colors
    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--neu-primary').trim() || "#2563EB";
    const dangerColor = getComputedStyle(document.documentElement).getPropertyValue('--neu-danger').trim() || "#EF4444";
    const infoColor = getComputedStyle(document.documentElement).getPropertyValue('--neu-info').trim() || "#93C5FD";
    
    const width = svg.clientWidth;
    const height = svg.clientHeight;
    const cx = width / 2;
    const cy = height / 2;

    while (svg.firstChild) svg.removeChild(svg.firstChild);

    // Arrow markers
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const mkArrow = (id: string, color: string) => {
      const m = document.createElementNS("http://www.w3.org/2000/svg", "marker");
      m.setAttribute("id", id);
      m.setAttribute("viewBox", "-0 -5 10 10");
      m.setAttribute("refX", "24");
      m.setAttribute("refY", "0");
      m.setAttribute("markerWidth", "6");
      m.setAttribute("markerHeight", "6");
      m.setAttribute("orient", "auto");
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", "M 0,-5 L 10,0 L 0,5");
      p.setAttribute("fill", color);
      m.appendChild(p);
      return m;
    };
    defs.appendChild(mkArrow("arrow-blue", primaryColor));
    defs.appendChild(mkArrow("arrow-red", dangerColor));
    svg.appendChild(defs);

    const nodes = graphData.nodes;
    const links = graphData.links;
    const recipients = nodes.filter((n) => n.type === "recipient");
    const violations = nodes.filter((n) => n.type === "violation");
    const innerR = Math.min(width, height) * 0.18;
    const outerR = Math.min(width, height) * 0.35;

    const positioned: PositionedNode[] = nodes.map((n) => {
      if (n.type === "original") return { ...n, x: cx, y: cy };
      if (n.type === "recipient") {
        const idx = recipients.indexOf(n);
        const a = (idx / Math.max(recipients.length, 1)) * 2 * Math.PI - Math.PI / 2;
        return { ...n, x: cx + Math.cos(a) * innerR, y: cy + Math.sin(a) * innerR };
      }
      const idx = violations.indexOf(n);
      const a = (idx / Math.max(violations.length, 1)) * 2 * Math.PI - Math.PI / 2;
      return { ...n, x: cx + Math.cos(a) * outerR, y: cy + Math.sin(a) * outerR };
    });

    const nodeMap = new Map(positioned.map((n) => [n.id, n]));

    // Links
    links.forEach((link) => {
      const src = nodeMap.get(link.source as string);
      const tgt = nodeMap.get(link.target as string);
      if (!src || !tgt) return;
      const isViolation = tgt.type === "violation";
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(src.x));
      line.setAttribute("y1", String(src.y));
      line.setAttribute("x2", String(tgt.x));
      line.setAttribute("y2", String(tgt.y));
      line.setAttribute("stroke", isViolation ? dangerColor : primaryColor);
      line.setAttribute("stroke-width", "2");
      line.setAttribute("stroke-opacity", "0.5");
      line.setAttribute("marker-end", `url(#${isViolation ? "arrow-red" : "arrow-blue"})`);
      svg.appendChild(line);

      if (link.confidence != null) {
        const mid = document.createElementNS("http://www.w3.org/2000/svg", "text");
        mid.setAttribute("x", String((src.x + tgt.x) / 2));
        mid.setAttribute("y", String((src.y + tgt.y) / 2 - 8));
        mid.setAttribute("text-anchor", "middle");
        mid.setAttribute("fill", "var(--neu-text-faint)");
        mid.setAttribute("font-size", "10");
        mid.setAttribute("font-weight", "bold");
        mid.setAttribute("font-family", "'JetBrains Mono', monospace");
        mid.textContent = `${(link.confidence * 100).toFixed(0)}%`;
        svg.appendChild(mid);
      }
    });

    // Node colors per type
    const nodeColor = {
      original:  primaryColor,
      recipient: infoColor,
      violation: dangerColor,
    };
    const nodeRadius = {
      original:  24,
      recipient: 16,
      violation: 16,
    };

    positioned.forEach((n) => {
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.style.cursor = "pointer";

      // Neumorphic raised drop shadow for SVG elements
      const filterId = `shadow-${n.id}`;
      const filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
      filter.setAttribute("id", filterId);
      filter.innerHTML = `
        <feDropShadow dx="3" dy="3" stdDeviation="4" flood-color="#b8b5b2" flood-opacity="0.8" />
        <feDropShadow dx="-3" dy="-3" stdDeviation="4" flood-color="#ffffff" flood-opacity="0.9" />
      `;
      defs.appendChild(filter);

      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", String(n.x));
      circle.setAttribute("cy", String(n.y));
      circle.setAttribute("r", String(nodeRadius[n.type]));
      circle.setAttribute("fill", nodeColor[n.type]);
      circle.setAttribute("stroke", "var(--neu-surface)");
      circle.setAttribute("stroke-width", "3");
      circle.setAttribute("filter", `url(#${filterId})`);
      g.appendChild(circle);

      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", String(n.x));
      label.setAttribute("y", String(n.y + nodeRadius[n.type] + 16));
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("fill", "var(--neu-text)");
      label.setAttribute("font-size", "11");
      label.setAttribute("font-weight", "bold");
      label.setAttribute("font-family", "'Space Mono', monospace");
      // Add subtle text shadow to make label pop over lines
      label.setAttribute("style", "text-shadow: 0 1px 2px var(--neu-surface), 0 -1px 2px var(--neu-surface);");
      const labelStr = n.platform ?? n.label;
      label.textContent = labelStr.length > 14 ? `${labelStr.slice(0, 14)}…` : labelStr;
      g.appendChild(label);

      g.addEventListener("mouseenter", (e) =>
        setTooltip({ x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY, node: n })
      );
      g.addEventListener("mouseleave", () => setTooltip(null));
      svg.appendChild(g);
    });
  }, [graphData]);

  useEffect(() => {
    // slight delay to allow CSS vars to paint
    setTimeout(renderGraph, 50);
    window.addEventListener("resize", renderGraph);
    return () => window.removeEventListener("resize", renderGraph);
  }, [renderGraph]);

  return (
    <>
      <div className="neu-inset rounded-[20px] overflow-hidden relative border-2 border-[var(--neu-surface-dk)]" style={{ minHeight: 560 }}>
        <svg ref={svgRef} width="100%" height="560" className="opacity-90" />
        <GraphLegend />
      </div>
      {tooltip && <NodeTooltip node={tooltip.node} x={tooltip.x} y={tooltip.y} />}
    </>
  );
}

// ─── Graph [id] Page ───────────────────────────────────────────────────────────
export default function GraphDetailPage() {
  const params = useParams();
  const assetId = params.id as string;
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!assetId) return;
    Promise.all([getGraphData(assetId), getAsset(assetId)])
      .then(([g, a]) => { setGraphData(g); setAsset(a); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [assetId]);

  const nodes       = graphData?.nodes ?? [];
  const links       = graphData?.links ?? [];
  const totalNodes  = nodes.length;
  const platforms   = new Set(nodes.map((n) => n.platform).filter(Boolean)).size;
  const violNodes   = nodes.filter((n) => n.type === "violation").length;
  const earliest    = nodes
    .filter((n) => n.created_at)
    .map((n) => new Date(n.created_at!).getTime())
    .sort((a, b) => a - b)[0];

  if (loading) {
    return (
      <>
        <PageHeader title="Propagation graph" backHref="/graph" backLabel="Back to Graphs" />
        <div className="flex-1 px-8 py-8 max-w-[1200px] mx-auto w-full space-y-6">
          <Skeleton className="w-full rounded-[20px] neu-inset" style={{ height: 560 }} />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[120px] rounded-xl neu-raised" />)}
          </div>
        </div>
      </>
    );
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <>
        <PageHeader title={asset?.name ?? "Graph"} backHref="/graph" backLabel="Back to Graphs" />
        <div className="flex-1 px-8 py-20 text-center max-w-[800px] mx-auto neu-inset rounded-[20px] mt-8">
          <div className="w-14 h-14 neu-raised rounded-xl flex items-center justify-center mx-auto mb-5 text-[var(--neu-text-faint)]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="5" cy="12" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="19" cy="19" r="2"/>
              <line x1="7" y1="12" x2="17" y2="6"/><line x1="7" y1="12" x2="17" y2="18"/>
            </svg>
          </div>
          <p className="text-[16px] font-bold text-[var(--neu-text)] uppercase tracking-wide">No graph data available</p>
          <p className="text-[13px] font-sans text-[var(--neu-text-muted)] mt-2">Run scans to generate propagation data for this asset</p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={asset?.name ?? "PROPAGATION GRAPH"}
        subtitle={`${totalNodes} nodes · ${violNodes} violations · ${links.length} propagation links`}
        backHref="/graph"
        backLabel="Back to graphs"
        action={
          <Button variant="secondary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export Graph
          </Button>
        }
      />

      <div className="flex-1 px-8 py-8 max-w-[1200px] mx-auto w-full space-y-6">
        <GraphCanvas graphData={graphData} />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard label="Total Nodes"      value={totalNodes} accentColor="blue" />
          <MetricCard label="Platforms Reached" value={platforms}  accentColor="green" />
          <MetricCard label="Violation Nodes"   value={violNodes}  accentColor="red" />
          <MetricCard
            label="Earliest Spread"
            value={earliest ? new Date(earliest).toLocaleDateString() : "—"}
            accentColor="amber"
          />
        </div>

        {nodes.filter((n) => n.created_at).length > 0 && (
          <div className="neu-raised p-6">
            <h2 className="text-[16px] font-bold text-[var(--neu-text)] mb-5 uppercase tracking-wide">Spread timeline</h2>
            <div className="overflow-x-auto pb-2">
              <div className="flex gap-4" style={{ minWidth: "max-content" }}>
                {nodes
                  .filter((n) => n.created_at)
                  .sort((a, b) => new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime())
                  .map((n, i) => {
                    const typeVariant = {
                      original:  "info" as const,
                      recipient: "pending" as const,
                      violation: "violation" as const,
                    };
                    return (
                      <div key={i} className="neu-inset-sm px-4 py-4 rounded-[12px] shrink-0 min-w-[160px] flex flex-col justify-between">
                        <div>
                          <p className="text-[10px] font-mono font-bold text-[var(--neu-text-faint)] mb-2">{new Date(n.created_at!).toLocaleDateString()}</p>
                          <p className="text-[13px] font-bold text-[var(--neu-text)] truncate" title={n.platform ?? n.label}>
                            {n.platform ?? n.label}
                          </p>
                        </div>
                        <div className="mt-4">
                          <Badge variant={typeVariant[n.type]}>{n.type}</Badge>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
