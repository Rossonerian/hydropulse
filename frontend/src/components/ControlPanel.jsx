import { useEffect, useId, useMemo, useState } from 'react';
import { Play, RotateCcw, Search, SlidersHorizontal, Zap } from 'lucide-react';
import { Button, Field, Select, Slider, Switch } from '../ui/index.js';
import { LEAK_SIZES, getPresetList, sizeForArea } from '../lib/opsFlow.js';
import '../styles/ops/control.css';

/**
 * Left panel of the Operations screen.
 *   1. "START DHARA DEMO": 1-click deterministic live demo runner.
 *   2. "Pick a problem to try": 3 preset cards. A click SELECTS a problem; it does not run it.
 *   3. "Or choose your own spot" (collapsed): search, list and leak size.
 *   4. Footer: progress chips + the one contextual primary button (passed in as `footer`), Reset and Advanced.
 */
export default function ControlPanel({
  network,
  presets = [],
  selected = '',
  picked = false,
  activePresetId = null,
  area = 25,
  noise = 1.5,
  judge = false,
  revealed = false,
  phase = 'idle',
  footer,
  onStartDemo,
  onSelectPreset,
  onPickSpot,
  onSizeChange,
  onNoiseChange,
  onJudgeToggle,
  onReveal,
  onReset,
}) {
  const uid = useId();
  const [query, setQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [ownSpotOpen, setOwnSpotOpen] = useState(false);

  // Auto-open custom spot section when a map node is picked without a preset
  useEffect(() => {
    if (picked && !activePresetId) {
      setOwnSpotOpen(true);
    }
  }, [picked, activePresetId, selected]);

  const busy = phase === 'simulating';
  const presetList = useMemo(() => getPresetList(presets), [presets]);

  const junctions = useMemo(() => {
    if (!network?.nodes) return [];
    return network.nodes.filter((n) => (n.type ? n.type === 'junction' : true));
  }, [network]);

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    const pool = term ? junctions.filter((n) => n.id.toLowerCase().includes(term)) : junctions;
    return pool.slice(0, 7);
  }, [junctions, query]);

  const choose = (id) => {
    onPickSpot?.(id);
    setQuery('');
    setDropdownOpen(false);
  };

  const size = sizeForArea(area);
  const sizeText = size ? `${size.label} (${area} cm²)` : `${area} cm²`;

  return (
    <aside className="control-panel" aria-label="Pick a problem">
      <div className="control-scroll">
        <div className="demo-launcher-section">
          <Button
            variant="primary"
            size="lg"
            className="btn--start-demo"
            disabled={!network || busy}
            onClick={onStartDemo}
            icon={Play}
            aria-label="Start DHARA live demo"
          >
            START DHARA DEMO
          </Button>
          <span className="demo-launcher-sub">
            Deterministic 5-sentinel leak test on Kengeri DMA (J1 · 45 cm²)
          </span>
        </div>

        <section aria-labelledby={`${uid}-pick`} data-tour="presets">
          <h2 className="control-title" id={`${uid}-pick`}>
            Pick a problem to try
          </h2>
          <div className="preset-list" role="group" aria-labelledby={`${uid}-pick`}>
            {presetList.map((p) => {
              const active = activePresetId === p.id && (!selected || selected === p.target_node_id);
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`preset-card ${active ? 'preset-card--active' : ''}`}
                  disabled={!network || busy}
                  aria-pressed={active}
                  onClick={() => onSelectPreset?.(p)}
                >
                  <span className="preset-icon" aria-hidden="true">
                    <Zap size={16} />
                  </span>
                  <span className="preset-content">
                    <span className="preset-label">{p.label}</span>
                    <span className="preset-desc">{p.description}</span>
                    <span className="preset-meta">
                      {judge ? '' : `${p.target_node_id} · `}
                      {p.leak_area_cm2} cm²
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <details
          className="own-spot"
          open={ownSpotOpen}
          onToggle={(e) => setOwnSpotOpen(e.currentTarget.open)}
        >
          <summary>Or choose your own spot</summary>
          <div className="own-spot__body">
            <Field
              label="Where on the network"
              htmlFor={`${uid}-search`}
              hint={judge ? 'Hidden in the blind test' : picked && !activePresetId ? `Selected: ${selected}` : undefined}
            >
              <div className="target-junction-selector">
                <div className="junction-search-wrap">
                  <Search size={14} className="junction-search-icon" aria-hidden="true" />
                  <input
                    id={`${uid}-search`}
                    type="text"
                    className="junction-search-input"
                    placeholder="Find a spot (e.g. J15)"
                    autoComplete="off"
                    disabled={judge}
                    value={query}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setQuery(val);
                      setDropdownOpen(true);
                      if (junctions.some((n) => n.id === val)) onPickSpot?.(val);
                    }}
                    onFocus={() => setDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && matches[0]) {
                        e.preventDefault();
                        choose(matches[0].id);
                      } else if (e.key === 'Escape') {
                        setDropdownOpen(false);
                      }
                    }}
                  />
                  {dropdownOpen && !judge && matches.length > 0 && (
                    <div className="junction-quick-matches" role="listbox" aria-label="Matching spots">
                      {matches.map((node) => (
                        <button
                          key={node.id}
                          type="button"
                          role="option"
                          aria-selected={node.id === selected && picked}
                          className="junction-match-item"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            choose(node.id);
                          }}
                        >
                          <span className="match-id">{node.id}</span>
                          {node.households ? <span className="match-meta">{node.households} homes</span> : null}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Select
                  id={`${uid}-list`}
                  aria-label="Choose a spot from the list"
                  disabled={judge}
                  value={picked && !activePresetId && !judge ? selected : ''}
                  onChange={(val) => val && choose(val)}
                  options={[
                    { value: '', label: 'Or choose from the list…' },
                    ...junctions.map((j) => ({
                      value: j.id,
                      label: j.households ? `${j.id} (${j.households} homes)` : j.id,
                    })),
                  ]}
                />
              </div>
            </Field>

            <div className="leak-size" role="radiogroup" aria-label="Leak size">
              <span className="leak-size__label">Leak size: {sizeText}</span>
              <div className="leak-size__options">
                {LEAK_SIZES.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    role="radio"
                    aria-checked={Number(area) === s.area}
                    className="leak-size__btn"
                    onClick={() => onSizeChange?.(s.area)}
                  >
                    <span>{s.label}</span>
                    <small>{s.area} cm²</small>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </details>
      </div>

      <div className="control-footer">
        {advancedOpen && (
          <div className="advanced" id={`${uid}-advanced`}>
            <div className="advanced__row">
              <div className="advanced__text">
                <label htmlFor={`${uid}-blind`} className="advanced__title">
                  Blind test (hides the answer)
                </label>
                <span className="advanced__sub">The real leak spot stays hidden until you show it.</span>
              </div>
              <Switch
                id={`${uid}-blind`}
                checked={Boolean(judge)}
                onChange={(checked) => onJudgeToggle?.(checked)}
                aria-label="Blind test"
              />
            </div>
            {judge && (
              <Button variant="secondary" size="sm" className="advanced__reveal" onClick={() => onReveal?.(!revealed)}>
                {revealed ? 'Hide the real leak spot' : 'Show the real leak spot'}
              </Button>
            )}
            <Slider
              id={`${uid}-noise`}
              label="Sensor noise"
              value={Number(noise)}
              min={0}
              max={10}
              step={0.1}
              format={(v) => `${Number(v).toFixed(1)}%`}
              onChange={(v) => onNoiseChange?.(Number(v))}
              aria-label="Sensor noise"
            />
          </div>
        )}
        {footer}
        <div className="control-footer__row">
          <Button variant="ghost" size="sm" icon={RotateCcw} onClick={onReset} aria-label="Reset and start over">
            Reset
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={SlidersHorizontal}
            aria-expanded={advancedOpen}
            aria-controls={`${uid}-advanced`}
            onClick={() => setAdvancedOpen((v) => !v)}
          >
            Advanced
          </Button>
        </div>
      </div>
    </aside>
  );
}
