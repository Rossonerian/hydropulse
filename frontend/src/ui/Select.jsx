/**
 * HydroPulse Select Component
 * API: Select({id, label, options, value, onChange, ...props})
 */

import { forwardRef } from 'react';

export const Select = forwardRef(({ id, label, options, value, onChange, className = '', ...props }, ref) => {
  return (
    <select
      ref={ref}
      id={id}
      className={`select ${className}`.trim()}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      {...props}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
});

Select.displayName = 'Select';
