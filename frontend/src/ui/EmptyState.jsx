/**
 * HydroPulse EmptyState Component
 * API: EmptyState({icon, title, body, actions})
 */

export function EmptyState({ icon: Icon, title, body, actions }) {
  return (
    <div className="empty-state">
      {Icon && <Icon className="empty-state__icon" />}
      {title && <h3 className="empty-state__title">{title}</h3>}
      {body && <p className="empty-state__body">{body}</p>}
      {actions && <div className="empty-state__actions">{actions}</div>}
    </div>
  );
}
