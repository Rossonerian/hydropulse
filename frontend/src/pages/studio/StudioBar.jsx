import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Compass,
  Database,
  FileUp,
  GitBranch,
  Map,
  Pencil,
  Redo2,
  Undo2,
} from 'lucide-react';
import { Button, DraftStatus, IconButton, SegmentedControl } from '../../ui/index.js';
import '../../styles/studio/shell.css';

const VIEW_OPTIONS = [
  { value: 'schematic', label: 'Schematic', icon: GitBranch },
  { value: 'geographic', label: 'Map', icon: Map },
  { value: 'terrain3d', label: 'Terrain', icon: Compass },
];

/** Compact icon button used by canvas controls. */
export function ToolbarButton({ icon: Icon, label, onClick, disabled = false, active = false, title }) {
  return (
    <button
      className={`stu-bar-icon ${active ? 'is-active' : ''}`}
      type='button'
      aria-label={label}
      title={title || label}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon size={16} />
    </button>
  );
}

function FileMenu({ items }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    menuRef.current?.querySelector('[role="menuitem"]:not([disabled])')?.focus();
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  const onMenuKeyDown = (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const entries = [...menuRef.current.querySelectorAll('[role="menuitem"]:not([disabled])')];
    const index = entries.indexOf(document.activeElement);
    const step = event.key === 'ArrowDown' ? 1 : -1;
    entries[(index + step + entries.length) % entries.length]?.focus();
  };

  return (
    <div className='stu-bar-file' ref={wrapRef}>
      <Button
        ref={buttonRef}
        variant='secondary'
        aria-haspopup='menu'
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        File <ChevronDown size={16} />
      </Button>
      {open && (
        <div className='stu-bar-menu' role='menu' aria-label='File' ref={menuRef} onKeyDown={onMenuKeyDown}>
          {items.map((item) => (
            <button
              key={item.label}
              type='button'
              role='menuitem'
              className='stu-bar-menuitem'
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              <span>{item.label}</span>
              {item.hint && <span className='stu-bar-menuhint'>{item.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StudioBar({
  projectNameDraft,
  setProjectNameDraft,
  commit,
  draftRef,
  dirty,
  savedAt,
  viewMode,
  setViewMode,
  setCatalogOpen,
  setImportOpen,
  past,
  future,
  undo,
  redo,
  loadDemo,
  newBlank,
  reopenDraft,
  fileInput,
  importDraft,
  exportDraft,
  saveDraft,
  canExport,
  readOnly = false,
}) {
  const fileItems = [
    { label: 'Load Kengeri sample', onSelect: loadDemo, disabled: readOnly },
    { label: 'New blank', onSelect: newBlank, disabled: readOnly },
    { label: 'Reopen saved draft', onSelect: reopenDraft, disabled: readOnly },
    { label: 'Open draft JSON…', onSelect: () => fileInput.current?.click(), disabled: readOnly },
    { label: 'Export draft JSON', onSelect: exportDraft, disabled: !canExport },
    { label: 'Save draft', onSelect: saveDraft, hint: 'Ctrl+S', disabled: readOnly },
  ];

  return (
    <header className='stu-bar'>
      <label className='stu-bar-name'>
        <Pencil size={16} aria-hidden='true' />
        <input
          aria-label='Draft name'
          value={projectNameDraft}
          readOnly={readOnly}
          onChange={(event) => setProjectNameDraft(event.target.value)}
          onBlur={() => {
            if (projectNameDraft !== draftRef.current.project.name) commit((next) => {
              next.project.name = projectNameDraft || 'Untitled Water Network';
              next.network.network_name = next.project.name;
              return next;
            });
          }}
          onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
        />
      </label>
      {savedAt || dirty ? (
        <DraftStatus dirty={dirty} savedAt={savedAt} />
      ) : (
        <span className='stu-bar-unsaved'>Not saved yet</span>
      )}

      <span className='stu-bar-sep' aria-hidden='true' />
      <SegmentedControl label='View mode' options={VIEW_OPTIONS} value={viewMode} onChange={setViewMode} />

      <span className='stu-bar-sep' aria-hidden='true' />
      <Button icon={Database} onClick={() => setCatalogOpen(true)}>Catalog</Button>
      <Button icon={FileUp} onClick={() => setImportOpen(true)} disabled={readOnly}>Import</Button>

      <span className='stu-bar-sep' aria-hidden='true' />
      <IconButton label='Undo' icon={Undo2} disabled={readOnly || !past.length} onClick={undo} />
      <IconButton label='Redo' icon={Redo2} disabled={readOnly || !future.length} onClick={redo} />

      <FileMenu items={fileItems} />
      <input ref={fileInput} type='file' accept='application/json,.json' hidden onChange={importDraft} />
    </header>
  );
}
