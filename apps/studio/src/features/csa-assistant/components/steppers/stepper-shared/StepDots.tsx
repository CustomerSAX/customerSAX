'use client';

import { Button } from '@csa/ui';

export interface StepDotsProps {
  /** Full ordered list of step ids (may include a trailing 'done' not shown in the track). */
  steps: string[];
  /** How many of `steps` render as dots — usually steps.length - 1 to exclude 'done'. */
  visibleCount: number;
  currentStep: string;
  activeColor: string;
  doneColor: string;
  isStepClickable: (index: number) => boolean;
  onStepClick: (step: string) => void;
}

/**
 * Shared step-progress track used by every Stepper panel (Order, Ticket, Return).
 * Colors stay per-caller since Order and Ticket use different "done" accents.
 */
export function StepDots({
  steps,
  visibleCount,
  currentStep,
  activeColor,
  doneColor,
  isStepClickable,
  onStepClick,
}: StepDotsProps) {
  const currentIdx = steps.indexOf(currentStep);

  return (
    <div className="steps-track" style={{ flex: 1, marginRight: '16px', display: 'flex', gap: '4px' }}>
      {steps.slice(0, visibleCount).map((s, i) => {
        const cls = i < currentIdx ? 'done' : i === currentIdx ? 'active' : '';
        const clickable = isStepClickable(i);
        return (
          <Button
            key={s}
            type="button"
            variant="ghost"
            iconOnly
            className={`step-dot ${cls}`}
            onClick={() => clickable && onStepClick(s)}
            disabled={!clickable}
            style={{
              flex: 1,
              height: '4px',
              border: 'none',
              padding: 0,
              cursor: clickable ? 'pointer' : 'not-allowed',
              backgroundColor: cls === 'active' ? activeColor : cls === 'done' ? doneColor : 'var(--color-border)',
              transition: 'all 0.2s ease',
              borderRadius: '2px',
            }}
            title={`Go to Step ${i + 1}: ${s}`}
          />
        );
      })}
    </div>
  );
}
