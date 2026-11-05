/**
 * HydroPulse Modal Component
 * API: Modal({open, onClose, title, children, footer, initialFocusRef})
 */

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton.jsx';

export function Modal({ open, onClose, title, children, footer, initialFocusRef }) {
  const modalRef = useRef(null);
  const openerRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    // Store the element that opened the modal
    openerRef.current = document.activeElement;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onCloseRef.current?.();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    // Focus management on open only when activeElement is outside
    if (!modalRef.current?.contains(document.activeElement)) {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      } else if (modalRef.current) {
        modalRef.current.focus();
      }
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
      // Restore focus to opener
      openerRef.current?.focus();
    };
  }, [open]);
  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={modalRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <div className="modal__header">
          {title && <h2 id="modal-title" className="modal__title">{title}</h2>}
          <IconButton label="Close" icon={X} onClick={onClose} />
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>
  );
}
