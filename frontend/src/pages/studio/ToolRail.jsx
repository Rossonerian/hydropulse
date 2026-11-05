import {
  Box,
  Circle,
  GitBranch,
  MousePointer2,
  Waves,
  X,
} from 'lucide-react';
import { Kbd } from '../../ui/index.js';
import '../../styles/studio/canvas.css';

export const TOOL_ITEMS = [
  { id: 'select', label: 'Select', icon: MousePointer2, key: 'V' },
  { id: 'junction', label: 'Junction', icon: Circle, key: 'J' },
  { id: 'reservoir', label: 'Reservoir', icon: Waves, key: 'R' },
  { id: 'tank', label: 'Tank', icon: Box, key: 'T' },
  { id: 'pipe', label: 'Pipe', icon: GitBranch, key: 'P' },
  { id: 'delete', label: 'Delete', icon: X, key: 'Del' },
];

export default function ToolRail({ tool, changeTool }) {
  return (
    <aside className='stu-rail' aria-label='Studio tools'>
      <h2 className='stu-rail__title'>Edit tools</h2>
      <div className='stu-rail__list'>
        {TOOL_ITEMS.map(({ id, label, icon: Icon, key }) => (
          <button
            key={id}
            type='button'
            className={`stu-rail__tool ${id === 'delete' ? 'stu-rail__tool--danger' : ''}`}
            aria-pressed={tool === id}
            onClick={() => changeTool(id)}
          >
            <Icon size={18} aria-hidden='true' />
            <span className='stu-rail__label'>{label}</span>
            <Kbd>{key}</Kbd>
          </button>
        ))}
      </div>
      <p className='stu-rail__note'>
        Schematic only. Moving a station changes its diagram position, never its latitude or longitude.
      </p>
      <h2 className='stu-rail__title'>Legend</h2>
      <ul className='stu-rail__legend'>
        <li><i className='stu-rail__swatch stu-rail__swatch--junction' /> Junction</li>
        <li><i className='stu-rail__swatch stu-rail__swatch--reservoir' /> Reservoir</li>
        <li><i className='stu-rail__swatch stu-rail__swatch--tank' /> Tank</li>
        <li><i className='stu-rail__swatch stu-rail__swatch--pipe' /> Pipe, undirected</li>
      </ul>
    </aside>
  );
}
