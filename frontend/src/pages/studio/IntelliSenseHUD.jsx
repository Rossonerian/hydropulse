import { useEffect, useState, useMemo } from 'react';
import { Activity, AlertCircle, ArrowRight, CheckCircle2, Sparkles, X } from 'lucide-react';
import { client } from '../../api/client.js';
import { Button } from '../../ui/index.js';
import '../../styles/studio/intellisense.css';

export default function IntelliSenseHUD({ selection, draft, onApplyDiameter, onClose }) {
  const [intel, setIntel] = useState(null);
  const [loading, setLoading] = useState(false);
  const [applied, setApplied] = useState(false);

  const selectedPipe = useMemo(() => {
    if (selection?.type !== 'pipe' || !draft?.network?.pipes) return null;
    return draft.network.pipes.find((p) => p.id === selection.id);
  }, [selection, draft]);

  const srcNode = useMemo(() => {
    if (!selectedPipe || !draft?.network?.nodes) return null;
    return draft.network.nodes.find((n) => n.id === selectedPipe.source);
  }, [selectedPipe, draft]);

  const tgtNode = useMemo(() => {
    if (!selectedPipe || !draft?.network?.nodes) return null;
    return draft.network.nodes.find((n) => n.id === selectedPipe.target);
  }, [selectedPipe, draft]);

  useEffect(() => {
    if (!selectedPipe || !srcNode || !tgtNode) {
      setIntel(null);
      return;
    }
    setApplied(false);
    let active = true;
    const controller = new AbortController();

    async function fetchIntel() {
      setLoading(true);
      try {
        const res = await client.intellisense(
          {
            from_node_id: selectedPipe.source,
            to_node_id: selectedPipe.target,
            target_velocity_ms: 1.0,
            roughness: 130.0,
          },
          controller.signal,
        );
        if (active) setIntel(res);
      } catch {
        if (!active) return;
        const e1 = srcNode.elevation_m ?? 800;
        const e2 = tgtNode.elevation_m ?? 800;
        const diff = Math.round((e2 - e1) * 10) / 10;
        const len = selectedPipe.length_m || 100;
        const slope = Math.round((diff / Math.max(len, 1)) * 1000) / 10;
        const currentDiam = selectedPipe.diameter_mm || 150;
        const q = 0.015; // 15 L/s
        const area = Math.PI * Math.pow(currentDiam / 2000, 2);
        const vel = Math.round((q / Math.max(area, 0.0001)) * 100) / 100;
        const hl = Math.round((10.67 * len * Math.pow(q, 1.852) / (Math.pow(130, 1.852) * Math.pow(currentDiam / 1000, 4.87))) * 10) / 10;

        let recDiam = 150;
        if (vel > 1.5) recDiam = 200;
        else if (vel < 0.4) recDiam = 100;

        const warnings = [];
        if (vel > 1.5) warnings.push(`High velocity (${vel} m/s) causes excessive friction head loss.`);
        if (vel < 0.4) warnings.push(`Low velocity (${vel} m/s) increases water age and stagnation risk.`);

        setIntel({
          length_m: len,
          elevation_from_m: e1,
          elevation_to_m: e2,
          elevation_diff_m: diff,
          slope_pct: slope,
          recommended_diameter_mm: recDiam,
          target_velocity_ms: 1.0,
          predicted_velocity_ms: vel,
          predicted_headloss_m: hl,
          warnings,
        });
      } finally {
        if (active) setLoading(false);
      }
    }

    const timer = setTimeout(fetchIntel, 250);
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [selectedPipe, srcNode, tgtNode]);

  if (!selectedPipe || !intel) return null;

  const currentDiam = selectedPipe.diameter_mm || 150;
  const isRecommended = currentDiam === intel.recommended_diameter_mm;
  const vel = intel.predicted_velocity_ms || 0.9;
  const velPct = Math.min(100, Math.max(0, (vel / 2.5) * 100));
  const velStatus = vel > 1.5 ? 'high' : vel < 0.4 ? 'low' : 'optimal';

  const handleApply = () => {
    onApplyDiameter?.(selectedPipe.id, intel.recommended_diameter_mm);
    setApplied(true);
  };

  return (
    <div className="intellisense-hud" role="region" aria-label="Hydraulic IntelliSense">
      <div className="intel-header">
        <div className="intel-title">
          <Sparkles size={14} className="intel-sparkle" />
          <span>Hydraulic IntelliSense: {selectedPipe.id}</span>
        </div>
        {onClose && (
          <button type="button" className="intel-close-btn" onClick={onClose} aria-label="Close IntelliSense">
            <X size={12} />
          </button>
        )}
      </div>

      <div className="intel-body">
        {/* Recommended Diameter Card */}
        <div className="intel-recommendation-row">
          <div className="intel-metric">
            <span className="intel-label">Current Ø</span>
            <span className="intel-val">{currentDiam} mm</span>
          </div>
          <ArrowRight size={14} className="intel-arrow" />
          <div className="intel-metric highlight">
            <span className="intel-label">Recommended Ø</span>
            <span className="intel-val">Ø {intel.recommended_diameter_mm} mm</span>
          </div>
          {!isRecommended && !applied && (
            <Button size="sm" variant="primary" onClick={handleApply}>
              Apply Ø{intel.recommended_diameter_mm}
            </Button>
          )}
          {(isRecommended || applied) && (
            <span className="intel-applied-badge">
              <CheckCircle2 size={13} /> Sized
            </span>
          )}
        </div>

        {/* Velocity Gauge Bar */}
        <div className="intel-gauge-section">
          <div className="intel-gauge-labels">
            <span>Velocity: <b>{vel.toFixed(2)} m/s</b></span>
            <span className={`intel-status-pill ${velStatus}`}>
              {velStatus === 'optimal' ? 'Optimal (0.6 - 1.2 m/s)' : velStatus === 'high' ? 'High Friction' : 'Stagnation Risk'}
            </span>
          </div>
          <div className="intel-gauge-track">
            <div className="intel-gauge-zone low" style={{ width: '24%' }} />
            <div className="intel-gauge-zone optimal" style={{ width: '36%' }} />
            <div className="intel-gauge-zone high" style={{ width: '40%' }} />
            <div className="intel-gauge-needle" style={{ left: `${velPct}%` }} />
          </div>
        </div>

        {/* Physics Details */}
        <div className="intel-stats-grid">
          <div className="intel-stat-item">
            <span>Head Loss:</span>
            <b>~{intel.predicted_headloss_m.toFixed(1)} m</b>
          </div>
          <div className="intel-stat-item">
            <span>Length:</span>
            <b>{Math.round(intel.length_m)} m</b>
          </div>
          <div className="intel-stat-item">
            <span>Slope Grade:</span>
            <b>{intel.slope_pct > 0 ? `+${intel.slope_pct}%` : `${intel.slope_pct}%`}</b>
          </div>
          <div className="intel-stat-item">
            <span>Elevation:</span>
            <b>{Math.round(intel.elevation_from_m)}m → {Math.round(intel.elevation_to_m)}m</b>
          </div>
        </div>

        {/* Warnings if any */}
        {intel.warnings?.length > 0 && (
          <div className="intel-warnings">
            {intel.warnings.map((w, i) => (
              <div key={i} className="intel-warn-line">
                <AlertCircle size={12} />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
