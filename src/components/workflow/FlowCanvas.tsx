import { useEffect, useRef } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  MarkerType,
  useReactFlow,
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
    width: 14,
    height: 14,
    color: '#64748b',
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
  const { fitView } = useReactFlow();

  // Re-frame the pipeline when steps are added or removed, so a new row is never off screen.
  const count = nodes.length;
  useEffect(() => {
    const id = requestAnimationFrame(() => void fitView({ padding: 0.08, maxZoom: 1.1, duration: 300 }));
    return () => cancelAnimationFrame(id);
  }, [count, fitView]);

  return (
    <div
      ref={wrapperRef}
      className="h-full w-full relative"
      data-testid="flow-canvas"
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
        fitViewOptions={{ padding: 0.08, maxZoom: 1.1 }}
        minZoom={0.2}
        maxZoom={2.5}
        deleteKeyCode={['Backspace', 'Delete']}
        className="h-full w-full"
              >
        <Controls
          position="bottom-right"
          showInteractive={true}
          className="!rounded-lg !overflow-hidden !border !border-gray-200 !shadow-sm"
        />
        <MiniMap
          position="bottom-left"
          nodeColor={getNodeColor}
          nodeStrokeWidth={3}
          maskColor="color-mix(in srgb, var(--nf-surface-2) 82%, transparent)"
          pannable
          zoomable
          style={{
            backgroundColor: 'var(--nf-surface)',
            border: '1px solid var(--nf-border)',
            borderRadius: '12px',
          }}
        />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.6} color="var(--nf-border-strong)" />
      </ReactFlow>
    </div>
  );
}
