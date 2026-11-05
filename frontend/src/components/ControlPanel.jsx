import { useMemo, useState } from 'react';
import {
  Activity,
  ChevronDown,
  Droplet,
  RotateCcw,
  Search,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { holeLabel } from '../lib/format.js';
import SkeletonLoader from './SkeletonLoader.jsx';

export default function ControlPanel({
  network,
  presets,
  selected,
  setSelected,
  area,
  setArea,
  noise,
  setNoise,
  onSimulate,
  onIsolate,
  onReset,
  phase,
  judge,
  setJudge,
  onReveal,
  revealed,
  mode,
  simulateCooldown = 0,
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  // The target picker intentionally offers junctions only, never reservoirs or tanks.
  const nodes = useMemo(
    () => network?.nodes?.filter((n) => n.type === 'junction') || [],
    [network],
  );

  const matches = nodes
    .filter((n) =>
      n.id.toLowerCase().includes((query || selected || '').toLowerCase()),
    )
    .slice(0, 7);

  return (
    <aside className='control-panel' aria-label='Incident Control Response Desk'>
      <div className='panel-title-row'>
        <div>
          <div className='eyebrow'>INCIDENT CONTROL</div>
          <h2>Response desk</h2>
        </div>
        <span className='section-number'>01</span>
      </div>

      <div className='section-label'>
        <span>QUICK SCENARIOS</span>
        <span className='small-muted'>SELECT TO RUN</span>
      </div>

      <div className='preset-list'>
        {!network || presets.length === 0 ? (
          <SkeletonLoader variant='summary' count={3} />
        ) : (
          presets.map((p, i) => (
            <button
              key={p.id}
              className='preset-card'
              disabled={!network || phase === 'simulating' || simulateCooldown > 0}
              title={`Run preset scenario: ${p.label} (${p.leak_area_cm2} cm²)`}
              onClick={() => {
                setSelected(p.target_node_id);
                setQuery('');
                setArea(p.leak_area_cm2);
                setNoise(p.noise_pct);
                onSimulate(
                  {
                    target_node_id: p.target_node_id,
                    leak_area_cm2: p.leak_area_cm2,
                    noise_pct: p.noise_pct,
                    seed: null,
                  },
                  p.id,
                );
              }}
              type='button'
            >
              <span className={`preset-icon preset-${i}`}>
                <Zap size={15} />
              </span>
              <span className='preset-copy'>
                <b>{p.label}</b>
                <small>{p.description}</small>
              </span>
              <ChevronDown className='preset-arrow' size={15} />
            </button>
          ))
        )}
      </div>

      <div className='form-section'>
        <div className='section-label'>
          <span>BURST PARAMETERS</span>
          <span className='live-tag'>
            <span />
            CONFIGURABLE
          </span>
        </div>

        <label className='field-label'>
          Target junction{' '}
          <span className='field-note'>J1..J{nodes.length || 196}</span>
        </label>
        <div className='target-picker'>
          <div
            className='picker-display'
            onClick={() => setOpen((prev) => !prev)}
            role='button'
            tabIndex={0}
            aria-expanded={open}
            aria-label='Select target junction'
          >
            <Search size={14} />
            <span>{selected || 'Choose junction'}</span>
            <ChevronDown size={14} className={open ? 'rotated' : ''} />
          </div>
          {open && (
            <div className='picker-dropdown'>
              <input
                autoFocus
                type='text'
                placeholder='Search node ID…'
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label='Search junction by ID'
              />
              <div className='picker-options'>
                {matches.map((n) => (
                  <button
                    key={n.id}
                    type='button'
                    className={`picker-option ${selected === n.id ? 'active' : ''}`}
                    onClick={() => {
                      setSelected(n.id);
                      setOpen(false);
                      setQuery('');
                    }}
                  >
                    <span>{n.id}</span>
                    <small>
                      {n.base_pressure_m?.toFixed(1)} m · {n.households} hh
                    </small>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className='slider-label-row'>
          <label className='field-label'>
            Leak hole area <span className='field-note'>0.5–100 cm²</span>
          </label>
          <span className='slider-metric'>
            <b>{area}</b> cm² <small>({holeLabel(area)})</small>
          </span>
        </div>
        <input
          aria-label='Leak hole area in cm²'
          className='range area-range'
          type='range'
          min='0.5'
          max='100'
          step='0.5'
          value={area}
          onChange={(e) => setArea(Number(e.target.value))}
        />
        <div className='range-scale'>
          <span>0.5 cm²</span>
          <span>50 cm²</span>
          <span>100 cm²</span>
        </div>

        <div className='slider-label-row'>
          <label className='field-label'>
            Sensor noise <span className='field-note'>Gaussian sigma</span>
          </label>
          <span className='slider-metric'>
            <b>{noise}%</b> <small>std dev</small>
          </span>
        </div>
        <input
          aria-label='Sensor noise percentage'
          className='range noise-range'
          type='range'
          min='0'
          max='10'
          step='0.1'
          value={noise}
          onChange={(e) => setNoise(Number(e.target.value))}
        />
        <div className='range-scale'>
          <span>0%</span>
          <span>5%</span>
          <span>10%</span>
        </div>
      </div>

      <div className='judge-row'>
        <span className='judge-icon'>
          <ShieldCheck size={15} />
        </span>
        <div>
          <b>
            Judge mode <small>BLIND</small>
          </b>
          <p>Hide injected junction until revealed</p>
        </div>
        <button
          className={`switch ${judge ? 'on' : ''}`}
          role='switch'
          aria-checked={judge}
          aria-label='Toggle judge mode (J)'
          title='Toggle blind judge mode (J)'
          onClick={() => {
            setJudge(!judge);
            onReveal(false);
          }}
          type='button'
        >
          <span />
        </button>
      </div>

      {judge && phase !== 'idle' && (
        <button
          className='reveal-button'
          onClick={() => onReveal(!revealed)}
          title='Reveal ground truth injected node (V)'
          type='button'
        >
          {revealed ? 'Hide truth' : 'Reveal truth'}
        </button>
      )}

      <div className='action-row'>
        <button
          className='simulate-button'
          disabled={!network || phase === 'simulating' || simulateCooldown > 0}
          title={
            !network
              ? 'Loading network data…'
              : phase === 'simulating'
                ? 'Pressure signature simulation in progress…'
                : simulateCooldown > 0
                  ? `Cooldown in progress (${simulateCooldown}s)`
                  : 'Execute Torricelli leak burst simulation (Space)'
          }
          onClick={() =>
            onSimulate(
              {
                target_node_id: selected || 'J15',
                leak_area_cm2: Number(area),
                noise_pct: Number(noise),
                seed: null,
              },
              null,
            )
          }
          type='button'
        >
          <Activity size={16} />
          {!network
            ? 'Connecting…'
            : phase === 'simulating'
              ? 'Scanning network…'
              : simulateCooldown > 0
                ? `Cooldown (${simulateCooldown}s)`
                : 'Simulate burst'}
          <kbd>SPACE</kbd>
        </button>

        <button
          className='reset-button'
          aria-label='Reset incident simulation (R)'
          title='Reset incident simulation (R)'
          onClick={onReset}
          type='button'
        >
          <RotateCcw size={15} />
        </button>
      </div>

      <button
        className='isolate-button'
        disabled={!['located', 'isolated'].includes(phase)}
        title={
          !['located', 'isolated'].includes(phase)
            ? 'Run leak simulation to generate isolation valve closure recommendations'
            : 'Execute isolation valve closure plan (I)'
        }
        onClick={onIsolate}
        type='button'
      >
        <ShieldCheck size={15} />
        Isolate valves <kbd>I</kbd>
      </button>

      <div className='panel-foot'>
        <span className={`api-connection ${mode}`}>
          <span />
          {mode === 'live'
            ? 'API connected'
            : mode === 'mock'
              ? 'Local simulation'
              : 'Recorded data active'}
        </span>
        <span>v1.1.0 · Lakshya Track 02</span>
      </div>
    </aside>
  );
}
