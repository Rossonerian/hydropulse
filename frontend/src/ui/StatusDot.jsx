/**
 * HydroPulse StatusDot Component
 * API: StatusDot({tone})
 */

export function StatusDot({ tone = 'sensor' }) {
  return <span className={`status-dot status-dot--${tone}`} />;
}
