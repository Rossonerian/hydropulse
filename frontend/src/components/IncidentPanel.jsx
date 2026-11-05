import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Droplet,
  MapPinned,
  Truck,
} from 'lucide-react';
import { Button, DataTable } from '../ui/index.js';
import { number } from '../lib/format.js';
import '../styles/ops/incident.css';

function CountUp({ value, digits = 0 }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const duration = 800;
    const start = performance.now();
    const animate = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      setN(value * progress);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value]);
  return <>{number(n, digits)}</>;
}

export default function IncidentPanel({
  network,
  result,
  lastResult,
  phase,
  onFocus,
  onSelectNode,
  showTruth,
  mode,
  judge,
  errorMeters,
  error,
  onIsolate,
  onReset,
  onJudgeToggle,
  onReveal,
  onSimulate,
}) {
  const data = result || lastResult;
  const nodes = network?.nodes || [];
  const pipes = network?.pipes || [];
  const sensors = network?.sensor_ids || [];

  // Network summary for idle phase
  const junctions = nodes.filter((n) => n.type === 'junction').length || nodes.length;
  const pipeCount = pipes.length;
  const sensorCount = sensors.length;
  const households = nodes.reduce((a, n) => a + (n.households || 0), 0);
  const pressures = nodes.map((n) => n.base_pressure_m || 0).filter((p) => p > 0);
  const minPressure = pressures.length ? Math.min(...pressures) : 0;
  const avgPressure = pressures.length
    ? pressures.reduce((a, b) => a + b, 0) / pressures.length
    : 0;

  // Result-derived values
  const totalLoss = data?.actual_loss_lpm || 0;
  const tankers = Math.round((totalLoss * 1440 / 6000) * 10) / 10;
  const affectedHouseholds = data?.affected_households_after_isolation || 0;
  const supplied = Math.max(
    0,
    100 - (affectedHouseholds / Math.max(households, 1)) * 100,
  );
  const topCandidate = data?.predicted_top_candidates?.[0];
  const predictedNode = topCandidate?.node_id || data?.injected_node_id;

  // Candidate table data
  const candidateRows = (data?.predicted_top_candidates || []).map((c, i) => ({
    rank: i + 1,
    node_id: c.node_id,
    confidence_pct: c.confidence_pct,
    estimated_loss_lpm: c.estimated_loss_lpm,
  }));

  const candidateColumns = [
    {
      key: 'rank',
      label: '#',
      align: 'center',
      render: (v) => `#${v}`,
    },
    { key: 'node_id', label: 'Node ID' },
    {
      key: 'confidence_pct',
      label: 'Match score',
      align: 'right',
      render: (v) => `${number(v, 1)}%`,
    },
    {
      key: 'estimated_loss_lpm',
      label: 'Est. loss',
      align: 'right',
      render: (v) => `${number(v, 1)} L/min`,
    },
  ];

  const handleCandidateClick = (row) => {
    const node = nodes.find((n) => n.id === row.node_id);
    if (onFocus && node) {
      onFocus(node);
    } else if (onSelectNode) {
      onSelectNode(row.node_id);
    }
  };

  const handleRetry = () => {
    if (onSimulate) {
      onSimulate();
    } else if (onReset) {
      onReset();
    }
  };

  return (
    <aside className='incident-panel'>
      {/* Phase-specific header */}
      {phase === 'idle' && (
        <div className='incident-header'>
          <h2>No active incident</h2>
          <p className='incident-description'>
            Select a scenario preset or junction to simulate a burst.
          </p>
        </div>
      )}

      {phase === 'simulating' && (
        <div className='incident-header'>
          <h2>Simulating leak scenario</h2>
          <p className='incident-description'>
            {mode === 'live' ? 'Solving with WNTR…' : 'Loading recorded result…'}
          </p>
          <div className='simulating-progress'>
            <div className='simulating-progress-bar' />
          </div>
        </div>
      )}

      {phase === 'located' && data && (
        <div className='incident-header incident-header--leak'>
          <h2>
            Leak near <strong>{predictedNode}</strong>
          </h2>
          <p className='incident-id'>{data.injected_node_id}</p>
        </div>
      )}

      {phase === 'isolated' && data && (
        <div className='incident-header'>
          <h2>Isolation confirmed</h2>
          <p className='incident-description'>
            Valves closed to isolate the leak.
          </p>
        </div>
      )}

      {phase === 'error' && (
        <div className='incident-header incident-header--error'>
          <h2>
            <AlertTriangle size={18} /> Simulation failed
          </h2>
          <p className='incident-description'>
            {error || 'An error occurred during simulation.'}
          </p>
          <Button onClick={handleRetry} variant='primary'>
            Retry
          </Button>
        </div>
      )}

      {/* Phase-specific content */}
      {phase === 'idle' && (
        <div className='incident-content'>
          {network ? (
            <div className='network-summary'>
              <h3>Network summary</h3>
              <div className='summary-grid'>
                <div className='summary-item'>
                  <span className='summary-label'>Junctions</span>
                  <span className='summary-value'>{number(junctions)}</span>
                </div>
                <div className='summary-item'>
                  <span className='summary-label'>Pipes</span>
                  <span className='summary-value'>{number(pipeCount)}</span>
                </div>
                <div className='summary-item'>
                  <span className='summary-label'>Sensors</span>
                  <span className='summary-value'>{number(sensorCount)}</span>
                </div>
                <div className='summary-item'>
                  <span className='summary-label'>Households</span>
                  <span className='summary-value'>{number(households)}</span>
                </div>
                <div className='summary-item'>
                  <span className='summary-label'>Min pressure</span>
                  <span className='summary-value'>{number(minPressure, 1)} m</span>
                </div>
                <div className='summary-item'>
                  <span className='summary-label'>Avg pressure</span>
                  <span className='summary-value'>{number(avgPressure, 1)} m</span>
                </div>
              </div>
            </div>
          ) : (
            <div className='network-summary'>
              <h3>Network summary</h3>
              <p className='incident-description'>
                Network data not available.
              </p>
            </div>
          )}
        </div>
      )}

      {phase === 'simulating' && (
        <div className='incident-content'>
          <div className='simulating-status'>
            <Activity size={24} className='simulating-icon' />
            <p>Running hydraulic simulation…</p>
          </div>
        </div>
      )}

      {(phase === 'located' || phase === 'isolated') && data && (
        <div className='incident-content'>
          {/* Metrics */}
          <div className='incident-metrics'>
            <div className='metric-card'>
              <span className='metric-label'>Estimated loss</span>
              <span className='metric-value type-value-lg'>
                <CountUp value={totalLoss} digits={1} /> <small>L/min</small>
              </span>
            </div>
            <div className='metric-card'>
              <span className='metric-label'>Tankers/day</span>
              <span className='metric-value'>
                <Truck size={14} /> {number(tankers, 1)}
              </span>
            </div>
            <div className='metric-card'>
              <span className='metric-label'>Est. hole area</span>
              <span className='metric-value'>
                {number(
                  topCandidate?.estimated_leak_area_cm2 ||
                    data.injected_leak_area_cm2,
                  1,
                )}{' '}
                cm²
              </span>
            </div>
          </div>

          {/* Candidates table */}
          {phase === 'located' && (
            <div className='incident-section'>
              <h3>Candidate locations</h3>
              <DataTable
                columns={candidateColumns}
                rows={candidateRows}
                rowKey='node_id'
                onRowClick={handleCandidateClick}
                caption='Shape match of the sensor fingerprint, not a probability.'
              />
            </div>
          )}

          {/* Isolation details */}
          {phase === 'isolated' && (
            <div className='incident-section'>
              <h3>Isolation plan</h3>
              <div className='valve-list'>
                {(data.recommended_valves_to_close || []).map((id) => (
                  <span key={id} className='valve-item'>
                    <span className='valve-indicator' />
                    {id}
                  </span>
                ))}
              </div>
              <div className='supply-info'>
                <div className='supply-header'>
                  <span>Ward still supplied</span>
                  <span className='supply-value'>{number(supplied, 1)}%</span>
                </div>
                <div className='supply-bar'>
                  <div
                    className='supply-bar-fill'
                    style={{ width: `${supplied}%` }}
                  />
                </div>
                <p className='supply-caption'>
                  {number(affectedHouseholds)} households affected
                </p>
              </div>
            </div>
          )}

          {/* Truth data (only when showTruth) */}
          {showTruth && (
            <div className='incident-truth'>
              <div className='truth-item'>
                <MapPinned size={14} />
                <span>
                  Localization error:{' '}
                  {number(errorMeters ?? data.localization_error_m, 1)} m
                </span>
              </div>
              {data.injected_node_id && (
                <div className='truth-item'>
                  <Droplet size={14} />
                  <span>Injected at: {data.injected_node_id}</span>
                </div>
              )}
            </div>
          )}

          {/* Compute time */}
          {data.compute_time_ms && (
            <p className='compute-time'>
              Computed in {number(data.compute_time_ms, 0)} ms
            </p>
          )}
        </div>
      )}
    </aside>
  );
}
