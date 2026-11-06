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

const LEGEND = [
  { id: 'junction', label: 'Junction' },
  { id: 'reservoir', label: 'Reservoir' },
  { id: 'tank', label: 'Tank' },
  { id: 'pipe', label: 'Pipe (no direction)' },
];

/** At 1366px and narrower the CSS shows icons only; every tool keeps its name and key as a tooltip. */
export default function ToolRail({ tool, changeTool }) {
  return (
    <aside className='stu-rail' aria-label='Editing tools'>
      <h2 className='stu-rail__title'>Edit tools</h2>
      <div className='stu-rail__list'>
        {TOOL_ITEMS.map(({ id, label, icon: Icon, key }) => (
          <button
            key={id}
            type='button'
            className={`stu-rail__tool ${id === 'delete' ? 'stu-rail__tool--danger' : ''}`}
            aria-pressed={tool === id}
            aria-label={label}
            aria-keyshortcuts={key}
            title={`${label} (${key})`}
            data-tip={`${label} (${key})`}
            onClick={() => changeTool(id)}
          >
            <Icon size={18} aria-hidden='true' />
            <span className='stu-rail__label'>{label}</span>
            <Kbd>{key}</Kbd>
          </button>
        ))}
      </div>
      <p className='stu-rail__note'>
        Moving a station only changes the drawing, never its real map position.
      </p>
      <h2 className='stu-rail__title'>Legend</h2>
      <ul className='stu-rail__legend'>
        {LEGEND.map(({ id, label }) => (
          <li key={id} title={label}>
            <i className={`stu-rail__swatch stu-rail__swatch--${id}`} />
            <span className='stu-rail__ltext'>{label}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
