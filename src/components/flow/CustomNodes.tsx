import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';

function getNodeStyle(label: string): React.CSSProperties {
  const L = label.toLowerCase();
  const baseStyle: React.CSSProperties = {
    fontWeight: "bold",
    fontFamily: "'CMU Serif Bold', serif",
    border: "none",
    outline: "none",
    minWidth: 90,
    minHeight: 38,
    padding: "0.5rem 1.5rem",
    boxSizing: "border-box",
  };
  if (L === "start") {
    return {
      ...baseStyle,
      background: "#2dd4bf",
      color: "#134e4a",
    };
  }
  return {
    ...baseStyle,
    background: "#ccfbf1",
    color: "#115e59",
  };
}

export function StartNode({ data, isConnectable }: NodeProps) {
  const label = String(data?.label || 'Start');
  return (
    <div
      style={getNodeStyle(label)}
      className="rounded-lg flex justify-center items-center relative"
    >
      <Handle
        type="source"
        position={Position.Right}
        id="b"
        style={{
          background: "#134e4a",
          width: 12,
          height: 12,
          border: "2px solid #2dd4bf",
        }}
        isConnectable={isConnectable}
      />
      <span style={{ fontFamily: "'CMU Serif Bold', serif" }}>
        {label}
      </span>
    </div>
  );
}

export function TealNode({ data, isConnectable }: NodeProps) {
  const label = String(data?.label || '');
  return (
    <div
      style={getNodeStyle(label)}
      className="rounded-lg flex justify-center items-center relative"
    >
      <Handle
        type="target"
        position={Position.Left}
        id="t"
        style={{
          background: "#115e59",
          width: 12,
          height: 12,
          border: "2px solid #ccfbf1",
        }}
        isConnectable={isConnectable}
      />
      <span style={{ fontFamily: "'CMU Serif Bold', serif" }}>
        {label}
      </span>
      <Handle
        type="source"
        position={Position.Right}
        id="b"
        style={{
          background: "#115e59",
          width: 12,
          height: 12,
          border: "2px solid #ccfbf1",
        }}
        isConnectable={isConnectable}
      />
    </div>
  );
}
