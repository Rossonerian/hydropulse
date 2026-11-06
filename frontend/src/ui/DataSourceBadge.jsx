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
    label = 'Connected';
    detail = `Live API, ${health?.network_revision || 'rev-1'}`;
  } else if (mode === 'mock' && networkSource === 'recorded') {
    label = 'Demo data';
    detail = 'Recorded fixture';
  } else if (mode === 'offline') {
    label = 'Offline';
    detail =
      networkSource === 'live'
        ? 'Offline, last live snapshot'
        : networkSource === 'synthetic'
          ? 'Offline, generated demo data'
          : 'Offline, showing fixture';
  } else if (mode === 'mock' && networkSource === 'synthetic') {
    label = 'Demo data';
    detail = 'Generated demo data';
  } else if (mode === 'loading') {
    label = 'Connecting';
    detail = 'Connecting to the server';
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
