import { getBezierPath, BaseEdge, type EdgeProps } from '@xyflow/react';

/**
 * Flowing pipeline edge.
 *
 * Layers (bottom → top):
 *  1. soft glow underlay,
 *  2. solid base path,
 *  3. gradient dashes marching toward the target (CSS animation),
 *  4. a pulse travelling along the path (`<animateMotion />`, per the
 *     official React Flow "Animating Edges" example).
 */
export function FlowEdge({
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
    <>
      <path
        className="nf-edge-glow"
        d={edgePath}
        fill="none"
        strokeLinecap="round"
      />
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: 'url(#nf-edge-flow)',
          strokeWidth: 2.5,
          strokeLinecap: 'round',
          ...style,
        }}
      />
      <path className="nf-edge-dashes" d={edgePath} fill="none" strokeLinecap="round" />
      <circle className="nf-edge-pulse" r="3.4" fill="#0d9488">
        <animateMotion dur="2.6s" repeatCount="indefinite" path={edgePath} />
      </circle>
    </>
  );
}
