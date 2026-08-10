'use client';

import React from 'react';
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
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '18px',
            cursor: 'pointer',
            color: '#6b7280',
            padding: '0 4px',
            lineHeight: 1,
          }}
          title={closeTitle}
        >
          &times;
        </button>
      </div>
      <div className="options-eyebrow">{eyebrow}</div>
      <div className="options-title">{title}</div>
      {sub && <div className="options-sub">{sub}</div>}
    </div>
  );
}
