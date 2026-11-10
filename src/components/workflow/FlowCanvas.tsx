import { useRef } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  MarkerType,
  type Edge,
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
  if (String(node.data?.label ?? '').toLowerCase() === 'start') return '#34d399';
  return (phase && PHASE_ACCENTS[phase]?.accent) || '#0d9488';
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
        minZoom={0.2}
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
          className="!bg-white/95 !backdrop-blur-md !border !border-gray-200/90 !shadow-md !rounded-xl !overflow-hidden"
        />
        <MiniMap
          position="bottom-left"
          nodeColor={getNodeColor}
          nodeStrokeWidth={3}
          maskColor="rgba(241, 245, 249, 0.82)"
          pannable
          zoomable
          style={{
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
