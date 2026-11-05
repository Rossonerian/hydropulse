import { Handle, Position } from '@xyflow/react';
import '../../styles/studio/canvas.css';

export const NODE_TYPES = ['junction', 'reservoir', 'tank'];

function StudioNode({ data, selected }) {
  if (data.preview) return <div className='stu-node-ghost'><Handle type='target' position={Position.Left} id='in' /></div>;
  const type = data.componentType;
  return (
    <div
      className={`stu-node stu-node--${type} ${selected ? 'is-selected' : ''} ${data.pending ? 'is-pending' : ''}`}
      aria-label={`${type} ${data.label}`}
      title={`${type} · ${data.id}`}
    >
      <Handle type='target' position={Position.Left} id='in' />
      <span className='stu-node__mark' aria-hidden='true' />
      <span className='stu-node__copy'>
        <b>{data.label}</b>
        <small>{data.id}</small>
      </span>
      <Handle type='source' position={Position.Right} id='out' />
    </div>
  );
}

export const nodeTypes = { studioNode: StudioNode };
