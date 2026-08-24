/**
 * FlowCanvas — React Flow wrapper owning canvas-level concerns:
 * rendering, minimap/controls and drop-target handling for palette drags.
 */

import { useCallback, useRef } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
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
    <div ref={wrapperRef} className="h-full w-full" data-testid="flow-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        proOptions={proOptions}
        fitView
        minZoom={0.2}
        maxZoom={2}
        deleteKeyCode={['Backspace', 'Delete']}
        className="h-full w-full"
      >
        <Controls className="!top-4 !right-4 !left-auto !bottom-auto" />
        <MiniMap
          nodeColor={getNodeColor}
          maskColor="rgba(255, 255, 255, 0.8)"
          pannable
          zoomable
          style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
          }}
        />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
    </div>
  );
}
