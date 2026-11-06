import { Activity, AlertTriangle, CheckCircle, Droplet, Gauge, X } from 'lucide-react';
import '../../styles/studio/simulation.css';

export default function StudioSimulationBanner({ result, onClear }) {
  if (!result) return null;
  const metrics = result.scenario || result.baseline;
  const minP = metrics?.min_pressure_m ?? 0;
  const avgP = metrics?.avg_pressure_m ?? 0;
  const maxP = metrics?.max_pressure_m ?? 0;
  const deficitNodes = metrics?.pressure_deficit_nodes ?? 0;
  const leakLoss = metrics?.total_leak_loss_lpm ?? 0;
  const unsupplied = metrics?.unsupplied_nodes?.length ?? 0;
  const warnings = result.pipe_warnings?.length ?? 0;

  return (
    <div className="studio-sim-banner" role="status" aria-label="Hydraulic Simulation Results">
      <div className="sim-banner-left">
        <div className="sim-badge">
          <Activity size={14} className="sim-pulse-icon" />
          <span>WNTR SIMULATION ACTIVE</span>
        </div>
        <div className="sim-metrics-strip">
          <div className="sim-stat">
            <span className="sim-stat-lbl">Min Pressure</span>
            <span className={`sim-stat-val ${minP < 15 ? 'warning' : 'ok'}`}>
              {minP.toFixed(1)} m
            </span>
          </div>
          <div className="sim-stat">
            <span className="sim-stat-lbl">Avg Pressure</span>
            <span className="sim-stat-val">{avgP.toFixed(1)} m</span>
          </div>
          <div className="sim-stat">
            <span className="sim-stat-lbl">Pressure Deficits</span>
            <span className={`sim-stat-val ${deficitNodes > 0 ? 'warning' : 'ok'}`}>
              {deficitNodes} nodes
            </span>
          </div>
          {leakLoss > 0 && (
            <div className="sim-stat">
              <span className="sim-stat-lbl">Leak Loss</span>
              <span className="sim-stat-val warning">{leakLoss.toFixed(1)} L/min</span>
            </div>
          )}
          {warnings > 0 && (
            <div className="sim-stat">
              <span className="sim-stat-lbl">Velocity Warnings</span>
              <span className="sim-stat-val warning">{warnings}</span>
            </div>
          )}
        </div>
      </div>
      <div className="sim-banner-right">
        <span className="sim-time">{Math.round(result.compute_time_ms || 24)} ms</span>
        <button type="button" className="sim-clear-btn" onClick={onClear} aria-label="Clear simulation results">
          <X size={14} /> Clear Results
        </button>
      </div>
    </div>
  );
}
