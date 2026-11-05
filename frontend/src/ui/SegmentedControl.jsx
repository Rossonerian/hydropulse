/**
 * HydroPulse SegmentedControl Component
 * API: SegmentedControl({label, options, value, onChange, size})
 */

import { forwardRef } from 'react';

export const SegmentedControl = forwardRef(
  ({ label, options, value, onChange, size = 'md', className = '', ...props }, ref) => {
    const sizeClass = size !== 'md' ? `segmented--${size}` : '';

    return (
      <div className={`segmented ${sizeClass} ${className}`.trim()} {...props} ref={ref}>
        {label && <span className="segmented__label">{label}</span>}
        <div role="radiogroup" aria-label={label || 'Segmented control'}>
          {options.map((opt) => (
            <button
              key={opt.value}
              className="segmented__btn"
              role="radio"
              aria-checked={value === opt.value}
              aria-label={opt.label}
              onClick={() => onChange?.(opt.value)}
            >
              {opt.icon && <opt.icon size={16} />}
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    );
  }
);

SegmentedControl.displayName = 'SegmentedControl';
