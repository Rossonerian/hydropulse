/**
 * HydroPulse DraftStatus Component
 * API: DraftStatus({dirty, savedAt})
 */

import { Save, AlertTriangle } from 'lucide-react';

export function DraftStatus({ dirty, savedAt }) {
  if (dirty) {
    return (
      <span className="draft-status draft-status--dirty">
        <AlertTriangle size={14} />
        Unsaved changes
      </span>
    );
  }

  const timeStr = savedAt
    ? new Date(savedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    : 'recently';

  return (
    <span className="draft-status draft-status--saved">
      <Save size={14} />
      Local draft · saved in this browser {timeStr}
    </span>
  );
}
