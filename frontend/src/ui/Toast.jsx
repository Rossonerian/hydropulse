/**
 * HydroPulse Toast Component
 * API: Toast({tone, message, onDismiss})
 */

import { X } from 'lucide-react';
import { IconButton } from './IconButton.jsx';

export function Toast({ tone = 'water', message, onDismiss }) {
  return (
    <div className={`toast toast--${tone}`} role="status" aria-live="polite">
      <span>{message}</span>
      {onDismiss && (
        <IconButton label="Dismiss" icon={X} size="sm" onClick={onDismiss} className="toast__dismiss" />
      )}
    </div>
  );
}
