import { memo } from 'react';
import { AlertTriangle, Clock, RefreshCw, Trash2, X } from 'lucide-react';

/**
 * StatusBanner (Section 17.4, 18.5, 21.3 of HydroPulse Interaction Plan)
 * Communicates data freshness, connection state, error toasts, and recovery actions.
 */
function StatusBanner({
  mode,
  networkSource,
  lastUpdated,
  isRefreshing,
  isCached,
  onRetry,
  onClearCache,
  message,
  onDismiss,
}) {
  if (message) {
    return (
      <div className="status-banner status-banner--toast" role="status" aria-live="polite">
        <AlertTriangle size={16} aria-hidden="true" />
        <span>{message}</span>
        {onDismiss && (
          <button type="button" onClick={onDismiss} aria-label="Dismiss notification">
            <X size={14} aria-hidden="true" /> Dismiss
          </button>
        )}
      </div>
    );
  }

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
      <div className="status-banner status-banner--offline" role="status" aria-live="polite">
        <AlertTriangle size={16} aria-hidden="true" />
        <span>
          <b>Backend offline:</b> {sourceLabel}
          {formattedTime && ` (last valid update: ${formattedTime})`}
        </span>
        <div className="status-banner-actions" style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
          {onRetry && (
            <button type="button" onClick={onRetry} aria-label="Retry backend connection">
              <RefreshCw size={14} className={isRefreshing ? 'spin-icon' : ''} aria-hidden="true" /> Retry connection
            </button>
          )}
          {onClearCache && (
            <button type="button" onClick={onClearCache} aria-label="Clear local cache and reload" className="secondary">
              <Trash2 size={12} aria-hidden="true" /> Clear cache
            </button>
          )}
        </div>
      </div>
    );
  }

  if (isRefreshing && mode !== 'loading') {
    return (
      <div className="status-banner status-banner--refreshing" role="status" aria-live="polite">
        <RefreshCw size={14} className="spin-icon" aria-hidden="true" />
        <span>Revalidating network telemetry in background…</span>
      </div>
    );
  }

  if (isCached && formattedTime) {
    return (
      <div className="status-banner status-banner--cached" role="status">
        <Clock size={14} aria-hidden="true" />
        <span>Showing cached network data · Synchronized at {formattedTime}</span>
        {onClearCache && (
          <button type="button" onClick={onClearCache} aria-label="Clear local cache" style={{ marginLeft: 'auto' }}>
            <Trash2 size={12} aria-hidden="true" /> Clear cache
          </button>
        )}
      </div>
    );
  }

  if (mode === 'loading') {
    return (
      <div className="status-banner status-banner--loading" role="status" aria-busy="true">
        <span>CONNECTING TO KENGERI WATER NETWORK API…</span>
      </div>
    );
  }

  return null;
}

export default memo(StatusBanner);
