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
      networkSource === 'live'
        ? 'Showing the last saved copy of your network.'
        : 'Showing demo data, so results are examples, not live readings.';

    return (
      <div className="status-banner status-banner--offline" role="status" aria-live="polite">
        <AlertTriangle size={16} aria-hidden="true" />
        <span>
          <b>Can&apos;t reach the server.</b> {sourceLabel}
          {formattedTime && ` Last update ${formattedTime}.`} You can keep exploring.
        </span>
        <div className="status-banner-actions" style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
          {onRetry && (
            <button type="button" onClick={onRetry} aria-label="Retry connecting to the server">
              <RefreshCw size={14} className={isRefreshing ? 'spin-icon' : ''} aria-hidden="true" /> Retry
            </button>
          )}
          {onClearCache && (
            <button type="button" onClick={onClearCache} aria-label="Clear saved data and reload" className="secondary">
              <Trash2 size={12} aria-hidden="true" /> Clear saved data
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
        <span>Checking for updates…</span>
      </div>
    );
  }

  if (isCached && formattedTime) {
    return (
      <div className="status-banner status-banner--cached" role="status">
        <Clock size={14} aria-hidden="true" />
        <span>Showing saved data from {formattedTime}</span>
        {onClearCache && (
          <button type="button" onClick={onClearCache} aria-label="Clear saved data" style={{ marginLeft: 'auto' }}>
            <Trash2 size={12} aria-hidden="true" /> Clear saved data
          </button>
        )}
      </div>
    );
  }

  if (mode === 'loading') {
    return (
      <div className="status-banner status-banner--loading" role="status" aria-busy="true">
        <span>Loading network…</span>
      </div>
    );
  }

  return null;
}

export default memo(StatusBanner);
