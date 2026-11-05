/**
 * HydroPulse Drawer Component
 * API: Drawer({open, onClose, title, side, width, children})
 */

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton.jsx';

export function Drawer({ open, onClose, title, side = 'right', width = 480, children }) {
  const drawerRef = useRef(null);
  const openerRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    openerRef.current = document.activeElement;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onCloseRef.current?.();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    if (!drawerRef.current?.contains(document.activeElement)) {
      drawerRef.current?.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
      openerRef.current?.focus();
    };
  }, [open]);
  if (!open) return null;

  const sideClass = side === 'left' ? 'drawer--left' : '';

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <div ref={drawerRef} className={`drawer ${sideClass}`} style={{ width }} role="dialog" aria-modal="true">
        <div className="drawer__header">
          <h2 className="drawer__title">{title}</h2>
          <IconButton label="Close" icon={X} onClick={onClose} />
        </div>
        <div className="drawer__body">{children}</div>
      </div>
    </>
  );
}
