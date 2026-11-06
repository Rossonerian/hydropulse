import '../../styles/studio/canvas.css';
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react';

function StudioPipe({ id, sourceX, sourceY, targetX, targetY, data, selected }) {
  const end = data?.previewEnd;
  const finalX = end?.x ?? targetX;
  const finalY = end?.y ?? targetY;
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX: finalX,
    targetY: finalY,
  });
  const preview = data?.preview;
  const closed = data?.status === 'CLOSED';
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        className={`stu-edge ${selected ? 'is-selected' : ''} ${preview ? 'is-preview' : ''} ${closed ? 'is-closed' : ''}`}
      />
      {!preview && !closed && (
        <path
          d={path}
          fill="none"
          className={`stu-edge-flow-dash ${selected ? 'is-selected' : ''}`}
          strokeWidth={selected ? 2.5 : 1.8}
        />
      )}
      {!preview && (selected || data?.showLabel) && (
        <EdgeLabelRenderer>
          <div
            className='stu-edge__label nodrag nopan'
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
          >
            {id} · {data?.diameter ? `${data.diameter} mm` : 'Ø —'}
          </div>
        </EdgeLabelRenderer>
      )}
      {preview && (
        <EdgeLabelRenderer>
          <div
            className='stu-edge__label stu-edge__label--preview nodrag nopan'
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
          >
            Choose destination
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const edgeTypes = { studioPipe: StudioPipe };
