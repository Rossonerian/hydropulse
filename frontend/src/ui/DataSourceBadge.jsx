/**
 * HydroPulse DataSourceBadge Component
 * API: DataSourceBadge({mode, networkSource, health, network, compact})
 * Shows a status dot + one short word. The revision and network name live in the
 * tooltip and aria-label so the badge never overflows a narrow top bar.
 */

import { Loader2 } from 'lucide-react';
import '../styles/ops/topbar.css';

export function DataSourceBadge({ mode, networkSource, health, network, compact = false }) {
  const variantClass = `data-source-badge--${mode}`;
  const compactClass = compact ? 'data-source-badge--compact' : '';

  const networkName = health?.network_name || network?.network_name || '';
  const synthetic = networkName.toLowerCase().includes('synthetic');

  let label = '';
  let detail = '';

  if (mode === 'live') {
    label = 'LIVE API';
    detail = `Live API, ${health?.network_revision || 'rev-1'}`;
  } else if (mode === 'mock' && networkSource === 'recorded') {
    label = 'RECORDED DEMO DATA';
    detail = 'Recorded API fixture (offline insurance)';
  } else if (mode === 'offline') {
    label = 'RECORDED DEMO DATA';
    detail =
      networkSource === 'live'
        ? 'Backend offline: showing last live snapshot'
        : 'Backend offline: showing recorded fixture';
  } else if (mode === 'mock' && networkSource === 'synthetic') {
    label = 'RECORDED DEMO DATA';
    detail = 'Generated demo data';
  } else if (mode === 'loading') {
    label = 'Connecting';
    detail = 'Connecting to backend';
  }

  const tooltip = `${detail}${synthetic ? ', synthetic network' : ''}`.trim();
  const shown = !compact && synthetic && mode === 'live' ? `${label} (demo network)` : label;

  return (
    <span
      className={`data-source-badge ${variantClass} ${compactClass}`.trim()}
      title={tooltip || undefined}
      role="status"
      aria-label={tooltip ? `${label}. ${tooltip}` : label}
    >
      {mode === 'loading' ? (
        <Loader2 size={12} className="animate-spin" aria-hidden="true" />
      ) : (
        <span className="data-source-badge__dot" aria-hidden="true" />
      )}
      <span className="data-source-badge__text">{shown}</span>
    </span>
  );
}
