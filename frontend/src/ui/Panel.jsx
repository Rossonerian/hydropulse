/**
 * HydroPulse Panel Component
 * API: Panel({title, actions, children, as, className})
 */

export function Panel({ title, actions, children, as = 'section', className = '' }) {
  const Tag = as;
  return (
    <Tag className={`panel ${className}`.trim()}>
      {(title || actions) && (
        <div className="panel__header">
          {title && <h2 className="panel__title">{title}</h2>}
          {actions && <div className="panel__actions">{actions}</div>}
        </div>
      )}
      <div className="panel__body">{children}</div>
    </Tag>
  );
}
