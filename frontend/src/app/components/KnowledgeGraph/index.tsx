import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface GraphNode {
  id: string;
  predicate?: string;
}

interface GraphLink {
  source: string;
  target: string;
  label: string;
  fact_id: string;
}

interface GraphFact {
  label: string;
  derived: boolean;
  rule_id: string | null;
  source: string | null;
  category: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  facts: Record<string, GraphFact>;
}

type LayoutMode = 'circle' | 'rings';
type EdgeCat = 'observed' | 'derived' | 'case';

const isFactNode = (n: GraphNode): boolean =>
  n.predicate !== undefined || n.id.includes(':');

function edgeCat(link: GraphLink, facts: Record<string, GraphFact>): EdgeCat {
  const fact = facts[link.fact_id];
  if (!fact) return 'case';
  if (fact.derived) return 'derived';
  return fact.category === 'observed' ? 'observed' : 'case';
}

const CAT_COLOR: Record<EdgeCat, string> = {
  observed: '#fbbf24',
  derived: '#34d399',
  case: '#78716c',
};

/**
 * Investigation board: zoomable/pannable SVG over the session semantic
 * network, with search, provenance filters, two deterministic layouts,
 * a node inspector, and PNG export. Nodes/edges come ONLY from the
 * session endpoint, so undiscovered relations can never appear.
 */
export default function KnowledgeGraph({
  sessionId,
  version,
}: {
  sessionId: string | null;
  version: string;
}) {
  const [data, setData] = useState<GraphData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [focusedNode, setFocusedNode] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('rings');
  const [cats, setCats] = useState<Record<EdgeCat, boolean>>({
    observed: true,
    derived: true,
    case: true,
  });
  const [showFacts, setShowFacts] = useState(true);
  const [view, setView] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const panRef = useRef<{ sx: number; sy: number; vx: number; vy: number } | null>(null);
  const dragMovedRef = useRef(false);
  const spacePressedNodeRef = useRef<string | null>(null);

  const focusGraphNode = (id: string) => {
    const nodes = svgRef.current?.querySelectorAll<SVGGElement>('[data-graph-node]');
    const target = Array.from(nodes ?? []).find((node) => node.dataset.graphNode === id);
    (target ?? svgRef.current)?.focus();
  };

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/sessions/${sessionId}/graph`)
      .then((r) => {
        if (!r.ok) throw new Error(`graph failed: ${r.status}`);
        return r.json() as Promise<GraphData>;
      })
      .then((g) => {
        if (!cancelled) {
          setData(g);
          setSelected(null);
          setFocusedNode(null);
          setView(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Graph failed.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, version]);

  const layout = useMemo(() => {
    if (!data) return null;
    const ids = [...new Set(data.nodes.map((n) => n.id))].sort();
    const byId = new Map(data.nodes.map((n) => [n.id, n]));
    const pos = new Map<string, { x: number; y: number }>();
    if (layoutMode === 'circle') {
      const radius = Math.min(430, Math.max(140, ids.length * 18));
      ids.forEach((id, i) => {
        const angle = (2 * Math.PI * i) / Math.max(1, ids.length) - Math.PI / 2;
        pos.set(id, { x: radius * Math.cos(angle), y: radius * Math.sin(angle) });
      });
    } else {
      const entities = ids.filter((id) => !isFactNode(byId.get(id)!));
      const facts = ids.filter((id) => isFactNode(byId.get(id)!));
      const r1 = Math.min(210, Math.max(110, entities.length * 26));
      const r2 = Math.min(430, Math.max(240, facts.length * 17));
      entities.forEach((id, i) => {
        const angle = (2 * Math.PI * i) / Math.max(1, entities.length) - Math.PI / 2;
        pos.set(id, { x: r1 * Math.cos(angle), y: r1 * Math.sin(angle) });
      });
      facts.forEach((id, i) => {
        const angle = (2 * Math.PI * i) / Math.max(1, facts.length) - Math.PI / 2;
        pos.set(id, { x: r2 * Math.cos(angle), y: r2 * Math.sin(angle) });
      });
    }
    const pad = 110;
    const xs = [...pos.values()].map((p) => p.x);
    const ys = [...pos.values()].map((p) => p.y);
    return {
      pos,
      bounds: {
        x: Math.min(...xs) - pad,
        y: Math.min(...ys) - pad,
        w: Math.max(...xs) - Math.min(...xs) + pad * 2,
        h: Math.max(...ys) - Math.min(...ys) + pad * 2,
      },
    };
  }, [data, layoutMode]);

  const effectiveView = view ?? layout?.bounds ?? null;

  const visible = useMemo(() => {
    if (!data) return { nodes: [] as GraphNode[], links: [] as GraphLink[] };
    const q = query.trim().toLowerCase();
    const nodes = data.nodes.filter((n) => {
      if (isFactNode(n) && !showFacts) return false;
      if (q && !n.id.toLowerCase().includes(q)) return false;
      return true;
    });
    const keep = new Set(nodes.map((n) => n.id));
    const links = data.links.filter(
      (l) => keep.has(l.source) && keep.has(l.target) && cats[edgeCat(l, data.facts)],
    );
    return { nodes, links };
  }, [data, query, showFacts, cats]);

  const incident = (id: string | null): GraphLink[] => {
    if (!id || !data) return [];
    const keep = new Set(
      visible.links.map((l) => `${l.source}|${l.target}|${l.label}|${l.fact_id}`),
    );
    return data.links.filter(
      (l) =>
        (l.source === id || l.target === id) &&
        keep.has(`${l.source}|${l.target}|${l.label}|${l.fact_id}`),
    );
  };

  const zoomAt = useCallback(
    (factor: number, cx?: number, cy?: number) => {
      setView((v) => {
        const base = v ?? layout?.bounds;
        if (!base) return v;
        const px = cx ?? base.x + base.w / 2;
        const py = cy ?? base.y + base.h / 2;
        const w = Math.min(4000, Math.max(60, base.w * factor));
        const h = (w / base.w) * base.h;
        return { x: px - ((px - base.x) * w) / base.w, y: py - ((py - base.y) * w) / base.w, w, h };
      });
    },
    [layout],
  );

  // Non-passive wheel so page scroll never fights graph zoom.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const pt = new DOMPoint(e.clientX, e.clientY);
      const m = svg.getScreenCTM()?.inverse();
      const p = m ? pt.matrixTransform(m) : undefined;
      zoomAt(e.deltaY > 0 ? 1.15 : 1 / 1.15, p?.x, p?.y);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const exportPng = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const { width: viewWidth, height: viewHeight } = svg.viewBox.baseVal;
    const exportSvg = svg.cloneNode(true) as SVGSVGElement;
    exportSvg.setAttribute('width', String(viewWidth));
    exportSvg.setAttribute('height', String(viewHeight));
    const xml = new XMLSerializer().serializeToString(exportSvg);
    const img = new Image();
    const svgUrl = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }));
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1600;
        canvas.height = 1200;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#0c0a09';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const scale = Math.min(canvas.width / viewWidth, canvas.height / viewHeight);
        const width = viewWidth * scale;
        const height = viewHeight * scale;
        ctx.drawImage(img, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = 'case-graph.png';
        a.hidden = true;
        document.body.appendChild(a);
        try {
          a.click();
        } finally {
          a.remove();
        }
      } finally {
        URL.revokeObjectURL(svgUrl);
      }
    };
    img.onerror = () => URL.revokeObjectURL(svgUrl);
    img.src = svgUrl;
  };

  if (!sessionId) return <p className="text-sm text-stone-400">Starting session…</p>;
  if (loading && !data) return <p className="text-sm text-stone-400">Drawing graph…</p>;
  if (error) return <p className="text-sm text-red-300" role="alert">{error}</p>;
  if (!data || !layout || !effectiveView) return null;

  const focusId = hover ?? selected ?? focusedNode;
  const rovingNodeId = visible.nodes.some((node) => node.id === focusedNode)
    ? focusedNode
    : visible.nodes[0]?.id;
  const selIncident = new Set<string>();
  if (selected) {
    for (const l of incident(selected)) {
      selIncident.add(l.source);
      selIncident.add(l.target);
    }
  }
  const matchCount = query.trim()
    ? visible.nodes.filter((n) => n.id.toLowerCase().includes(query.trim().toLowerCase())).length
    : null;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && matchCount) {
              const first = visible.nodes.find((n) =>
                n.id.toLowerCase().includes(query.trim().toLowerCase()),
              );
              if (first) setSelected(first.id);
            } else if (e.key === 'Escape') {
              setQuery('');
              setSelected(null);
            }
          }}
          placeholder="Find node…"
          aria-label="Find graph node"
          className="min-h-11 w-32 rounded border border-stone-700 bg-stone-900 px-2 py-1 text-xs text-stone-100"
        />
        <button
          onClick={() => setLayoutMode(layoutMode === 'circle' ? 'rings' : 'circle')}
          className="min-h-11 rounded border border-stone-700 px-2 py-1 text-xs text-stone-300 hover:bg-stone-800"
          title="Toggle node layout"
        >
          {layoutMode === 'circle' ? 'Rings' : 'Circle'}
        </button>
        <button onClick={() => zoomAt(0.8)} className="min-h-11 min-w-11 rounded border border-stone-700 px-2 py-1 text-xs text-stone-300 hover:bg-stone-800" aria-label="Zoom in">+</button>
        <button onClick={() => zoomAt(1.25)} className="min-h-11 min-w-11 rounded border border-stone-700 px-2 py-1 text-xs text-stone-300 hover:bg-stone-800" aria-label="Zoom out">−</button>
        <button onClick={() => setView(null)} className="min-h-11 rounded border border-stone-700 px-2 py-1 text-xs text-stone-300 hover:bg-stone-800" title="Fit whole graph">
          Fit
        </button>
        <button onClick={exportPng} className="min-h-11 rounded border border-stone-700 px-2 py-1 text-xs text-stone-300 hover:bg-stone-800" title="Download board as PNG">
          PNG
        </button>
      </div>
      <div className="mb-2 flex flex-wrap gap-2 text-xs" role="group" aria-label="Provenance filters">
        {(Object.keys(CAT_COLOR) as EdgeCat[]).map((cat) => (
          <button
            key={cat}
            onClick={() => setCats((c) => ({ ...c, [cat]: !c[cat] }))}
            aria-pressed={cats[cat]}
            className={`min-h-11 rounded border px-2 py-0.5 ${
              cats[cat] ? 'border-stone-600 text-stone-200' : 'border-stone-800 text-stone-400 line-through'
            }`}
          >
            <span style={{ color: CAT_COLOR[cat] }}>—</span> {cat}
          </button>
        ))}
        <button
          onClick={() => setShowFacts((s) => !s)}
          aria-pressed={showFacts}
          className={`min-h-11 rounded border px-2 py-0.5 ${
            showFacts ? 'border-stone-600 text-stone-200' : 'border-stone-800 text-stone-400 line-through'
          }`}
        >
          <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-violet-400" /> Fact nodes
        </button>
      </div>
      <svg
        ref={svgRef}
        viewBox={`${effectiveView.x} ${effectiveView.y} ${effectiveView.w} ${effectiveView.h}`}
        className="max-h-96 w-full cursor-grab rounded border border-stone-800 bg-stone-950 active:cursor-grabbing"
        role="group"
        tabIndex={-1}
        aria-label="Case knowledge graph. Drag to pan, scroll to zoom."
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          dragMovedRef.current = false;
          panRef.current = {
            sx: e.clientX,
            sy: e.clientY,
            vx: effectiveView.x,
            vy: effectiveView.y,
          };
        }}
        onPointerMove={(e) => {
          const pan = panRef.current;
          const svg = svgRef.current;
          if (!pan || !svg) return;
          const rect = svg.getBoundingClientRect();
          const dx = ((e.clientX - pan.sx) / rect.width) * effectiveView.w;
          const dy = ((e.clientY - pan.sy) / rect.height) * effectiveView.h;
          if (Math.abs(e.clientX - pan.sx) + Math.abs(e.clientY - pan.sy) > 4) {
            dragMovedRef.current = true;
          }
          if (!dragMovedRef.current) return;
          setView((v) => {
            const base = v ?? layout.bounds;
            return { ...base, x: pan.vx - dx, y: pan.vy - dy };
          });
        }}
        onPointerUp={() => {
          panRef.current = null;
        }}
        onPointerCancel={() => {
          panRef.current = null;
          dragMovedRef.current = false;
        }}
      >
        {visible.links.map((link, i) => {
          const a = layout.pos.get(link.source);
          const b = layout.pos.get(link.target);
          if (!a || !b) return null;
          const hot =
            selected === null || link.source === selected || link.target === selected;
          return (
            <g key={i} opacity={selected === null || hot ? 1 : 0.2}>
              <line
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={CAT_COLOR[edgeCat(link, data.facts)]}
                strokeWidth={hot ? 2.5 : 1.2}
              />
              <text
                x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 4}
                textAnchor="middle" fontSize="10" fill="#a8a29e"
              >
                {link.label}
              </text>
            </g>
          );
        })}
        {visible.nodes.map((n) => {
          const p = layout.pos.get(n.id);
          if (!p) return null;
          const fact = isFactNode(n);
          const active = selected === n.id;
          const focused = focusedNode === n.id;
          const dimmed =
            selected !== null && !active && !selIncident.has(n.id);
          const short = n.id.length > 22 ? `${n.id.slice(0, 21)}…` : n.id;
          return (
            <g
              key={n.id}
              data-graph-node={n.id}
              opacity={dimmed ? 0.3 : 1}
              onClick={() => {
                if (dragMovedRef.current) {
                  dragMovedRef.current = false;
                  return;
                }
                setSelected(active ? null : n.id);
              }}
              onMouseEnter={() => setHover(n.id)}
              onMouseLeave={() => setHover((h) => (h === n.id ? null : h))}
              onFocus={() => setFocusedNode(n.id)}
              onBlur={() => setFocusedNode((current) => (current === n.id ? null : current))}
              onKeyDown={(e) => {
                const currentIndex = visible.nodes.findIndex((node) => node.id === n.id);
                let nextIndex: number | null = null;
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                  nextIndex = (currentIndex + 1) % visible.nodes.length;
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                  nextIndex = (currentIndex - 1 + visible.nodes.length) % visible.nodes.length;
                } else if (e.key === 'Home') {
                  nextIndex = 0;
                } else if (e.key === 'End') {
                  nextIndex = visible.nodes.length - 1;
                }
                if (nextIndex !== null) {
                  e.preventDefault();
                  focusGraphNode(visible.nodes[nextIndex].id);
                  return;
                }
                if (e.key === 'Enter' && !e.repeat) {
                  e.preventDefault();
                  setSelected(active ? null : n.id);
                } else if (e.key === ' ') {
                  e.preventDefault();
                  spacePressedNodeRef.current = n.id;
                }
              }}
              onKeyUp={(e) => {
                if (e.key === ' ') {
                  e.preventDefault();
                  const pressedNode = spacePressedNodeRef.current;
                  spacePressedNodeRef.current = null;
                  if (pressedNode === n.id) setSelected(active ? null : n.id);
                }
              }}
              role="button"
              tabIndex={n.id === rovingNodeId ? 0 : -1}
              aria-pressed={active}
              aria-label={`Inspect relations of ${n.id}`}
              style={{ cursor: 'pointer' }}
            >
              <circle
                cx={p.x}
                cy={p.y}
                r={1}
                fill="transparent"
                stroke="transparent"
                strokeWidth={44}
                vectorEffect="non-scaling-stroke"
                pointerEvents="all"
                aria-hidden="true"
              />
              <circle
                cx={p.x} cy={p.y} r={active || focusId === n.id ? 12 : 9}
                fill={fact ? '#8b5cf6' : '#0ea5e9'}
                stroke={active || focused ? '#fff' : focusId === n.id ? '#e7e5e4' : 'none'}
                strokeWidth={active ? 2 : focused ? 3 : 1.5}
              >
                <title>{n.id}</title>
              </circle>
              <text x={p.x} y={p.y + 24} textAnchor="middle" fontSize="10" fill="#d6d3d1">
                {short}
              </text>
            </g>
          );
        })}
      </svg>
      {selected ? (
        <NodeInspector
          id={selected}
          data={data}
          onJump={(id) => {
            setSelected(id);
            focusGraphNode(id);
          }}
          onClose={() => {
            setSelected(null);
            focusGraphNode(selected);
          }}
        />
      ) : (
        <p className="mt-1 text-xs text-stone-400">
          {visible.nodes.length} nodes · {visible.links.length} links — click or tap a node to inspect; drag to pan; use +/− or scroll to zoom; Tab to a node, use arrow keys to move between nodes, and press Enter or Space to inspect.
        </p>
      )}
    </div>
  );
}

function NodeInspector({
  id,
  data,
  onJump,
  onClose,
}: {
  id: string;
  data: GraphData;
  onJump: (id: string) => void;
  onClose: () => void;
}) {
  const node = data.nodes.find((n) => n.id === id);
  const edges = data.links.filter((l) => l.source === id || l.target === id);
  const factNode = node && isFactNode(node);
  const legend = factNode ? data.facts[id] : undefined;
  return (
    <div className="mt-2 rounded border border-stone-800 p-2" aria-live="polite">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-xs text-stone-200">
          {id}{' '}
          <span className="text-stone-400">
            {factNode ? `(fact${legend ? `: ${legend.label}` : ''})` : '(entity)'}
          </span>
        </p>
        <button
          onClick={onClose}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded border border-stone-700 px-2 py-0.5 text-stone-300 hover:bg-stone-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
          aria-label="Close inspector"
        >
          <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 16 16" shapeRendering="crispEdges">
            <path d="M4 3 8 7 12 3 13 4 9 8 13 12 12 13 8 9 4 13 3 12 7 8 3 4Z" fill="currentColor" />
          </svg>
        </button>
      </div>
      {legend && (
        <p className="mt-1 font-mono text-xs text-stone-400">
          {legend.derived
            ? `derived via ${legend.rule_id ?? 'unknown rule'}`
            : legend.source
              ? `observed in ${legend.source}`
              : `background (${legend.category})`}
        </p>
      )}
      {edges.length === 0 ? (
        <p className="mt-1 text-xs text-stone-400">No relations.</p>
      ) : (
        <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto text-xs text-stone-300">
          {edges.map((link, i) => {
            const other = link.source === id ? link.target : link.source;
            const fact = data.facts[link.fact_id];
            return (
              <li key={i} className="font-mono text-xs">
                <button onClick={() => onJump(other)} className="inline-flex min-h-11 items-center rounded px-1 text-sky-300 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300" title={`Jump to ${other}`}>
                  {other}
                </button>{' '}
                <span className="text-stone-400">
                  <span className="text-amber-300">{link.source === id ? 'OUTGOING' : 'INCOMING'}</span>{' '}
                  {link.label}
                </span>{' '}
                {fact && (
                  <span className="text-stone-400">
                    [{fact.derived
                      ? `Derived by ${fact.rule_id ?? 'an inference rule'}`
                      : fact.source
                        ? `Observed in ${fact.source}`
                        : `Category: ${fact.category}`}]
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
