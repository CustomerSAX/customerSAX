import React from 'react';

export interface SuccessBoxProps {
  title: React.ReactNode;
  sub: React.ReactNode;
}

/** Shared "done" step display — checkmark icon + title + sub text. */
export function SuccessBox({ title, sub }: SuccessBoxProps) {
  return (
    <div className="success-box">
      <div className="success-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>
      <div className="success-title">{title}</div>
      <div className="success-sub">{sub}</div>
    </div>
  );
}
