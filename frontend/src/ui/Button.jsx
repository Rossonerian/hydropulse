/**
 * HydroPulse Button Component
 * API: Button({variant, size, busy, icon, kbd, children, ...props})
 */

import { forwardRef } from 'react';

export const Button = forwardRef(
  (
    {
      variant = 'secondary',
      size = 'md',
      busy = false,
      icon: Icon,
      kbd,
      children,
      className = '',
      ...props
    },
    ref
  ) => {
    const variantClass = `btn--${variant}`;
    const sizeClass = `btn--${size}`;
    const busyClass = busy ? 'btn--busy' : '';

    return (
      <button
        ref={ref}
        className={`btn ${variantClass} ${sizeClass} ${busyClass} ${className}`.trim()}
        disabled={busy || props.disabled}
        aria-busy={busy || undefined}
        {...props}
      >
        {Icon && <Icon size={size === 'sm' ? 16 : size === 'lg' ? 20 : 18} />}
        {children}
        {kbd && <kbd className="kbd">{kbd}</kbd>}
      </button>
    );
  }
);

Button.displayName = 'Button';
