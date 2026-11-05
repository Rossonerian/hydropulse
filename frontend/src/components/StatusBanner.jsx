import { memo } from 'react';
import { AlertTriangle, Clock, RefreshCw, Trash2 } from 'lucide-react';

/**
 * StatusBanner (Section 17.4, 18.5, 21.3 of HydroPulse Interaction Plan)
 * Communicates data freshness, connection state, and recovery actions honestly.
 */
function StatusBanner({
  mode,
  networkSource,
  lastUpdated,
  isRefreshing,
  isCached,
  onRetry,
  onClearCache,
}) {
  const formattedTime = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : null;

  if (mode === 'offline') {
    const sourceLabel =
      networkSource === 'recorded'
        ? 'using recorded baseline snapshot'
        : networkSource === 'live'
          ? 'using cached live snapshot'
          : 'using local demo model';

    return (
      <div className='offline-banner' role='status' aria-live='polite'>
        <AlertTriangle size={15} />
        <span>
          <b>Backend offline:</b> {sourceLabel}
          {formattedTime && ` (last valid update: ${formattedTime})`}
        </span>
        <div className='status-banner-actions'>
          <button onClick={onRetry} aria-label='Retry backend connection' type='button'>
            <RefreshCw size={13} className={isRefreshing ? 'spin-icon' : ''} /> Retry connection
          </button>
          {onClearCache && (
            <button onClick={onClearCache} aria-label='Clear local cache and reload' type='button' className='secondary'>
              <Trash2 size={12} /> Clear cache
            </button>
          )}
        </div>
      </div>
    );
  }

  if (isRefreshing && mode !== 'loading') {
    return (
      <div className='refreshing-banner' role='status' aria-live='polite'>
        <RefreshCw size={12} className='spin-icon' />
        <span>Revalidating network telemetry in background…</span>
      </div>
    );
  }

  if (isCached && formattedTime) {
    return (
      <div className='cached-banner' role='status'>
        <Clock size={12} />
        <span>Showing cached network data · Synchronized at {formattedTime}</span>
      </div>
    );
  }

  if (mode === 'loading') {
    return (
      <div className='connecting-banner' role='status' aria-busy='true'>
        <span /> CONNECTING TO KENGERI WATER NETWORK API…
      </div>
    );
  }

  return null;
}

export default memo(StatusBanner);
