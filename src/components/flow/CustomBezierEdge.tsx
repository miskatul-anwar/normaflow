import { getBezierPath, EdgeProps } from '@xyflow/react';

export function CustomBezierEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <path
      id={id}
      style={{
        stroke: '#0f766e',
        strokeWidth: 2,
        fill: 'none',
        ...style,
      }}
      className="react-flow__edge-path transition-all duration-200 hover:stroke-teal-500"
      d={edgePath}
      markerEnd={markerEnd}
    />
  );
}

