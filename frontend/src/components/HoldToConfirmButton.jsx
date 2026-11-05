import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';

/**
 * HoldToConfirmButton (Section 21.2 of HydroPulse Interaction Plan)
 * Protects high-impact / destructive operations (e.g. discarding all draft edits).
 *
 * Requirements:
 * - Clear action label naming the consequence
 * - Animated progress fill indicating required hold duration
 * - Early release cancels immediately without firing
 * - Supports pointer, touch, Space, and Enter
 * - Keyboard repeat protection
 * - Fires exactly once upon 100% completion
 * - Respects prefers-reduced-motion
 */
export default function HoldToConfirmButton({
  onConfirm,
  holdDurationMs = 1200,
  label = 'Hold to discard edits',
  actionName = 'Discarding…',
  completedLabel = 'Discarded',
  disabled = false,
  variant = 'danger',
  icon: Icon = RotateCcw,
}) {
  const [progress, setProgress] = useState(0); // 0 to 100
  const [isHolding, setIsHolding] = useState(false);
  const [isTriggered, setIsTriggered] = useState(false);

  const timerRef = useRef(null);
  const startTimeRef = useRef(0);
  const prefersReducedMotion = useRef(false);

  useEffect(() => {
    prefersReducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const cancelHold = useCallback(() => {
    if (isTriggered) return;
    setIsHolding(false);
    setProgress(0);
    if (timerRef.current) {
      cancelAnimationFrame(timerRef.current);
      timerRef.current = null;
    }
  }, [isTriggered]);

  const completeHold = useCallback(() => {
    setIsHolding(false);
    setProgress(100);
    setIsTriggered(true);
    if (timerRef.current) {
      cancelAnimationFrame(timerRef.current);
      timerRef.current = null;
    }
    onConfirm?.();

    // Reset state after brief confirmation feedback
    setTimeout(() => {
      setIsTriggered(false);
      setProgress(0);
    }, 1400);
  }, [onConfirm]);

  const startHold = useCallback(() => {
    if (disabled || isTriggered || isHolding) return;

    if (prefersReducedMotion.current) {
      // Reduced motion: skip animation and confirm directly with single trigger guard
      completeHold();
      return;
    }

    setIsHolding(true);
    startTimeRef.current = performance.now();

    const tick = (now) => {
      const elapsed = now - startTimeRef.current;
      const currentPct = Math.min(100, (elapsed / holdDurationMs) * 100);
      setProgress(currentPct);

      if (currentPct >= 100) {
        completeHold();
      } else {
        timerRef.current = requestAnimationFrame(tick);
      }
    };

    timerRef.current = requestAnimationFrame(tick);
  }, [disabled, isTriggered, isHolding, holdDurationMs, completeHold]);

  // Clean up animation on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
    };
  }, []);

  // Keyboard support: Space & Enter
  const handleKeyDown = (e) => {
    if (e.repeat) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      startHold();
    }
  };

  const handleKeyUp = (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      cancelHold();
    }
  };

  return (
    <button
      className={`hold-confirm-btn variant-${variant} ${isHolding ? 'is-holding' : ''} ${isTriggered ? 'is-triggered' : ''}`}
      onMouseDown={startHold}
      onMouseUp={cancelHold}
      onMouseLeave={cancelHold}
      onTouchStart={startHold}
      onTouchEnd={cancelHold}
      onTouchCancel={cancelHold}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      disabled={disabled}
      type='button'
      aria-label={`${label} (press and hold for ${(holdDurationMs / 1000).toFixed(1)}s)`}
      aria-pressed={isHolding}
    >
      {/* Visual progress bar fill */}
      <span
        className='hold-progress-fill'
        style={{ width: `${progress}%` }}
        aria-hidden='true'
      />

      <span className='hold-btn-content'>
        <Icon size={14} className={isHolding ? 'pulse-icon' : ''} />
        <b>
          {isTriggered
            ? completedLabel
            : isHolding
              ? `${actionName} ${Math.round(progress)}%`
              : label}
        </b>
      </span>
    </button>
  );
}
