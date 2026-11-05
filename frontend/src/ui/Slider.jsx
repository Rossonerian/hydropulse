/**
 * HydroPulse Slider Component
 * API: Slider({id, label, value, min, max, step, unit, format, onChange})
 */

import { forwardRef } from 'react';

export const Slider = forwardRef(
  ({ id, label, value, min, max, step, unit, format, onChange, ...props }, ref) => {
    const displayValue = format ? format(value) : value;

    return (
      <div className="slider" {...props}>
        <div className="slider__header">
          {label && <label htmlFor={id} className="slider__label">{label}</label>}
          <span className="slider__value">{displayValue}</span>
        </div>
        <div className="slider__body">
          <input
            ref={ref}
            id={id}
            type="range"
            className="slider__input"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange?.(parseFloat(e.target.value))}
          />
          {unit && <span className="slider__unit">{unit}</span>}
        </div>
      </div>
    );
  }
);

Slider.displayName = 'Slider';
