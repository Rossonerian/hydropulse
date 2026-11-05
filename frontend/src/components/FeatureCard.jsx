import { X, Zap } from 'lucide-react';
import { number } from '../lib/format.js';
import '../styles/ops/inspector.css';

const val = (v, unit = '', digits = 1) =>
  v == null || Number.isNaN(Number(v)) ? 'n/a' : `${number(v, digits)}${unit ? ` ${unit}` : ''}`;

function Row({ label, children }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

/**
 * Operations inspector. `feature` is { kind: 'node' | 'pipe', item } resolved from the API network.
 * Always renders something readable for junctions, sensors, reservoirs, tanks and pipes.
 */
export default function FeatureCard({
  feature,
  result,
  phase,
  judge,
  onSimulateHere,
  onClose,
}) {
  if (!feature?.item) return null;
  const { kind, item } = feature;
  const busy = phase === 'simulating';

  if (kind === 'pipe') {
    const valve = (result?.recommended_valves_to_close || []).includes(item.id);
    return (
      <section className='feature-card' aria-label={`Pipe ${item.id}`}>
        <header className='feature-card__head'>
          <div>
            <h3>Pipe {item.id}</h3>
            <span className='feature-card__type'>pipe{item.road_class ? ` · ${item.road_class}` : ''}</span>
          </div>
          <button type='button' className='feature-card__close' aria-label='Close inspector' onClick={onClose}>
            <X size={16} aria-hidden='true' />
          </button>
        </header>
        <dl className='feature-card__facts'>
          <Row label='Connects'>
            {item.source} to {item.target}
          </Row>
          <Row label='Diameter'>{val(item.diameter_mm, 'mm', 0)}</Row>
          <Row label='Length'>{val(item.length_m, 'm')}</Row>
          <Row label='Flow'>{val(item.flow_m3h, 'm³/h', 2)}</Row>
          <Row label='Status'>{item.status || 'n/a'}</Row>
          {valve && <Row label='Isolation'>Valve recommended closed</Row>}
        </dl>
      </section>
    );
  }

  const isJunction = item.type === 'junction' || !item.type;
  const heat = result?.node_heatmap?.[item.id];
  const candidate = (result?.predicted_top_candidates || []).find((c) => c.node_id === item.id);
  const prob = candidate?.confidence_pct != null ? candidate.confidence_pct : null;
  const typeLabel = item.is_sensor ? 'sensor junction' : item.type || 'junction';

  return (
    <section className='feature-card' aria-label={`${typeLabel} ${item.id}`}>
      <header className='feature-card__head'>
        <div>
          <h3>{item.id}</h3>
          <span className='feature-card__type'>{typeLabel}</span>
        </div>
        <button type='button' className='feature-card__close' aria-label='Close inspector' onClick={onClose}>
          <X size={16} aria-hidden='true' />
        </button>
      </header>
      <dl className='feature-card__facts'>
        <Row label='Type'>{item.type || 'junction'}</Row>
        <Row label='Elevation'>{val(item.elevation_m, 'm')}</Row>
        {isJunction ? (
          <>
            <Row label='Base pressure'>{val(item.base_pressure_m, 'm')}</Row>
            <Row label='Base demand'>{val(item.base_demand_lps, 'L/s', 2)}</Row>
            <Row label='Households'>{val(item.households, '', 0)}</Row>
            <Row label='Sensor'>{item.is_sensor ? 'Yes, monitored' : 'No'}</Row>
          </>
        ) : (
          <Row label='Role'>Water source, fixed head</Row>
        )}
        {isJunction && (
          <Row label='Leak probability'>
            {result
              ? prob != null
                ? `${number(prob, 1)}% match (top candidate)`
                : heat != null
                  ? `${number(Number(heat) * 100, 0)}% heat`
                  : '0%'
              : 'Run a simulation to see'}
          </Row>
        )}
        <Row label='Location'>
          {Number.isFinite(item.lat) ? `${item.lat.toFixed(5)}, ${item.lng.toFixed(5)}` : 'n/a'}
        </Row>
      </dl>
      {isJunction && (
        <button
          type='button'
          className='btn btn--primary feature-card__action'
          disabled={busy || judge}
          onClick={() => onSimulateHere?.(item.id)}
        >
          <Zap size={16} aria-hidden='true' />
          {busy ? 'Simulating…' : `Simulate leak here (${item.id})`}
        </button>
      )}
      {isJunction && judge && (
        <p className='feature-card__note'>Judge mode picks the hidden target. Turn it off to choose one.</p>
      )}
    </section>
  );
}
