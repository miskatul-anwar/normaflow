import { getBezierPath, getSmoothStepPath, BaseEdge, type EdgeProps } from '@xyflow/react';

/**
 * Pipeline edge: a single calm line. Within a row it is a gentle curve; where the pipeline wraps to the
 * next row (the target is to the left of the source) it routes as right-angle steps, like a carriage return.
 */
export function FlowEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style = {}, markerEnd }: EdgeProps) {
  const wraps = targetX < sourceX;
  const [path] = wraps
    ? getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius: 14, offset: 24 })
    : getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  return <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />;
}
