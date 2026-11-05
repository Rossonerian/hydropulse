/**
 * HydroPulse Switch Component
 * API: Switch({checked, onChange, label, ...props})
 */

import { forwardRef } from 'react';

export const Switch = forwardRef(({ checked, onChange, label, className = '', ...props }, ref) => {
  return (
    <label className={`switch ${className}`.trim()}>
      <input
        ref={ref}
        type="checkbox"
        className="switch__input"
        checked={checked}
        onChange={(e) => onChange?.(e.target.checked)}
        role="switch"
        aria-checked={checked}
        {...props}
      />
      <span className="switch__label">{label}</span>
    </label>
  );
});

Switch.displayName = 'Switch';
