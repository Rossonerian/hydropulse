import { useEffect, useId, useMemo, useState } from 'react';
import { MousePointer2, X } from 'lucide-react';
import { Button, Field, Select } from '../../ui/index.js';
import IntelliSenseBlock from './IntelliSenseBlock.jsx';
import PipeConditionPanel from '../../components/PipeConditionPanel.jsx';
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

/** Size advice for a pipe: only asks the backend when both ends are real junctions of the live network. */
function PipeAdvice({ pipe, liveNetwork, live, onUseDiameter }) {
  const liveIds = useMemo(() => new Set((liveNetwork?.nodes || []).map((node) => node.id)), [liveNetwork]);
  const known = liveIds.has(pipe.source) && liveIds.has(pipe.target);
  return (
    <section className='stu-insp__group' aria-label='Size advice'>
      <h3>Size advice</h3>
      {known ? (
        <IntelliSenseBlock
          fromNodeId={pipe.source}
          toNodeId={pipe.target}
          networkRevision={liveNetwork?.network_revision}
          live={live}
          onUseDiameter={onUseDiameter}
        />
      ) : (
        <p className='stu-insp__note'>Connect to existing junctions to get size advice.</p>
      )}
    </section>
  );
}

/** Hydraulic load of the pipes. Fetches only once the section is opened. */
function PipeConditionSection({ liveNetwork, live }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className='stu-insp__details'
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Pipe condition (no remaining-life data)</summary>
      {open && <PipeConditionPanel networkRevision={liveNetwork?.network_revision} live={live} />}
    </details>
  );
}

export default function PropertiesPanel({ draft, selection, onField, onRemove, liveNetwork, live = true }) {
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
          <p>Select a station or pipe to see and edit its details.</p>
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
          {selectedPipe && (
            <>
              <PipeAdvice
                pipe={selectedPipe}
                liveNetwork={liveNetwork}
                live={live}
                onUseDiameter={(mm) => onField(selected.id, 'diameter_mm', mm, 'pipe')}
              />
              <PipeConditionSection liveNetwork={liveNetwork} live={live} />
            </>
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
