/**
 * HydroPulse Checkbox Component
 * API: Checkbox({id, label, checked, onChange, ...props})
 */

import { forwardRef } from 'react';

export const Checkbox = forwardRef(({ id, label, checked, onChange, className = '', ...props }, ref) => {
  return (
    <label className={`checkbox ${className}`.trim()}>
      <input
        ref={ref}
        id={id}
        type="checkbox"
        className="checkbox__input"
        checked={checked}
        onChange={(e) => onChange?.(e.target.checked)}
        {...props}
      />
      <span className="checkbox__label">{label}</span>
    </label>
  );
});

Checkbox.displayName = 'Checkbox';
