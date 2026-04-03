import { useCallback, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type NodeProps,
  BackgroundVariant,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { cn } from '../../lib/utils';
import {
  GitBranch, Flag, Crosshair, FileText, ListChecks,
  TestTube, ShieldCheck, Maximize2, Network,
} from 'lucide-react';

// ── Node type config ──

const NODE_META: Record<string, {
  icon: React.FC<{ className?: string }>;
  accent: string;
  accentRgb: string;
  bg: string;
  border: string;
  label: string;
  column: number;
}> = {
  Flow: {
    icon: GitBranch,
    accent: 'text-accent-cyan',
    accentRgb: '34,211,238',
    bg: 'bg-cyan-500/8',
    border: 'border-cyan-500/30',
    label: 'Flow',
    column: 0,
  },
  Initiative: {
    icon: Flag,
    accent: 'text-accent-purple',
    accentRgb: '196,181,253',
    bg: 'bg-purple-500/8',
    border: 'border-purple-500/30',
    label: 'Initiative',
    column: 1,
  },
  Objective: {
    icon: Crosshair,
    accent: 'text-accent-blue',
    accentRgb: '96,165,250',
    bg: 'bg-blue-500/8',
    border: 'border-blue-500/30',
    label: 'Objective',
    column: 2,
  },
  Requirement: {
    icon: FileText,
    accent: 'text-accent-amber',
    accentRgb: '251,191,36',
    bg: 'bg-amber-500/8',
    border: 'border-amber-500/30',
    label: 'Requirement',
    column: 3,
  },
  Task: {
    icon: ListChecks,
    accent: 'text-accent-green',
    accentRgb: '74,222,128',
    bg: 'bg-green-500/8',
    border: 'border-green-500/30',
    label: 'Task',
    column: 4,
  },
  Evidence: {
    icon: TestTube,
    accent: 'text-accent-orange',
    accentRgb: '251,146,60',
    bg: 'bg-orange-500/8',
    border: 'border-orange-500/30',
    label: 'Evidence',
    column: 5,
  },
  Artifact: {
    icon: ShieldCheck,
    accent: 'text-accent-red',
    accentRgb: '248,113,113',
    bg: 'bg-red-500/8',
    border: 'border-red-500/30',
    label: 'Artifact',
    column: 6,
  },
};

const COLUMN_GAP = 280;
const ROW_GAP = 110;
const NODE_WIDTH = 220;
const NODE_HEIGHT = 72;

// ── Layout engine: hierarchical left→right ──

interface GraphInput {
  nodes: Array<{ id: string; type: string; label: string; data: Record<string, unknown> }>;
  edges: Array<{ source: string; target: string; type: string }>;
}

function computeLayout(graph: GraphInput): { nodes: Node[]; edges: Edge[] } {
  // Group nodes by type/column
  const columns = new Map<number, typeof graph.nodes>();
  const nodeMap = new Map<string, (typeof graph.nodes)[0]>();

  for (const n of graph.nodes) {
    nodeMap.set(n.id, n);
    const col = NODE_META[n.type]?.column ?? 3;
    if (!columns.has(col)) columns.set(col, []);
    columns.get(col)!.push(n);
  }

  // Build child→parent mapping for vertical centering
  const parentOf = new Map<string, string>();
  for (const e of graph.edges) {
    parentOf.set(e.target, e.source);
  }

  // For each column, sort nodes to minimize edge crossings
  // Simple heuristic: order by parent's position
  const positions = new Map<string, { x: number; y: number }>();

  // Process columns left to right
  const sortedCols = [...columns.keys()].sort((a, b) => a - b);

  for (const col of sortedCols) {
    const nodesInCol = columns.get(col)!;

    // Sort by parent y-position if parent is already placed
    nodesInCol.sort((a, b) => {
      const parentA = parentOf.get(a.id);
      const parentB = parentOf.get(b.id);
      const yA = parentA ? (positions.get(parentA)?.y ?? 0) : 0;
      const yB = parentB ? (positions.get(parentB)?.y ?? 0) : 0;
      return yA - yB;
    });

    const totalHeight = nodesInCol.length * ROW_GAP;
    const startY = -totalHeight / 2 + ROW_GAP / 2;

    for (let i = 0; i < nodesInCol.length; i++) {
      const node = nodesInCol[i];
      if (node) {
        positions.set(node.id, {
          x: col * COLUMN_GAP,
          y: startY + i * ROW_GAP,
        });
      }
    }
  }

  // Second pass: nudge children toward parent center
  for (let pass = 0; pass < 2; pass++) {
    for (const col of sortedCols) {
      if (col === 0) continue;
      const nodesInCol = columns.get(col)!;

      for (const n of nodesInCol) {
        const parent = parentOf.get(n.id);
        if (parent && positions.has(parent)) {
          const parentY = positions.get(parent)!.y;
          const currentY = positions.get(n.id)!.y;
          // Move 40% toward parent
          positions.set(n.id, {
            x: positions.get(n.id)!.x,
            y: currentY + (parentY - currentY) * 0.4,
          });
        }
      }

      // Resolve overlaps within column
      const sorted = [...nodesInCol].sort(
        (a, b) => (positions.get(a.id)?.y ?? 0) - (positions.get(b.id)?.y ?? 0)
      );
      for (let i = 1; i < sorted.length; i++) {
        const prev = positions.get(sorted[i - 1]?.id ?? '');
        const curr = positions.get(sorted[i]?.id ?? '');
        if (prev && curr && curr.y - prev.y < ROW_GAP * 0.8) {
          curr.y = prev.y + ROW_GAP * 0.8;
        }
      }
    }
  }

  // Convert to ReactFlow nodes
  const rfNodes: Node[] = graph.nodes.map((n) => {
    const pos = positions.get(n.id) || { x: 0, y: 0 };
    return {
      id: n.id,
      type: 'specNode',
      position: pos,
      data: {
        nodeType: n.type,
        label: n.label,
        entityData: n.data,
      },
    };
  });

  // Convert to ReactFlow edges
  const edgeColors: Record<string, string> = {
    HAS_INITIATIVE: 'rgba(196,181,253,0.4)',
    HAS_OBJECTIVE: 'rgba(96,165,250,0.4)',
    HAS_REQUIREMENT: 'rgba(251,191,36,0.4)',
    IMPLEMENTED_BY: 'rgba(74,222,128,0.4)',
    HAS_EVIDENCE: 'rgba(251,146,60,0.4)',
    HAS_ARTIFACT: 'rgba(248,113,113,0.4)',
  };

  const rfEdges: Edge[] = graph.edges.map((e, i) => ({
    id: `e-${i}-${e.source}-${e.target}`,
    source: e.source,
    target: e.target,
    type: 'smoothstep',
    animated: false,
    style: {
      stroke: edgeColors[e.type] || 'rgba(54,54,64,0.6)',
      strokeWidth: 1.5,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 14,
      height: 14,
      color: edgeColors[e.type] || 'rgba(54,54,64,0.6)',
    },
  }));

  return { nodes: rfNodes, edges: rfEdges };
}

// ── Status helpers ──

function getStatusColor(status: string | undefined): string {
  switch (status) {
    case 'done': case 'approved': case 'passing': case 'completed': case 'verified': case 'implemented':
      return 'bg-green-400';
    case 'in_progress': case 'review': case 'pending':
      return 'bg-amber-400';
    case 'blocked': case 'failing': case 'rejected':
      return 'bg-red-400';
    default:
      return 'bg-zinc-500';
  }
}

function truncate(s: string, max: number) {
  if (!s) return '';
  return s.length > max ? s.slice(0, max) + '...' : s;
}

// ── Custom node component ──

function SpecNodeComponent({ data, selected }: NodeProps) {
  const { nodeType, label, entityData } = data as {
    nodeType: string;
    label: string;
    entityData: Record<string, unknown>;
  };
  const m = NODE_META[nodeType] ?? NODE_META.Requirement!;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const { icon, accent, accentRgb, bg, border, label: nodeLabel } = m!;
  const Icon = icon;
  const status = (entityData?.status as string) || (entityData?.current_stage as string);
  const priority = entityData?.priority ? String(entityData.priority) : '';
  const typeStr = entityData?.type && nodeType !== 'Flow' ? String(entityData.type).replace(/_/g, ' ') : '';

  return (
    <>
      <Handle type="target" position={Position.Left} className="!bg-transparent !border-0 !w-2 !h-2" />
      <div
        className={cn(
          'group relative rounded-lg border backdrop-blur-sm transition-all duration-200',
          bg,
          border,
          selected && 'ring-1 ring-white/20 scale-[1.03]',
        )}
        style={{
          width: NODE_WIDTH,
          minHeight: NODE_HEIGHT,
          boxShadow: selected
            ? `0 0 24px rgba(${accentRgb},0.15), 0 0 2px rgba(${accentRgb},0.3)`
            : `0 0 0 rgba(${accentRgb},0)`,
        }}
      >
        {/* Glow line at top */}
        <div
          className="absolute inset-x-0 top-0 h-px rounded-t-lg"
          style={{
            background: `linear-gradient(90deg, transparent 0%, rgba(${accentRgb},0.5) 50%, transparent 100%)`,
          }}
        />

        <div className="px-3 py-2.5">
          {/* Header row */}
          <div className="flex items-center gap-2 mb-1.5">
            <div
              className="flex items-center justify-center w-5 h-5 rounded shrink-0"
              style={{ background: `rgba(${accentRgb},0.12)` }}
            >
              <Icon className={cn('w-3 h-3', accent)} />
            </div>
            <span className="text-[9px] font-mono uppercase tracking-widest text-text-muted">
              {nodeLabel}
            </span>
            {status && (
              <span className="ml-auto flex items-center gap-1">
                <span className={cn('w-1.5 h-1.5 rounded-full', getStatusColor(status))} />
                <span className="text-[9px] text-text-muted capitalize">{status}</span>
              </span>
            )}
          </div>

          {/* Label */}
          <p className="text-xs text-text-primary leading-snug font-medium">
            {truncate(label, 40)}
          </p>

          {/* Extra info row */}
          {(priority || typeStr) && (
            <div className="flex items-center gap-2 mt-1.5">
              {priority && (
                <span className="text-[9px] text-text-muted capitalize">{priority}</span>
              )}
              {typeStr && (
                <span className="text-[9px] text-text-muted font-mono">{typeStr}</span>
              )}
            </div>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-transparent !border-0 !w-2 !h-2" />
    </>
  );
}

const nodeTypes = { specNode: SpecNodeComponent };

// ── Legend ──

function Legend() {
  return (
    <div className="absolute bottom-4 left-4 z-10 flex items-center gap-3 px-3 py-2 bg-surface-1/90 backdrop-blur-md border border-edge rounded-lg">
      {Object.entries(NODE_META).map(([type, meta]) => {
        const Icon = meta.icon;
        return (
          <div key={type} className="flex items-center gap-1.5">
            <Icon className={cn('w-3 h-3', meta.accent)} />
            <span className="text-[9px] text-text-muted">{meta.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Stats bar ──

function StatsBar({ graph }: { graph: GraphInput }) {
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const n of graph.nodes) {
      c[n.type] = (c[n.type] || 0) + 1;
    }
    return c;
  }, [graph]);

  return (
    <div className="absolute top-4 left-4 z-10 flex items-center gap-1">
      {Object.entries(counts).map(([type, count]) => {
        const meta = NODE_META[type];
        if (!meta) return null;
        const Icon = meta.icon;
        return (
          <div
            key={type}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px]',
              meta.bg,
              meta.border,
            )}
          >
            <Icon className={cn('w-3 h-3', meta.accent)} />
            <span className="font-mono font-semibold text-text-primary">{count}</span>
          </div>
        );
      })}
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-surface-2/60 border-edge text-[10px] ml-1">
        <Network className="w-3 h-3 text-text-muted" />
        <span className="font-mono text-text-muted">{graph.edges.length} edges</span>
      </div>
    </div>
  );
}

// ── Main graph inner (needs ReactFlowProvider context) ──

function SpecGraphInner({ graph }: { graph: GraphInput }) {
  const { nodes, edges } = useMemo(() => computeLayout(graph), [graph]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const { fitView } = useReactFlow();

  // Highlight connected edges on node select
  const highlightedEdges: Edge[] = useMemo(() => {
    if (!selectedNode) return edges;
    return edges.map((e): Edge => {
      const connected = e.source === selectedNode || e.target === selectedNode;
      return {
        ...e,
        animated: connected,
        style: {
          ...e.style,
          strokeWidth: connected ? 2.5 : 1,
          opacity: connected ? 1 : 0.25,
        },
      };
    });
  }, [edges, selectedNode]);

  const highlightedNodes = useMemo(() => {
    if (!selectedNode) return nodes;
    // Find all connected node IDs
    const connectedIds = new Set<string>([selectedNode]);
    for (const e of edges) {
      if (e.source === selectedNode) connectedIds.add(e.target);
      if (e.target === selectedNode) connectedIds.add(e.source);
    }
    return nodes.map((n) => ({
      ...n,
      style: connectedIds.has(n.id) ? {} : { opacity: 0.3 },
    }));
  }, [nodes, edges, selectedNode]);

  const onNodeClick = useCallback((_: unknown, node: Node) => {
    setSelectedNode((prev) => (prev === node.id ? null : node.id));
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  return (
    <div className="relative w-full h-full">
      <StatsBar graph={graph} />
      <ReactFlow
        nodes={highlightedNodes}
        edges={highlightedEdges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          type: 'smoothstep',
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="rgba(54,54,64,0.4)"
        />
        <Controls
          showInteractive={false}
          className="!bg-surface-1 !border-edge !rounded-lg !shadow-xl !shadow-black/30 [&>button]:!bg-surface-2 [&>button]:!border-edge [&>button]:!text-text-muted [&>button:hover]:!bg-surface-3 [&>button]:!rounded [&>button>svg]:!fill-text-muted"
        />
        <MiniMap
          nodeColor={(node) => {
            const type = (node.data as Record<string, unknown>)?.nodeType as string;
            const rgb = NODE_META[type]?.accentRgb || '113,113,122';
            return `rgba(${rgb},0.6)`;
          }}
          maskColor="rgba(12,12,14,0.85)"
          className="!bg-surface-1 !border-edge !rounded-lg"
          pannable
          zoomable
        />
      </ReactFlow>
      <Legend />

      {/* Fit view button */}
      <button
        onClick={() => fitView({ padding: 0.15, duration: 400 })}
        className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-1/90 backdrop-blur-md border border-edge rounded-md text-[10px] text-text-muted hover:text-text-primary hover:border-edge-strong transition-all"
      >
        <Maximize2 className="w-3 h-3" />
        Fit
      </button>
    </div>
  );
}

// ── Exported component ──

export function SpecGraph({ graph }: { graph: GraphInput }) {
  return (
    <ReactFlowProvider>
      <SpecGraphInner graph={graph} />
    </ReactFlowProvider>
  );
}
