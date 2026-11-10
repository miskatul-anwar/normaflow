import { useRef } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  useStore,
  MarkerType,
  type Edge,
  type MiniMapNodeProps,
  type Node,
  type NodeTypes,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type OnConnectEnd,
  type IsValidConnection,
} from '@xyflow/react';
import { StartNode, TealNode } from '../flow/CustomNodes';
import { FlowEdge } from '../flow/FlowEdge';
import { PHASE_ACCENTS } from '../../config/operationVisuals';

const nodeTypes: NodeTypes = {
  startNode: StartNode,
  tealNode: TealNode,
};

const edgeTypes = { flow: FlowEdge };

const proOptions = { hideAttribution: true };

const defaultEdgeOptions = {
  type: 'flow',
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 18,
    height: 18,
    color: '#0d9488',
  },
  style: {
    strokeWidth: 2.5,
  },
};

function getNodeColor(node: Node): string {
  const phase = node.data?.phase as keyof typeof PHASE_ACCENTS | undefined;
  if (String(node.data?.label ?? '').toLowerCase() === 'start') return START_COLOR;
  return (phase && PHASE_ACCENTS[phase]?.accent) || '#0d9488';
}

const START_COLOR = '#34d399';

/**
 * A node in the minimap: a scaled-down copy of the real card (white body, phase-coloured outline,
 * icon chip and two text bars) instead of a flat rectangle, so each step can be told apart.
 */
function MiniMapNode({ id, x, y: y0, width, height: h0, color, selected, onClick }: MiniMapNodeProps) {
  // The minimap is as tall as the visible canvas, so a long one-row pipeline would shrink to a few pixels.
  // Keep each card at least ~8% of the map's height (centered on the real node) so it stays recognisable.
  const visibleHeight = useStore(s => s.height / s.transform[2]);
  const height = Math.min(Math.max(h0, visibleHeight * 0.08), width * 0.7);
  const y = y0 - (height - h0) / 2;
  const isStart = color === START_COLOR;
  const stroke = Math.max(height * 0.07, 2);
  const pad = height * 0.2;
  const chip = height - pad * 2;
  const barX = x + pad * 2 + chip;
  const barW = Math.max(width - chip - pad * 3.2, 0);
  const bar = height * 0.14;
  return (
    <g onClick={onClick ? e => onClick(e, id) : undefined} data-testid="nf-minimap-node">
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={height * 0.32}
        fill={isStart ? color : '#ffffff'}
        stroke={selected ? '#0f172a' : color}
        strokeWidth={selected ? stroke * 1.6 : stroke}
        shapeRendering="geometricPrecision"
      />
      <rect x={x + pad} y={y + pad} width={chip} height={chip} rx={chip * 0.3} fill={isStart ? '#ffffff' : color} opacity={isStart ? 0.9 : 1} />
      <rect x={barX} y={y + height * 0.3} width={barW} height={bar} rx={bar / 2} fill={isStart ? '#ffffff' : '#334155'} opacity={0.85} />
      <rect x={barX} y={y + height * 0.56} width={barW * 0.65} height={bar * 0.8} rx={bar / 2} fill={isStart ? '#ffffff' : color} opacity={isStart ? 0.6 : 0.45} />
    </g>
  );
}

interface FlowCanvasProps {
  /** Unique per canvas; namespaces SVG ids so several canvases (workspace tabs) can coexist. */
  flowId?: string;
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onConnectEnd?: OnConnectEnd;
  isValidConnection?: IsValidConnection;
}

export function FlowCanvas({
  flowId = 'main',
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onConnectEnd,
  isValidConnection,
}: FlowCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={wrapperRef}
      className="h-full w-full relative"
      data-testid="flow-canvas"
      style={{ ['--nf-edge-gradient' as string]: `url(#nf-edge-flow-${flowId})` }}
    >
      <ReactFlow
        id={flowId}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        isValidConnection={isValidConnection}
        proOptions={proOptions}
        fitView
        minZoom={0.08}
        maxZoom={2.5}
        deleteKeyCode={['Backspace', 'Delete']}
        className="h-full w-full"
        connectionLineContainerStyle={{ stroke: '#0d9488', strokeWidth: 2 }}
      >
        {/* Shared defs for the gradient pipeline edges (see FlowEdge). */}
        <svg aria-hidden focusable={false} className="nf-edge-defs">
          <defs>
            <linearGradient id={`nf-edge-flow-${flowId}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#14b8a6" />
              <stop offset="55%" stopColor="#0891b2" />
              <stop offset="100%" stopColor="#7c3aed" />
            </linearGradient>
          </defs>
        </svg>

        <Controls
          position="bottom-right"
          showInteractive={true}
          className="!bg-white/95 !backdrop-blur-md !border !border-gray-200/90 !shadow-sm !rounded-lg !overflow-hidden"
        />
        <MiniMap
          position="bottom-left"
          nodeColor={getNodeColor}
          nodeComponent={MiniMapNode}
          // Light mask so the nodes outside the current view keep their colours; the window is outlined instead.
          maskColor="rgba(148, 163, 184, 0.16)"
          maskStrokeColor="#0d9488"
          maskStrokeWidth={2}
          pannable
          zoomable
          style={{
            width: 300,
            height: 110,
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            boxShadow: '0 4px 16px rgba(15, 23, 42, 0.08)',
          }}
        />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.6} color="#cbd5e1" />
      </ReactFlow>
    </div>
  );
}
