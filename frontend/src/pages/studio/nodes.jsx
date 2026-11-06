import { Handle, Position } from '@xyflow/react';
import '../../styles/studio/canvas.css';

export const NODE_TYPES = ['junction', 'reservoir', 'tank'];

function StudioNode({ data, selected }) {
  if (data.preview) return <div className='stu-node-ghost'><Handle type='target' position={Position.Left} id='in' /></div>;
  const type = data.componentType;
  const elev = Number.isFinite(data.elevation_m) ? `${Math.round(data.elevation_m)}m` : null;
  const pressure = Number.isFinite(data.pressure_m) ? `${Math.round(data.pressure_m * 10) / 10}m` : null;
  const isLow = Number.isFinite(data.pressure_m) && data.pressure_m < 15;

  return (
    <div
      className={`stu-node stu-node--${type} ${selected ? 'is-selected' : ''} ${data.pending ? 'is-pending' : ''} ${data.is_sensor ? 'is-sensor' : ''}`}
      aria-label={`${type} ${data.label}`}
      title={`${type} · ${data.id}${elev ? ` · Elev: ${elev}` : ''}${pressure ? ` · Pressure: ${pressure}` : ''}`}
    >
      <Handle type='target' position={Position.Left} id='in' />
      <span className='stu-node__mark' aria-hidden='true' />
      <div className='stu-node__body'>
        <span className='stu-node__copy'>
          <b>{data.label}</b>
          <small>{data.id}</small>
        </span>
        <div className='stu-node__meta'>
          {elev && <span className='stu-node__badge elev-badge'>{elev}</span>}
          {pressure && <span className={`stu-node__badge ${isLow ? 'press-low' : 'press-badge'}`}>{pressure}</span>}
        </div>
      </div>
      <Handle type='source' position={Position.Right} id='out' />
    </div>
  );
}

export const nodeTypes = { studioNode: StudioNode };
