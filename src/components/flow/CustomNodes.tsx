import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Play } from 'lucide-react';
import { OPERATIONS } from '../../config/operations';
import { getOperationVisual, PHASE_ACCENTS, type OperationVisual } from '../../config/operationVisuals';

function resolveVisual(data: Record<string, unknown>): OperationVisual {
  const operationId = typeof data?.operationId === 'string' ? data.operationId : undefined;
  const visual = getOperationVisual(operationId);
  if (visual.icon || visual.glyph) return visual;
  // Fall back to the label (e.g. snapshots saved before ids existed).
  const label = String(data?.label ?? '');
  const byLabel = OPERATIONS[label];
  return byLabel ? getOperationVisual(byLabel.id) : {};
}

export function StartNode({ data, isConnectable }: NodeProps) {
  const label = String(data?.label || 'Start');
  return (
    <div className="nf-node nf-node--start">
      <span className="nf-node__halo" aria-hidden />
      <span className="nf-node__chip nf-node__chip--start" aria-hidden>
        <Play strokeWidth={2.6} fill="currentColor" />
      </span>
      <span className="nf-node__body">
        <span className="nf-node__label">{label}</span>
        <span className="nf-node__desc">dataset enters the pipeline</span>
      </span>
      <Handle
        type="source"
        position={Position.Right}
        id="b"
        className="nf-handle nf-handle--source"
        isConnectable={isConnectable}
      />
    </div>
  );
}

export function TealNode({ data, isConnectable }: NodeProps) {
  const label = String(data?.label || '');
  const phase = (data?.phase ?? 'PREP') as keyof typeof PHASE_ACCENTS;
  const meta = PHASE_ACCENTS[phase] ?? PHASE_ACCENTS.PREP;
  const description = OPERATIONS[label]?.description ?? meta.description;
  const { icon: Icon, glyph } = resolveVisual(data);

  return (
    <div
      className="nf-node"
      data-phase={phase}
      style={{ '--nf-accent': meta.accent, '--nf-accent-soft': meta.soft } as React.CSSProperties}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="t"
        className="nf-handle nf-handle--target"
        isConnectable={isConnectable}
      />
      <span className="nf-node__chip" aria-hidden>
        {Icon ? <Icon strokeWidth={2} /> : <span className="nf-node__glyph">{glyph ?? '•'}</span>}
      </span>
      <span className="nf-node__body">
        <span className="nf-node__label">{label}</span>
        <span className="nf-node__desc">{description}</span>
      </span>
      <Handle
        type="source"
        position={Position.Right}
        id="b"
        className="nf-handle nf-handle--source"
        isConnectable={isConnectable}
      />
    </div>
  );
}
