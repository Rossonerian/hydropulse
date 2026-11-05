import { useEffect, useId, useState } from 'react';
import { MousePointer2, X } from 'lucide-react';
import { Button, Field, Select } from '../../ui/index.js';
import '../../styles/studio/canvas.css';

function StudioField({ label, value, type = 'text', unit, onCommit, min, step, readOnly = false, mono = false }) {
  const [draft, setDraft] = useState(value ?? '');
  const id = useId();
  useEffect(() => setDraft(value ?? ''), [value]);
  return (
    <Field label={unit ? `${label} (${unit})` : label} htmlFor={id}>
      <input
        id={id}
        className={`stu-insp__input ${mono || type === 'number' || readOnly ? 'stu-insp__input--mono' : ''}`}
        type={type}
        min={min}
        step={step}
        value={draft}
        readOnly={readOnly}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => !readOnly && onCommit(draft)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
      />
    </Field>
  );
}

function StudioNotesField({ value, onCommit }) {
  const [draft, setDraft] = useState(value || '');
  const id = useId();
  useEffect(() => setDraft(value || ''), [value]);
  return (
    <Field label='Draft note' htmlFor={id}>
      <textarea
        id={id}
        className='stu-insp__input stu-insp__textarea'
        rows='3'
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => onCommit(draft)}
      />
    </Field>
  );
}

export default function PropertiesPanel({ draft, selection, onField, onRemove }) {
  const network = draft.network;
  const selectedNode =
    selection?.type === 'node'
      ? network.nodes.find((node) => node.id === selection.id)
      : null;
  const selectedPipe =
    selection?.type === 'pipe'
      ? network.pipes.find((pipe) => pipe.id === selection.id)
      : null;
  const selected = selectedNode || selectedPipe;
  const typeName = selectedNode?.type || (selectedPipe ? 'pipe' : '');
  const labelMap = draft.editor_layout.labels || {};
  const notesMap = draft.editor_layout.notes || {};
  const label = selected ? labelMap[selected.id] || selected.id : '';
  const commitNumber = (field, raw) =>
    onField(selected.id, field, raw === '' ? '' : Number(raw), selection.type);
  return (
    <aside className='stu-insp' aria-label='Properties'>
      <h2 className='stu-insp__title'>Properties</h2>
      {!selected ? (
        <div className='stu-insp__empty'>
          <MousePointer2 size={20} aria-hidden='true' />
          <p>Select a station or pipe to inspect and edit its draft properties.</p>
        </div>
      ) : (
        <div className='stu-insp__body' key={`${selection.type}:${selected.id}`}>
          <p className='stu-insp__selected'>
            <span className='stu-insp__type'>{typeName[0].toUpperCase() + typeName.slice(1)}</span>
            <code className='stu-insp__id'>{selected.id}</code>
          </p>
          <section className='stu-insp__group'>
            <h3>Identity</h3>
            <StudioField label='Object ID' value={selected.id} readOnly onCommit={() => {}} />
            <StudioField
              label='Display label'
              value={label}
              onCommit={(value) => onField(selected.id, 'label', value, 'label')}
            />
          </section>
          {selectedNode && (
            <section className='stu-insp__group'>
              <h3>Node data</h3>
              <StudioField
                label={selectedNode.type === 'reservoir' ? 'Head / elevation' : 'Elevation'}
                unit='m'
                type='number'
                min='0'
                step='0.1'
                value={selectedNode.elevation_m}
                onCommit={(value) => commitNumber('elevation_m', value)}
              />
              {selectedNode.type === 'junction' && (
                <StudioField
                  label='Base demand'
                  unit='L/s'
                  type='number'
                  min='0'
                  step='0.01'
                  value={selectedNode.base_demand_lps}
                  onCommit={(value) => commitNumber('base_demand_lps', value)}
                />
              )}
              {selectedNode.type === 'tank' && (
                <p className='stu-insp__note'>Tank level fields are not part of the current HydroPulse network contract.</p>
              )}
            </section>
          )}
          {selectedPipe && (
            <section className='stu-insp__group'>
              <h3>Pipe data</h3>
              <StudioField label='Source node' value={selectedPipe.source} readOnly onCommit={() => {}} />
              <StudioField label='Target node' value={selectedPipe.target} readOnly onCommit={() => {}} />
              <StudioField
                label='Diameter'
                unit='mm'
                type='number'
                min='0'
                step='1'
                value={selectedPipe.diameter_mm}
                onCommit={(value) => commitNumber('diameter_mm', value)}
              />
              <StudioField
                label='Length'
                unit='m'
                type='number'
                min='0'
                step='1'
                value={selectedPipe.length_m}
                onCommit={(value) => commitNumber('length_m', value)}
              />
              <Field label='Status' htmlFor='stu-insp-status'>
                <Select
                  id='stu-insp-status'
                  value={selectedPipe.status || 'OPEN'}
                  onChange={(value) => onField(selected.id, 'status', value, 'pipe')}
                  options={[
                    { value: 'OPEN', label: 'Open' },
                    { value: 'CLOSED', label: 'Closed' },
                  ]}
                />
              </Field>
              <p className='stu-insp__note'>Roughness and material are not stored in the current network contract.</p>
            </section>
          )}
          <section className='stu-insp__group'>
            <h3>Notes</h3>
            <StudioNotesField
              value={notesMap[selected.id] || ''}
              onCommit={(value) => onField(selected.id, 'notes', value, 'notes')}
            />
          </section>
          <Button className='stu-insp__delete' icon={X} onClick={() => onRemove(selection)}>
            {selectedPipe ? 'Delete pipe' : 'Delete node'}
          </Button>
        </div>
      )}
    </aside>
  );
}
