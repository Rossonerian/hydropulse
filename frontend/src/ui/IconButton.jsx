/**
 * HydroPulse IconButton Component
 * API: IconButton({label, icon, size, pressed, ...props})
 */

import { forwardRef } from 'react';

export const IconButton = forwardRef(
  ({ label, icon: Icon, size = 'md', pressed = false, className = '', ...props }, ref) => {
    const sizeClass = size !== 'md' ? `icon-btn--${size}` : '';
    const pressedClass = pressed ? 'icon-btn--pressed' : '';

    return (
      <button
        ref={ref}
        className={`icon-btn ${sizeClass} ${pressedClass} ${className}`.trim()}
        aria-label={label}
        title={label}
        aria-pressed={pressed || undefined}
        {...props}
      >
        <Icon size={size === 'sm' ? 16 : size === 'lg' ? 20 : 18} />
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
