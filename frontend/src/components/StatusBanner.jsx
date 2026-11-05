import { AlertTriangle, RefreshCw, X } from 'lucide-react';

export default function StatusBanner({
  mode,
  networkSource,
  onRetry,
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

  // Make connection state explicit because offline mode can use live snapshots or local demo data.
  if (mode === 'offline') {
    const sourceLabel =
      networkSource === 'recorded'
        ? 'running on recorded data'
        : networkSource === 'live'
          ? 'using the last network snapshot with local simulation'
          : 'running on generated demo data';
    return (
      <div className="status-banner status-banner--offline" role="status">
        <AlertTriangle size={16} aria-hidden="true" />
        <span>
          <b>Backend offline:</b> {sourceLabel}
        </span>
        {onRetry && (
          <button type="button" onClick={onRetry} aria-label="Retry backend connection">
            <RefreshCw size={14} aria-hidden="true" /> Retry connection
          </button>
        )}
      </div>
    );
  }

  if (mode === 'loading') {
    return (
      <div className="status-banner status-banner--loading" role="status">
        Connecting to the network API…
      </div>
    );
  }

  return null;
}
