import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '../ui/index.js';
import '../styles/ops/tour.css';

const STEPS = [
  {
    title: 'Choose a leak preset',
    body: 'Presets 1, 2 and 3 are ready-made bursts on the Kengeri network. Press 1, 2 or 3, or pick a junction on the map.',
    action: 'Select the first target',
    key: 'preset',
  },
  {
    title: 'Run the simulation',
    body: 'Press Space or Simulate burst. Five pressure sensors react and the system searches for the leak.',
    action: 'Simulate burst',
    key: 'run',
  },
  {
    title: 'Read the result',
    body: 'The Incident tab shows the predicted location, the loss in L/min and tankers per day. The match score is a pattern-match score, not certainty.',
  },
  {
    title: 'Go further',
    body: 'Press I to see which valves to close. Press N to open Network Studio and edit the network.',
    action: 'Open Network Studio',
    key: 'studio',
  },
];

export default function GuidedTour({ onClose, onPickPreset, onRun, onOpenStudio, canRun = true }) {
  const [index, setIndex] = useState(0);
  const titleRef = useRef(null);
  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  useEffect(() => {
    // Move focus only when stepping, so the card never steals it on first paint.
    if (index > 0) titleRef.current?.focus();
  }, [index]);

  const doAction = () => {
    if (step.key === 'preset') onPickPreset?.();
    if (step.key === 'run') onRun?.();
    if (step.key === 'studio') {
      onOpenStudio?.();
      onClose?.();
    }
  };

  return (
    <aside className="tour" role="complementary" aria-label="Guided tour">
      <div className="tour__head">
        <span className="tour__count">
          Step {index + 1} of {STEPS.length}
        </span>
        <button type="button" className="tour__close" onClick={onClose} aria-label="Dismiss tour">
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <h2 className="tour__title" tabIndex={-1} ref={titleRef}>
        {step.title}
      </h2>
      <p className="tour__body">{step.body}</p>
      <div className="tour__actions">
        {step.action && (
          <Button variant="secondary" size="sm" onClick={doAction} disabled={step.key === 'run' && !canRun}>
            {step.action}
          </Button>
        )}
        <span className="tour__spacer" />
        {index > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setIndex(index - 1)}>
            Back
          </Button>
        )}
        <Button variant="primary" size="sm" onClick={() => (last ? onClose?.() : setIndex(index + 1))}>
          {last ? 'Done' : 'Next'}
        </Button>
      </div>
    </aside>
  );
}
