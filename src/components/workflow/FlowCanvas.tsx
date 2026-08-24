import { useCallback, useRef } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
  MarkerType,
  type Edge,
  type Node,
  type NodeTypes,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
} from '@xyflow/react';
import { StartNode, TealNode } from '../flow/CustomNodes';
import { CustomBezierEdge } from '../flow/CustomBezierEdge';
import { OPERATION_DND_MIME } from './OperationPalette';

const nodeTypes: NodeTypes = {
  startNode: StartNode,
  tealNode: TealNode,
};

const edgeTypes = { default: CustomBezierEdge };

const proOptions = { hideAttribution: true };

const defaultEdgeOptions = {
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 16,
    height: 16,
    color: '#0f766e',
  },
  style: {
    strokeWidth: 2,
    stroke: '#0f766e',
  },
};

function getNodeColor(node: Node): string {
  return String(node.data?.label ?? '').toLowerCase() === 'start' ? '#2dd4bf' : '#ccfbf1';
}

interface FlowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  /** Called when an operation is dropped onto the canvas. */
  onDropOperation?: (label: string) => boolean;
}

export function FlowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onDropOperation,
}: FlowCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const handleDragOver = useCallback((event: React.DragEvent) => {
    if (event.dataTransfer.types.includes(OPERATION_DND_MIME)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      const label = event.dataTransfer.getData(OPERATION_DND_MIME);
      if (!label || !onDropOperation) return;
      event.preventDefault();

      // Position is handled by the workflow store appending at chain end;
      // we only surface the intent here.
      void screenToFlowPosition({ x: event.clientX, y: event.clientY });
      onDropOperation(label);
    },
    [onDropOperation, screenToFlowPosition],
  );

  return (
    <div ref={wrapperRef} className="h-full w-full relative" data-testid="flow-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        proOptions={proOptions}
        fitView
        minZoom={0.2}
        maxZoom={2.5}
        deleteKeyCode={['Backspace', 'Delete']}
        className="h-full w-full"
      >
        <Controls
          position="bottom-right"
          showInteractive={true}
          className="!bg-white/95 !backdrop-blur-md !border !border-gray-200/90 !shadow-md !rounded-xl !overflow-hidden"
        />
        <MiniMap
          position="bottom-left"
          nodeColor={getNodeColor}
          maskColor="rgba(255, 255, 255, 0.75)"
          pannable
          zoomable
          style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
          }}
        />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#cbd5e1" />
      </ReactFlow>
    </div>
  );
}
