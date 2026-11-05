import { useMemo, useState } from 'react';
import {
  Activity,
  Droplet,
  RotateCcw,
  Search,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {
  Button,
  Field,
  Kbd,
  Panel,
  Select,
  Slider,
  Switch,
} from '../ui/index.js';
import { holeLabel } from '../lib/format.js';
import '../styles/ops/control.css';

const DEFAULT_PRESETS = [
  {
    id: 'kengeri_mainline_rupture',
    label: 'Kengeri Mainline Rupture',
    description: '45 cm² rupture on primary distribution corridor',
    target_node_id: 'J35',
    leak_area_cm2: 45.0,
    noise_pct: 1.5,
  },
  {
    id: 'residential_lane_seep',
    label: 'Residential Lane Seep',
    description: '8 cm² seep in residential perimeter dead-end lane',
    target_node_id: 'J80',
    leak_area_cm2: 8.0,
    noise_pct: 3.0,
  },
  {
    id: 'joint_crack_junction',
    label: 'Joint Crack under Junction',
    description: '20 cm² cracked joint at secondary intersection',
    target_node_id: 'J44',
    leak_area_cm2: 20.0,
    noise_pct: 2.0,
  },
];

export default function ControlPanel({
  network,
  presets = [],
  selected = 'J15',
  setSelected,
  onSelectedChange,
  area = 25,
  setArea,
  onAreaChange,
  noise = 1.5,
  setNoise,
  onNoiseChange,
  onSimulate,
  onIsolate,
  onReset,
  phase = 'idle',
  judge = false,
  setJudge,
  onJudgeToggle,
  onReveal,
  revealed = false,
  showTruth,
  mode = 'mock',
}) {
  const [query, setQuery] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState(null);

  const handleSelectedChange = (val) => {
    onSelectedChange?.(val);
    setSelected?.(val);
  };

  const handleAreaChange = (val) => {
    const num = Number(val);
    onAreaChange?.(num);
    setArea?.(num);
  };

  const handleNoiseChange = (val) => {
    const num = Number(val);
    onNoiseChange?.(num);
    setNoise?.(num);
  };

  const handleJudgeToggle = (checked) => {
    onJudgeToggle?.(checked);
    setJudge?.(checked);
  };

  const effectiveJudge = Boolean(judge);
  const effectiveRevealed = Boolean(revealed || showTruth);

  const handleRevealToggle = () => {
    onReveal?.(!effectiveRevealed);
  };

  // Only junctions, filter out reservoirs and tanks
  const junctions = useMemo(() => {
    if (!network?.nodes) return [];
    return network.nodes.filter((n) => {
      if (n.type) return n.type === 'junction';
      const id = String(n.id || '').toUpperCase();
      return !id.startsWith('R') && !id.startsWith('T');
    });
  }, [network]);

  const selectOptions = useMemo(() => {
    const opts = junctions.map((j) => ({
      value: j.id,
      label: j.households ? `${j.id} (${j.households} households)` : j.id,
    }));
    if (selected && !junctions.some((j) => j.id === selected)) {
      return [{ value: selected, label: `${selected} (Custom)` }, ...opts];
    }
    return opts;
  }, [junctions, selected]);

  const searchMatches = useMemo(() => {
    const term = (query !== null ? query : (selected || '')).trim().toLowerCase();
    if (!term) return junctions.slice(0, 7);
    return junctions
      .filter((n) => n.id.toLowerCase().includes(term))
      .slice(0, 7);
  }, [junctions, query, selected]);

  const presetList = useMemo(() => {
    if (presets && presets.length >= 3) return presets.slice(0, 3);
    return DEFAULT_PRESETS;
  }, [presets]);

  const handlePresetClick = (p) => {
    const targetId = p.target_node_id ?? p.target_junction_id ?? 'J15';
    const leakArea = p.leak_area_cm2 ?? p.area_cm2 ?? 25;
    const noisePct = p.noise_pct ?? 1.5;

    setSelectedPresetId(p.id);
    handleSelectedChange(targetId);
    handleAreaChange(leakArea);
    handleNoiseChange(noisePct);
    setQuery(null);

    onSimulate?.(
      {
        target_node_id: targetId,
        target_junction_id: targetId,
        leak_area_cm2: leakArea,
        noise_pct: noisePct,
        seed: null,
      },
      p,
    );
  };

  const handleSimulateBurst = () => {
    const targetId = selected || 'J15';
    const leakArea = Number(area) || 25;
    const noisePct = Number(noise) || 1.5;

    onSimulate?.(
      {
        target_node_id: targetId,
        target_junction_id: targetId,
        leak_area_cm2: leakArea,
        noise_pct: noisePct,
        seed: null,
      },
      null,
    );
  };

  return (
    <Panel as="aside" className="control-panel" title="Simulate">
      <div className="control-content">
        {/* Scenario Presets Section */}
        <section aria-labelledby="section-quick-scenarios">
          <div className="control-section-header" id="section-quick-scenarios">
            <span>Quick scenarios</span>
            <span className="control-section-hint">Select to run</span>
          </div>
          <div className="preset-list" role="group" aria-label="Preset scenarios">
            {presetList.map((p, index) => {
              const keyHint = String(index + 1);
              const isActive = selectedPresetId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`preset-card ${isActive ? 'preset-card--active' : ''}`}
                  disabled={!network || phase === 'simulating'}
                  onClick={() => handlePresetClick(p)}
                  aria-label={`${p.label}: ${p.description}`}
                >
                  <span className="preset-icon" aria-hidden="true">
                    <Zap size={14} />
                  </span>
                  <span className="preset-content">
                    <span className="preset-label">{p.label}</span>
                    <span className="preset-desc">{p.description}</span>
                  </span>
                  <Kbd>{keyHint}</Kbd>
                </button>
              );
            })}
          </div>
        </section>

        {/* Burst Parameters Section */}
        <section aria-labelledby="section-burst-params">
          <div className="control-section-header" id="section-burst-params">
            <span>Burst parameters</span>
            <span className="control-section-hint">Configurable</span>
          </div>

          <Field
            label="Target junction"
            htmlFor="target-junction-search"
            hint={effectiveJudge ? 'Hidden in judge mode' : 'Search junction ID or select below'}
          >
            <div className="target-junction-selector">
              <div className="junction-search-wrap">
                <Search size={14} className="junction-search-icon" aria-hidden="true" />
                <input
                  id="target-junction-search"
                  type="text"
                  className="junction-search-input"
                  placeholder="Search junction e.g. J15"
                  aria-label="Search target junction"
                  disabled={effectiveJudge}
                  value={query !== null ? query : (selected || '')}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setQuery(val);
                    handleSelectedChange(val);
                    setDropdownOpen(true);
                  }}
                  onFocus={() => {
                    if (query === null) setQuery(selected || '');
                    setDropdownOpen(true);
                  }}
                  onBlur={() => {
                    setTimeout(() => setDropdownOpen(false), 200);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (searchMatches[0]) {
                        handleSelectedChange(searchMatches[0].id);
                        setQuery(null);
                        setDropdownOpen(false);
                      }
                    } else if (e.key === 'Escape') {
                      setDropdownOpen(false);
                    }
                  }}
                />
                {dropdownOpen && !effectiveJudge && searchMatches.length > 0 && (
                  <div
                    className="junction-quick-matches"
                    role="listbox"
                    aria-label="Junction matches"
                  >
                    {searchMatches.map((node) => (
                      <button
                        key={node.id}
                        type="button"
                        className="junction-match-item"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectedChange(node.id);
                          setQuery(null);
                          setDropdownOpen(false);
                        }}
                      >
                        <span className="match-id">{node.id}</span>
                        {node.households && (
                          <span className="match-meta">{node.households} hh</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Select
                id="target-junction-select"
                aria-label="Select target junction"
                disabled={effectiveJudge}
                value={selected || ''}
                onChange={(val) => {
                  if (val) {
                    handleSelectedChange(val);
                    setQuery(null);
                  }
                }}
                options={[
                  { value: '', label: 'Or choose from list…' },
                  ...selectOptions,
                ]}
              />
            </div>
          </Field>

          {/* Sliders */}
          <div className="control-slider-block">
            <Slider
              id="leak-area-slider"
              label="Leak area"
              value={Number(area)}
              min={0.5}
              max={100}
              step={0.5}
              unit="cm²"
              format={(v) => `${Number(v).toFixed(1)} cm²`}
              onChange={handleAreaChange}
              aria-label="Leak hole area"
            />
            <div className="slider-meta-row">
              <span className="slider-range-bound">0.5 cm²</span>
              <span className="slider-hole-desc">
                <Droplet size={12} aria-hidden="true" />
                {holeLabel(Number(area))}
              </span>
              <span className="slider-range-bound">100 cm²</span>
            </div>
          </div>

          <div className="control-slider-block">
            <Slider
              id="noise-slider"
              label="Noise percentage"
              value={Number(noise)}
              min={0}
              max={10}
              step={0.1}
              unit="%"
              format={(v) => `${Number(v).toFixed(1)}%`}
              onChange={handleNoiseChange}
              aria-label="Sensor noise"
            />
            <div className="slider-meta-row">
              <span className="slider-range-bound">0.0%</span>
              <span className="slider-range-bound">10.0%</span>
            </div>
          </div>
        </section>

        {/* Judge Mode Section */}
        <div className="judge-section">
          <div className="judge-row">
            <div className="judge-label-group">
              <span className="judge-title">
                Judge mode <Kbd>J</Kbd>
              </span>
              <span className="judge-subtitle">Blind injection test</span>
            </div>
            <Switch
              id="judge-mode-switch"
              checked={effectiveJudge}
              onChange={handleJudgeToggle}
              aria-label="Judge mode"
            />
          </div>
          {effectiveJudge && (
            <Button
              variant="secondary"
              size="sm"
              className="reveal-button control-btn-full"
              kbd="V"
              onClick={handleRevealToggle}
            >
              {effectiveRevealed ? 'Hide truth' : 'Reveal truth'}
            </Button>
          )}
        </div>

        {/* Action Buttons Section */}
        <div className="action-section">
          <Button
            variant="primary"
            size="md"
            className="simulate-button control-btn-full"
            busy={phase === 'simulating'}
            disabled={!network || phase === 'simulating'}
            icon={Activity}
            kbd="Space"
            onClick={handleSimulateBurst}
          >
            {!network
              ? 'Connecting…'
              : phase === 'simulating'
                ? 'Scanning network…'
                : 'Simulate burst'}
          </Button>

          <div className="action-row-split">
            <Button
              variant="secondary"
              size="md"
              className="isolate-button control-btn-flex"
              disabled={!['located', 'isolated'].includes(phase)}
              icon={ShieldCheck}
              kbd="I"
              onClick={onIsolate}
            >
              Isolate valves
            </Button>

            <Button
              variant="secondary"
              size="md"
              className="reset-button control-btn-flex"
              icon={RotateCcw}
              kbd="R"
              onClick={onReset}
              aria-label="Reset simulation"
            >
              Reset
            </Button>
          </div>
        </div>
      </div>
    </Panel>
  );
}
