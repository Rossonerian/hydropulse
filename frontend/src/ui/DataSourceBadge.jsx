/**
 * HydroPulse DataSourceBadge Component
 * API: DataSourceBadge({mode, networkSource, health, network, compact})
 */

import { Disc, Wifi, WifiOff, Loader2 } from 'lucide-react';

export function DataSourceBadge({ mode, networkSource, health, network, compact = false }) {
  const variantClass = `data-source-badge--${mode}`;
  const compactClass = compact ? 'data-source-badge--compact' : '';

  let text = '';
  let Icon = null;

  if (mode === 'live') {
    text = `Live API · ${health?.network_revision || 'rev-1'}`;
    Icon = Wifi;
  } else if (mode === 'mock' && networkSource === 'recorded') {
    text = 'Recorded fixture';
    Icon = Disc;
  } else if (mode === 'offline') {
    if (networkSource === 'live') {
      text = 'Offline — last live snapshot';
    } else if (networkSource === 'synthetic') {
      text = 'Offline — generated demo data';
    } else {
      text = 'Offline — showing fixture';
    }
    Icon = WifiOff;
  } else if (mode === 'mock' && networkSource === 'synthetic') {
    text = 'Generated demo data';
    Icon = Disc;
  } else if (mode === 'loading') {
    text = 'Connecting…';
    Icon = Loader2;
  }

  // Add synthetic network suffix
  const networkName = health?.network_name || network?.network_name || '';
  if (networkName.toLowerCase().includes('synthetic')) {
    text += ' · Synthetic network';
  }

  return (
    <span className={`data-source-badge ${variantClass} ${compactClass}`.trim()}>
      {Icon && <Icon size={compact ? 12 : 14} className={mode === 'loading' ? 'animate-spin' : ''} />}
      {text}
    </span>
  );
}
