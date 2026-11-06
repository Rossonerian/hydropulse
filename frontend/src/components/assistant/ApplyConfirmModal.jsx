import { useEffect, useRef, useState } from 'react';
import { Modal, Button, Field } from '../../ui/index.js';
import { ImpactTable } from './SuggestionCard.jsx';
import {
  APPLY_WARNING,
  TOKEN_HINT,
  UNDO_NOTE,
  impactRows,
  suggestionTitle,
  todayVsWith,
} from '../../lib/assistantCopy.js';
import './assistant.css';

/**
 * ApplyConfirmModal: confirm a shared-network change (mode "apply") or undo it (mode "undo").
 * Props:
 *   open        boolean
 *   mode        'apply' | 'undo'   (default 'apply')
 *   suggestion  AiSuggestion (apply mode)
 *   undoTitle   string, name of the change being undone (undo mode)
 *   busy        boolean, request in flight
 *   onClose     () => void
 *   onConfirm   (adminToken: string) => Promise   resolves on success; rejection message is shown here
 * The admin token lives in this component only and is cleared on open, close and after each request.
 */
const HOLD_MS = 1200;

function HoldButton({ label, onConfirm, disabled, describedBy }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef(null);

  const stop = () => {
    clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };
  const start = () => {
    if (disabled || timer.current) return;
    setHolding(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setHolding(false);
      onConfirm();
    }, HOLD_MS);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (disabled) stop();
  }, [disabled]);

  return (
    <button
      type="button"
      className={`asst-hold ${holding ? 'is-holding' : ''}`}
      style={{ '--hold-ms': `${HOLD_MS}ms` }}
      disabled={disabled}
      aria-describedby={describedBy}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => {
        if (e.repeat) return;
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          start();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === ' ' || e.key === 'Enter') stop();
      }}
      onBlur={stop}
    >
      <span className="asst-hold__fill" aria-hidden="true" />
      <span className="asst-hold__label">{holding ? 'Keep holding...' : label}</span>
    </button>
  );
}

export default function ApplyConfirmModal({ open, mode = 'apply', suggestion, undoTitle, busy = false, onClose, onConfirm }) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const tokenRef = useRef(null);
  const undo = mode === 'undo';

  useEffect(() => {
    if (open) {
      setToken('');
      setError('');
    }
  }, [open]);

  const run = async () => {
    if (!token.trim() || busy) return;
    setError('');
    const t = token;
    setToken('');
    try {
      await onConfirm(t);
    } catch (e) {
      setError(e?.message || 'Could not apply the change');
    }
  };

  const rows = !undo && suggestion ? impactRows(suggestion) : [];
  const ready = !!token.trim() && !busy;
  const title = undo ? 'Undo the last change' : 'Apply to the shared network';

  const footer = (
    <Button variant="ghost" onClick={onClose} disabled={busy}>
      Cancel
    </Button>
  );

  return (
    <Modal open={open} onClose={busy ? undefined : onClose} title={title} footer={footer} initialFocusRef={tokenRef}>
      <div className="asst-apply">
        <p className="asst__msg asst__msg--warn" role="note">
          {undo ? 'This goes back one step for everyone' : APPLY_WARNING}
        </p>
        {!undo && suggestion && (
          <>
            <h3 className="asst-apply__title">{suggestionTitle(suggestion)}</h3>
            <p className="asst-card__line">{todayVsWith(suggestion).line}</p>
            <ImpactTable rows={rows} caption="Simulated by the advisor" />
          </>
        )}
        {undo && undoTitle && <p className="asst-card__line">Undoing: {undoTitle}</p>}
        <p className="asst-card__note">{UNDO_NOTE}</p>
        <Field label="Admin token" htmlFor="asst-admin-token" hint={TOKEN_HINT}>
          <input
            ref={tokenRef}
            id="asst-admin-token"
            className="asst-input"
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            disabled={busy}
          />
        </Field>
        {error && (
          <p className="asst__msg asst__msg--bad" role="alert">
            {error}
          </p>
        )}
        {undo ? (
          <Button variant="danger" onClick={run} busy={busy} disabled={!ready}>
            Undo last change
          </Button>
        ) : (
          <div>
            <HoldButton
              label="Hold to apply"
              onConfirm={run}
              disabled={!ready}
              describedBy="asst-hold-hint"
            />
            <span id="asst-hold-hint" className="asst-card__note">
              Press and hold for about 1 second (Space or Enter on a keyboard). Enter the admin token first.
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
}
