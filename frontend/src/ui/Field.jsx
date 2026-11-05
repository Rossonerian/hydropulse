/**
 * HydroPulse Field Component
 * API: Field({label, hint, error, htmlFor, children})
 */

export function Field({ label, hint, error, htmlFor, children }) {
  return (
    <div className="field">
      {label && (
        <label htmlFor={htmlFor} className="field__label">
          {label}
        </label>
      )}
      {children}
      {hint && !error && <span className="field__hint">{hint}</span>}
      {error && <span className="field__error">{error}</span>}
    </div>
  );
}
