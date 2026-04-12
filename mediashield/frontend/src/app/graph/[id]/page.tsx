"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { getGraphData, getAsset, type GraphData, type GraphNode, type Asset } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";
import Link from "next/link";

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:          "#0D0F12",
  surface:     "#13161B",
  surfaceSide: "#0F1115",
  border:      "#1E2228",
  muted:       "#6B7280",
  secondary:   "#9CA3AF",
  body:        "#F9FAFB",
  accent:      "#3B82F6",
  danger:      "#DC2626",
  warning:     "#D97706",
  success:     "#16A34A",
  purple:      "#8B5CF6",
} as const;

// Node ring colours per type (spec)
const nodeRing = {
  original:  C.body,      // #F9FAFB — white ring for root
  recipient: C.warning,   // #D97706 — amber
  violation: C.danger,    // #DC2626 — red
} as const;

// Edge colours per relationship (at given opacity)
const edgeColor = (tgtType: string) => {
  if (tgtType === "violation") return C.danger;
  if (tgtType === "recipient") return C.warning;
  return C.accent;
};

const edgeOpacity = (tgtType: string) => {
  if (tgtType === "violation") return 0.65;
  if (tgtType === "recipient") return 0.65;
  return 0.45;
};

const nodeDiameter = { original: 56, recipient: 44, violation: 36 } as const;

// ─── Font helpers (resolved via CSS vars — no hardcoded strings) ─────────────
const FONT_UI   = "var(--font-body)";
const FONT_MONO = "var(--font-mono)";

// ─── Confidence colour ────────────────────────────────────────────────────────
function confColor(pct: number) {
  if (pct >= 80) return C.danger;
  if (pct >= 60) return C.warning;
  return C.muted;
}

// ─── Collapsible Graph Legend (floating, bottom-right of canvas) ──────────────
function GraphLegend() {
  const [collapsed, setCollapsed] = useState(false);
  const items = [
    { color: C.body,    label: "Original Asset" },
    { color: C.warning, label: "Recipient / Leaker" },
    { color: C.danger,  label: "Violation Node" },
  ];
  return (
    <div
      style={{
        position: "absolute",
        bottom: 16,
        right: 16,
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: 16,
        minWidth: 180,
        zIndex: 10,
        userSelect: "none",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: collapsed ? 0 : 12 }}>
        <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, fontFamily: FONT_UI, lineHeight: 1 }}>
          Node Types
        </p>
        <button
          onClick={() => setCollapsed(v => !v)}
          style={{ fontSize: 11, color: C.muted, background: "none", border: "none", cursor: "pointer", fontFamily: FONT_UI, padding: "0 0 0 8px" }}
        >
          {collapsed ? "Show ▼" : "Hide ▲"}
        </button>
      </div>

      {!collapsed && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map(item => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Ring swatch — hollow circle with colored stroke */}
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke={item.color} strokeWidth="2" fill="none" />
              </svg>
              <span style={{ fontSize: 13, fontWeight: 400, color: C.body, fontFamily: FONT_UI }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Node Tooltip (dark, structured, NOT shown for root) ─────────────────────
function NodeTooltip({ node, x, y }: { node: GraphNode; x: number; y: number }) {
  if (node.type === "original") return null;

  const typeColors: Record<string, string> = {
    recipient: C.warning,
    violation: C.danger,
  };
  const typeBg: Record<string, string> = {
    recipient: "rgba(217,119,6,0.15)",
    violation: "rgba(220,38,38,0.15)",
  };
  const confPct = node.confidence != null ? node.confidence * 100 : null;

  // Keep tooltip away from screen edges
  const left = x + 18;
  const top  = y - 8;

  return (
    <div
      style={{
        position: "fixed",
        left,
        top,
        zIndex: 50,
        background: "#1A1D23",
        border: `1px solid #2D3139`,
        borderRadius: 8,
        padding: "12px 16px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
        maxWidth: 260,
        pointerEvents: "none",
        fontFamily: FONT_UI,
      }}
    >
      {/* Type badge */}
      <span
        style={{
          display: "inline-block",
          fontSize: 11,
          fontWeight: 500,
          padding: "2px 8px",
          borderRadius: 4,
          background: typeBg[node.type] ?? "rgba(255,255,255,0.08)",
          color: typeColors[node.type] ?? C.secondary,
          marginBottom: 8,
          letterSpacing: "0.04em",
        }}
      >
        {node.type}
      </span>

      {/* Label */}
      <p
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: C.body,
          marginBottom: 8,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: 220,
        }}
        title={node.label}
      >
        {node.label}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {node.platform && (
          <p style={{ fontSize: 12, color: C.secondary, fontFamily: FONT_MONO }}>
            Platform: {node.platform}
          </p>
        )}
        {confPct !== null && (
          <p style={{ fontSize: 12, color: confColor(confPct!) }}>
            Confidence: <span style={{ fontFamily: FONT_MONO }}>{confPct!.toFixed(1)}%</span>
          </p>
        )}
        {node.source_url && (
          <p
            style={{ fontSize: 11, color: C.accent, fontFamily: FONT_MONO, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}
            title={node.source_url}
          >
            {node.source_url.length > 38 ? `${node.source_url.slice(0, 38)}…` : node.source_url}
          </p>
        )}
        {node.created_at && (
          <p style={{ fontSize: 11, color: C.muted, fontFamily: FONT_MONO, marginTop: 2 }}>
            {new Date(node.created_at).toLocaleString()}
          </p>
        )}
        {node.leaked_by && (
          <p style={{ fontSize: 12, color: C.danger, fontFamily: FONT_MONO, marginTop: 4 }}>
            Leaked by: {node.leaked_by}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── SVG Graph Canvas ─────────────────────────────────────────────────────────
function GraphCanvas({ graphData }: { graphData: GraphData }) {
  const svgRef    = useRef<SVGSVGElement>(null);
  const wrapRef   = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: GraphNode } | null>(null);

  type PositionedNode = GraphNode & { x: number; y: number };

  const renderGraph = useCallback(() => {
    if (!svgRef.current || !graphData || graphData.nodes.length === 0) return;
    const svg = svgRef.current;
    const width  = svg.clientWidth  || 900;
    const height = svg.clientHeight || 580;
    const cx = width  / 2;
    const cy = height / 2;

    // Clear
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    // ── Defs (markers + filters) ──────────────────────────────────────────────
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");

    // Arrowhead per edge color
    const arrowColors = [
      { id: "arr-blue",    color: C.accent  },
      { id: "arr-red",     color: C.danger  },
      { id: "arr-amber",   color: C.warning },
    ];
    arrowColors.forEach(({ id, color }) => {
      const m = document.createElementNS("http://www.w3.org/2000/svg", "marker");
      m.setAttribute("id", id);
      m.setAttribute("viewBox", "-0 -4 8 8");
      m.setAttribute("refX", "8");
      m.setAttribute("refY", "0");
      m.setAttribute("markerWidth", "6");
      m.setAttribute("markerHeight", "6");
      m.setAttribute("orient", "auto");
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", "M 0,-4 L 8,0 L 0,4");
      p.setAttribute("fill", color);
      p.setAttribute("fill-opacity", "0.7");
      m.appendChild(p);
      defs.appendChild(m);
    });

    // Per-node glow filter for root node
    const glowFilter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
    glowFilter.setAttribute("id", "glow-root");
    glowFilter.setAttribute("x", "-30%"); glowFilter.setAttribute("y", "-30%");
    glowFilter.setAttribute("width", "160%"); glowFilter.setAttribute("height", "160%");
    glowFilter.innerHTML = `
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    `;
    defs.appendChild(glowFilter);

    svg.appendChild(defs);

    // ── Canvas background ─────────────────────────────────────────────────────
    const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bgRect.setAttribute("width",  String(width));
    bgRect.setAttribute("height", String(height));
    bgRect.setAttribute("fill",   C.bg);
    svg.appendChild(bgRect);

    // Radial gradient centre glow
    const radGrad = document.createElementNS("http://www.w3.org/2000/svg", "radialGradient");
    radGrad.setAttribute("id", "bg-grad");
    radGrad.setAttribute("cx", "50%"); radGrad.setAttribute("cy", "50%");
    radGrad.setAttribute("r", "50%");
    radGrad.innerHTML = `
      <stop offset="0%"   stop-color="${C.surface}" stop-opacity="1"/>
      <stop offset="70%"  stop-color="${C.bg}"      stop-opacity="1"/>
    `;
    defs.appendChild(radGrad);
    const gGlow = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
    gGlow.setAttribute("cx", String(cx));   gGlow.setAttribute("cy", String(cy));
    gGlow.setAttribute("rx", String(width * 0.35));
    gGlow.setAttribute("ry", String(height * 0.35));
    gGlow.setAttribute("fill", "url(#bg-grad)");
    svg.appendChild(gGlow);

    // Dot grid (5% opacity)
    const dotPattern = document.createElementNS("http://www.w3.org/2000/svg", "pattern");
    dotPattern.setAttribute("id",     "dot-grid");
    dotPattern.setAttribute("width",  "24"); dotPattern.setAttribute("height", "24");
    dotPattern.setAttribute("patternUnits", "userSpaceOnUse");
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("cx", "1"); dot.setAttribute("cy", "1"); dot.setAttribute("r", "1");
    dot.setAttribute("fill", "#374151");
    dotPattern.appendChild(dot);
    defs.appendChild(dotPattern);
    const dotOverlay = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    dotOverlay.setAttribute("width",  String(width));
    dotOverlay.setAttribute("height", String(height));
    dotOverlay.setAttribute("fill",   "url(#dot-grid)");
    dotOverlay.setAttribute("opacity", "0.05");
    svg.appendChild(dotOverlay);

    // ── Node positioning (PRESERVED EXISTING ALGORITHM) ───────────────────────
    const nodes      = graphData.nodes;
    const links      = graphData.links;
    const recipients = nodes.filter(n => n.type === "recipient");
    const violations = nodes.filter(n => n.type === "violation");
    const innerR = Math.min(width, height) * 0.18;
    const outerR = Math.min(width, height) * 0.35;

    const positioned: PositionedNode[] = nodes.map(n => {
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

    const nodeMap = new Map(positioned.map(n => [n.id, n]));

    // ── Edges ─────────────────────────────────────────────────────────────────
    links.forEach(link => {
      const src = nodeMap.get(link.source as string);
      const tgt = nodeMap.get(link.target as string);
      if (!src || !tgt) return;

      const color   = edgeColor(tgt.type);
      const opacity = edgeOpacity(tgt.type);
      const arrowId = tgt.type === "violation" ? "arr-red" : tgt.type === "recipient" ? "arr-amber" : "arr-blue";

      // Slightly shorten line so it ends at node ring edge
      const tgtR = nodeDiameter[tgt.type] / 2;
      const dx = tgt.x - src.x;
      const dy = tgt.y - src.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const ex = tgt.x - (dx / dist) * (tgtR + 4);
      const ey = tgt.y - (dy / dist) * (tgtR + 4);

      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(src.x));   line.setAttribute("y1", String(src.y));
      line.setAttribute("x2", String(ex));       line.setAttribute("y2", String(ey));
      line.setAttribute("stroke",         color);
      line.setAttribute("stroke-width",   "1.5");
      line.setAttribute("stroke-opacity", String(opacity));
      line.setAttribute("marker-end",     `url(#${arrowId})`);
      svg.appendChild(line);

      // Edge confidence label with background pill
      if (link.confidence != null) {
        const mx = (src.x + tgt.x) / 2;
        const my = (src.y + tgt.y) / 2;
        const labelStr = `${(link.confidence * 100).toFixed(0)}%`;

        // Pill background rect
        const pillW = labelStr.length * 6 + 12;
        const pillH = 16;
        const pill = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        pill.setAttribute("x",      String(mx - pillW / 2));
        pill.setAttribute("y",      String(my - pillH / 2 - 2));
        pill.setAttribute("width",  String(pillW));
        pill.setAttribute("height", String(pillH));
        pill.setAttribute("rx",     "4");
        pill.setAttribute("fill",   C.surface);
        pill.setAttribute("stroke", C.border);
        pill.setAttribute("stroke-width", "1");
        svg.appendChild(pill);

        const mid = document.createElementNS("http://www.w3.org/2000/svg", "text");
        mid.setAttribute("x", String(mx));
        mid.setAttribute("y", String(my + 5));
        mid.setAttribute("text-anchor",  "middle");
        mid.setAttribute("fill",         C.muted);
        mid.setAttribute("font-size",    "10");
        mid.setAttribute("font-weight",  "400");
        mid.setAttribute("font-family",  FONT_MONO);
        mid.textContent = labelStr;
        svg.appendChild(mid);
      }
    });

    // ── Nodes ─────────────────────────────────────────────────────────────────
    positioned.forEach(n => {
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.style.cursor = n.type === "original" ? "default" : "pointer";

      const r    = nodeDiameter[n.type] / 2;
      const ring = nodeRing[n.type];

      // Outer glow for root node
      if (n.type === "original") {
        const glow = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        glow.setAttribute("cx", String(n.x)); glow.setAttribute("cy", String(n.y));
        glow.setAttribute("r",  String(r + 6));
        glow.setAttribute("fill", "none");
        glow.setAttribute("stroke", C.body);
        glow.setAttribute("stroke-width", "1");
        glow.setAttribute("stroke-opacity", "0.15");
        g.appendChild(glow);
      }

      // Dark fill circle
      const fillCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      fillCircle.setAttribute("cx",           String(n.x));
      fillCircle.setAttribute("cy",           String(n.y));
      fillCircle.setAttribute("r",            String(r));
      fillCircle.setAttribute("fill",         C.surface);
      fillCircle.setAttribute("stroke",       ring);
      fillCircle.setAttribute("stroke-width", n.type === "original" ? "3" : "2.5");
      if (n.type === "original") {
        fillCircle.setAttribute("filter", "url(#glow-root)");
      }
      g.appendChild(fillCircle);

      // Initial letter inside circle
      const labelStr = n.platform ?? n.label ?? "?";
      const initial  = labelStr.charAt(0).toUpperCase();
      const initText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      initText.setAttribute("x",           String(n.x));
      initText.setAttribute("y",           String(n.y + 5));
      initText.setAttribute("text-anchor", "middle");
      initText.setAttribute("fill",        ring);
      initText.setAttribute("font-size",   n.type === "original" ? "16" : "13");
      initText.setAttribute("font-weight", "500");
      initText.setAttribute("font-family", FONT_UI);
      initText.textContent = initial;
      g.appendChild(initText);

      // Node label below circle
      const belowY = n.y + r + 14;
      const dispStr = labelStr.length > 12 ? `${labelStr.slice(0, 12)}…` : labelStr;
      const lbl = document.createElementNS("http://www.w3.org/2000/svg", "text");
      lbl.setAttribute("x",           String(n.x));
      lbl.setAttribute("y",           String(belowY));
      lbl.setAttribute("text-anchor", "middle");
      lbl.setAttribute("fill",        C.secondary);
      lbl.setAttribute("font-size",   "11");
      lbl.setAttribute("font-weight", "400");
      lbl.setAttribute("font-family", FONT_UI);
      g.appendChild(lbl);
      lbl.textContent = dispStr;

      // Events (skip tooltip for root)
      if (n.type !== "original") {
        g.addEventListener("mouseenter", e =>
          setTooltip({ x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY, node: n })
        );
        g.addEventListener("mousemove", e =>
          setTooltip(prev => prev ? { ...prev, x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY } : null)
        );
        g.addEventListener("mouseleave", () => setTooltip(null));
      }

      svg.appendChild(g);
    });
  }, [graphData]);

  useEffect(() => {
    setTimeout(renderGraph, 50);
    window.addEventListener("resize", renderGraph);
    return () => window.removeEventListener("resize", renderGraph);
  }, [renderGraph]);

  return (
    <div
      ref={wrapRef}
      style={{
        position: "relative",
        background: C.bg,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        overflow: "hidden",
        minHeight: 580,
      }}
    >
      <svg ref={svgRef} width="100%" height="580" />
      <GraphLegend />
      {tooltip && <NodeTooltip node={tooltip.node} x={tooltip.x} y={tooltip.y} />}
    </div>
  );
}

// ─── Inline Metric Card ───────────────────────────────────────────────────────
const accentMap: Record<string, string> = {
  blue:  C.accent,
  purple: C.purple,
  red:   C.danger,
  amber: C.warning,
};

function MetricPanel({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderLeft: `3px solid ${accentMap[accent] ?? C.accent}`,
        borderRadius: 8,
        padding: "20px 24px",
      }}
    >
      <p style={{ fontSize: 11, fontWeight: 500, fontFamily: FONT_UI, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, lineHeight: 1, marginBottom: 12 }}>
        {label}
      </p>
      <p style={{ fontSize: 32, fontWeight: 300, fontFamily: FONT_MONO, color: C.body, lineHeight: 1, letterSpacing: "-0.02em" }}>
        {value}
      </p>
    </div>
  );
}

// ─── Horizontal Spread Timeline ───────────────────────────────────────────────
function SpreadTimeline({ nodes }: { nodes: (GraphNode & { created_at: string })[] }) {
  const sorted = [...nodes].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  if (sorted.length === 0) return null;

  const dotClr = { original: C.body, recipient: C.warning, violation: C.danger } as const;

  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: "20px 24px",
      }}
    >
      {/* Title */}
      <p style={{ fontSize: 11, fontWeight: 500, fontFamily: FONT_UI, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 24, lineHeight: 1 }}>
        Spread Timeline
      </p>

      <div style={{ overflowX: "auto", paddingBottom: 4 }}>
        <div style={{ position: "relative", minWidth: sorted.length * 140 }}>
          {/* Horizontal connector line */}
          <div
            style={{
              position: "absolute",
              top: 44,           // vertically centred on the dots
              left: "5%",
              right: "5%",
              height: 1,
              background: C.border,
            }}
          />

          {/* Events */}
          <div style={{ display: "flex", justifyContent: "space-around", alignItems: "flex-start" }}>
            {sorted.map((n, i) => {
              const color = dotClr[n.type as keyof typeof dotClr] ?? C.muted;
              const lbl   = (n.platform ?? n.label ?? "").slice(0, 14) || n.type;
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 120 }}>
                  {/* Label above dot */}
                  <p style={{ fontSize: 12, fontWeight: 400, fontFamily: FONT_UI, color: C.body, marginBottom: 8, textAlign: "center", lineHeight: 1.4, whiteSpace: "nowrap" }}>
                    {lbl}
                  </p>

                  {/* Dot on the line */}
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: color,
                      boxShadow: `0 0 8px ${color}`,
                      flexShrink: 0,
                      zIndex: 1,
                    }}
                  />

                  {/* Timestamp below dot */}
                  <p style={{ fontSize: 11, fontFamily: FONT_MONO, color: C.muted, marginTop: 8, textAlign: "center", whiteSpace: "nowrap" }}>
                    {new Date(n.created_at).toLocaleDateString()}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Ghost button ─────────────────────────────────────────────────────────────
function GhostBtn({ children }: { children: React.ReactNode }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        height: 34,
        padding: "0 14px",
        fontSize: 14,
        fontWeight: 400,
        fontFamily: FONT_UI,
        borderRadius: 6,
        border: `1px solid ${hov ? C.accent : C.border}`,
        background: "transparent",
        color: hov ? C.accent : C.secondary,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        transition: "all 150ms ease",
        flexShrink: 0,
        outline: "none",
      }}
    >
      {children}
    </button>
  );
}

// ─── Chip pill ────────────────────────────────────────────────────────────────
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontFamily: FONT_MONO,
        fontWeight: 400,
        padding: "2px 10px",
        borderRadius: 20,
        background: "rgba(255,255,255,0.05)",
        border: `1px solid ${C.border}`,
        color: C.secondary,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

// ─── Graph [id] Page ──────────────────────────────────────────────────────────
export default function GraphDetailPage() {
  // ── DATA FETCHING (PRESERVED EXACTLY) ──────────────────────────────────────
  const params  = useParams();
  const assetId = params.id as string;
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [asset,     setAsset]     = useState<Asset     | null>(null);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    if (!assetId) return;
    Promise.all([getGraphData(assetId), getAsset(assetId)])
      .then(([g, a]) => { setGraphData(g); setAsset(a); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [assetId]);

  // ── DERIVED (PRESERVED EXACTLY) ────────────────────────────────────────────
  const nodes      = graphData?.nodes ?? [];
  const links      = graphData?.links ?? [];
  const totalNodes = nodes.length;
  const platforms  = new Set(nodes.map(n => n.platform).filter(Boolean)).size;
  const violNodes  = nodes.filter(n => n.type === "violation").length;
  const earliest   = nodes
    .filter(n => n.created_at)
    .map(n => new Date(n.created_at!).getTime())
    .sort((a, b) => a - b)[0];

  const timelineNodes = nodes.filter(n => n.created_at) as (GraphNode & { created_at: string })[];

  // ── LOADING STATE ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ background: C.bg, minHeight: "100vh" }}>
        <PageTop asset={null} totalNodes={0} violNodes={0} linksCount={0} />
        <div style={{ padding: "24px 24px", display: "flex", flexDirection: "column", gap: 24 }}>
          <Skeleton className="rounded" style={{ height: 580, width: "100%" }} />
          <div style={{ display: "flex", gap: 16 }}>
            {[0,1,2,3].map(i => <Skeleton key={i} className="rounded" style={{ height: 96, flex: 1 }} />)}
          </div>
        </div>
      </div>
    );
  }

  // ── EMPTY STATE ─────────────────────────────────────────────────────────────
  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div style={{ background: C.bg, minHeight: "100vh" }}>
        <PageTop asset={asset} totalNodes={0} violNodes={0} linksCount={0} />
        <div style={{ padding: "40px 24px", maxWidth: 560, margin: "0 auto" }}>
          <div
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: "48px 32px",
              textAlign: "center",
            }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 16px" }}>
              <circle cx="5"  cy="12" r="2"/><circle cx="19" cy="5"  r="2"/><circle cx="19" cy="19" r="2"/>
              <line x1="7" y1="12" x2="17" y2="6"/><line x1="7" y1="12" x2="17" y2="18"/>
            </svg>
            <p style={{ fontSize: 16, fontWeight: 500, color: C.body, fontFamily: FONT_UI, marginBottom: 8 }}>
              No propagation data
            </p>
            <p style={{ fontSize: 14, color: C.muted, fontFamily: FONT_UI, lineHeight: 1.6, marginBottom: 20 }}>
              Run scans to generate propagation data for this asset.
            </p>
            <Link href="/scan">
              <button style={{ height: 36, padding: "0 20px", fontSize: 13, fontWeight: 500, fontFamily: FONT_UI, borderRadius: 6, border: "none", background: C.accent, color: "#fff", cursor: "pointer" }}>
                Scan now
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── MAIN CONTENT ────────────────────────────────────────────────────────────
  return (
    <div style={{ background: C.bg, minHeight: "100vh" }}>
      <PageTop asset={asset} totalNodes={totalNodes} violNodes={violNodes} linksCount={links.length} />

      {/* 1px divider */}
      <div style={{ height: 1, background: C.border }} />

      <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Graph canvas */}
        <GraphCanvas graphData={graphData} />

        {/* Metric row */}
        <div style={{ display: "flex", gap: 16 }}>
          <MetricPanel label="Total Nodes"       value={totalNodes} accent="blue"   />
          <MetricPanel label="Platforms Reached"  value={platforms}  accent="purple" />
          <MetricPanel label="Violation Nodes"    value={violNodes}  accent="red"    />
          <MetricPanel
            label="Earliest Spread"
            value={earliest ? new Date(earliest).toLocaleDateString() : "—"}
            accent="amber"
          />
        </div>

        {/* Horizontal spread timeline */}
        {timelineNodes.length > 0 && <SpreadTimeline nodes={timelineNodes} />}
      </div>
    </div>
  );
}

// ─── Page header (isolated component for cleanliness) ────────────────────────
function PageTop({
  asset,
  totalNodes,
  violNodes,
  linksCount,
}: {
  asset: Asset | null;
  totalNodes: number;
  violNodes: number;
  linksCount: number;
}) {
  return (
    <div
      style={{
        padding: "20px 24px",
        background: C.bg,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 16,
      }}
    >
      <div style={{ minWidth: 0 }}>
        {/* Back link */}
        <Link
          href="/graph"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: C.muted, textDecoration: "none", marginBottom: 10 }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          Propagation
        </Link>

        {/* Title + chips */}
        <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 12 }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: C.body, fontFamily: FONT_UI, letterSpacing: "-0.01em", lineHeight: 1.1, margin: 0 }}>
            {asset?.name ?? "Propagation Graph"}
          </h1>
          {totalNodes > 0 && (
            <>
              <Chip>{totalNodes} nodes</Chip>
              <Chip>{violNodes} violations</Chip>
              <Chip>{linksCount} links</Chip>
            </>
          )}
        </div>

        <p style={{ fontSize: 14, fontWeight: 300, color: C.muted, fontFamily: FONT_UI, marginTop: 6, lineHeight: 1.5 }}>
          Visual propagation map of asset distribution and violation spread
        </p>
      </div>

      {/* Export (ghost — not primary CTA) */}
      <GhostBtn>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Export
      </GhostBtn>
    </div>
  );
}
