import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '../ui/index.js';
import '../styles/ops/tour.css';

/**
 * GuidedTour: three coach-marks (Pick -> Run -> Result) that point at the REAL controls.
 *
 * DATA-ATTRIBUTE CONTRACT (other components add these; this file only reads them):
 *   data-tour="presets"      the "Pick a problem" preset cards (ControlPanel)
 *   data-tour="next-action"  the single contextual primary button (ControlPanel)
 *   data-tour="result"       the result card / result area (IncidentPanel)
 * If a target is missing or not visible, the tour card falls back to the bottom-right
 * corner (bottom bar on phones) and still works. Nothing else depends on these attributes.
 *
 * Props are unchanged: onClose, onPickPreset, onRun, onOpenStudio (kept, unused), canRun.
 * "Seen" state is written by the parent (hp-tour in localStorage, try/catch guarded there).
 */

const STEPS = [
  {
    target: 'presets',
    title: 'Pick a problem to try',
    body: 'Choose one of the ready-made leaks here. Nothing runs yet.',
    action: 'Pick one for me',
    key: 'preset',
  },
  {
    target: 'next-action',
    title: 'Run the test',
    body: 'This button starts a test leak. Five sensors check the pressure and the system looks for the leak.',
    action: 'Run it for me',
    key: 'run',
  },
  {
    target: 'result',
    title: 'Read the result',
    body: 'Here you see where the leak most likely is, how much water is lost, and which valves to shut.',
  },
];

const CARD_W = 340;
const GAP = 12;

function findTarget(name) {
  try {
    const nodes = document.querySelectorAll(`[data-tour="${name}"]`);
    for (const el of nodes) {
      const r = el.getBoundingClientRect();
      if (r.width > 4 && r.height > 4 && r.bottom > 0 && r.top < window.innerHeight) return el;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export default function GuidedTour({ onClose, onPickPreset, onRun, canRun = true }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [cardH, setCardH] = useState(200);
  const titleRef = useRef(null);
  const cardRef = useRef(null);
  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  useEffect(() => {
    // Move focus only when stepping, so the card never steals it on first paint.
    if (index > 0) titleRef.current?.focus();
  }, [index]);

  const measure = useCallback(() => {
    const el = findTarget(step.target);
    if (el) {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    } else {
      setRect(null);
    }
    if (cardRef.current) setCardH(cardRef.current.offsetHeight || 200);
  }, [step.target]);

  useLayoutEffect(() => {
    measure();
    const id = setInterval(measure, 500); // targets can mount later (result card)
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      clearInterval(id);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [measure]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const doAction = () => {
    if (step.key === 'preset') onPickPreset?.();
    if (step.key === 'run') onRun?.();
  };

  // Place the card beside the target on wide screens; otherwise use the fixed corner.
  let style;
  const wide = typeof window !== 'undefined' && window.innerWidth >= 768;
  if (rect && wide) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = rect.left + rect.width + GAP;
    if (left + CARD_W > vw - GAP) left = rect.left - CARD_W - GAP;
    if (left >= GAP) {
      const top = Math.min(Math.max(rect.top, GAP), vh - cardH - GAP);
      style = { left, top, right: 'auto', bottom: 'auto' };
    }
  }

  return (
    <>
      {rect && (
        <div
          className="tour__ring"
          aria-hidden="true"
          style={{
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
          }}
        />
      )}
      <aside
        ref={cardRef}
        className="tour"
        style={style}
        role="complementary"
        aria-label="Quick tour"
      >
        <div className="tour__head">
          <span className="tour__count">
            Step {index + 1} of {STEPS.length}
          </span>
          <button type="button" className="tour__close" onClick={onClose} aria-label="Skip the tour">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <h2 className="tour__title" tabIndex={-1} ref={titleRef}>
          {step.title}
        </h2>
        <p className="tour__body">{step.body}</p>
        <div className="tour__actions">
          {step.action && (
            <Button
              variant="secondary"
              size="sm"
              onClick={doAction}
              disabled={step.key === 'run' && !canRun}
            >
              {step.action}
            </Button>
          )}
          <span className="tour__spacer" />
          {index > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setIndex(index - 1)}>
              Back
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={() => (last ? onClose?.() : setIndex(index + 1))}
          >
            {last ? 'Done' : 'Next'}
          </Button>
        </div>
      </aside>
    </>
  );
}
