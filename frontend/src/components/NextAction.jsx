import { Check } from 'lucide-react';
import { Button } from '../ui/index.js';

// The single contextual primary action of the Operations screen, plus its progress chips.
// step: 'pick' | 'ready' | 'running' | 'located' | 'isolated'  (derived in App from the existing phase state)

const CHIPS = ['Pick', 'Run', 'Result', 'Isolate', 'Share'];
// index of the current chip; every chip before it is done
const ACTIVE_CHIP = { pick: 0, ready: 1, running: 1, located: 3, isolated: 4 };
const STEP_NUMBER = { pick: 1, ready: 2, running: 2, located: 3, isolated: 4 };

const CONFIG = {
  pick: { label: '1. Pick a problem', helper: 'Choose one of the problems to enable this' },
  ready: { label: '2. Run the test' },
  running: { label: 'Checking the sensors…', busy: true },
  located: { label: '3. Shut the valves' },
  isolated: { label: '4. Export / share report' },
};

export function Stepper({ step }) {
  const active = ACTIVE_CHIP[step] ?? 0;
  return (
    <div className="stepper">
      <ol className="stepper__chips" aria-label={`Progress, step ${STEP_NUMBER[step]} of 4`}>
        {CHIPS.map((label, i) => {
          const state = i < active ? 'done' : i === active ? 'active' : 'todo';
          return (
            <li
              key={label}
              className={`stepper__chip stepper__chip--${state}`}
              aria-current={state === 'active' ? 'step' : undefined}
            >
              {state === 'done' && <Check size={12} aria-hidden="true" />}
              {label}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function NextActionButton({
  step,
  hasNetwork = true,
  cooldown = 0,
  onRun,
  onIsolate,
  onExport,
  onReset,
  onSeeWhy,
  buttonRef,
  showHelper = true,
}) {
  const cfg = CONFIG[step] || CONFIG.pick;
  const disabled = !hasNetwork || step === 'pick' || step === 'running' || (step === 'ready' && cooldown > 0);
  const click = () => {
    if (step === 'ready') onRun?.();
    else if (step === 'located') onIsolate?.();
    else if (step === 'isolated') onExport?.();
  };
  const hint =
    step === 'ready' ? 'Space' : step === 'located' ? 'I' : undefined;
  const label = !hasNetwork ? 'Connecting…' : cfg.label;
  return (
    <div className="next-action" data-step={step}>
      <Button
        ref={buttonRef}
        variant="primary"
        size="lg"
        className="next-action__btn"
        data-tour="next-action"
        busy={!!cfg.busy}
        disabled={disabled}
        aria-keyshortcuts={step === 'ready' ? 'Space' : step === 'located' ? 'I' : undefined}
        title={
          step === 'ready' && cooldown > 0
            ? `Ready again in ${cooldown}s`
            : hint
              ? `Shortcut: ${hint}`
              : undefined
        }
        onClick={click}
      >
        {label}
      </Button>
      {showHelper && step === 'pick' && <p className="next-action__helper">{cfg.helper}</p>}
      {step === 'located' && (
        <button type="button" className="next-action__link" onClick={onSeeWhy}>
          See why
        </button>
      )}
      {step === 'isolated' && (
        <Button variant="secondary" size="md" className="next-action__secondary" onClick={onReset}>
          Try another leak
        </Button>
      )}
    </div>
  );
}
