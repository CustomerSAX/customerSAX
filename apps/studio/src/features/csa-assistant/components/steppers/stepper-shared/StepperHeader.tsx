'use client';

import { Button } from '@csa/ui';
import { StepDots, type StepDotsProps } from './StepDots';

export interface StepperHeaderProps {
  stepDots: StepDotsProps;
  eyebrow: string;
  title: string;
  sub?: string;
  onClose: () => void;
  closeTitle: string;
}

/** Shared header: step dots + close button + eyebrow/title/sub text. */
export function StepperHeader({ stepDots, eyebrow, title, sub, onClose, closeTitle }: StepperHeaderProps) {
  return (
    <div className="options-head">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <StepDots {...stepDots} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-auto w-auto px-1 py-0 text-lg leading-none text-m-text-muted hover:translate-y-0"
          title={closeTitle}
        >
          &times;
        </Button>
      </div>
      <div className="options-eyebrow">{eyebrow}</div>
      <div className="options-title">{title}</div>
      {sub && <div className="options-sub">{sub}</div>}
    </div>
  );
}
