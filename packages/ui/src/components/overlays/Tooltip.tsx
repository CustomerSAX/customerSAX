'use client';

import React, { useState } from 'react';
import { cn } from '../../utils';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  content: React.ReactNode;
  position?: TooltipPosition;
  delay?: number;
  children: React.ReactElement;
  className?: string;
}

const positionStyles: Record<TooltipPosition, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

export function Tooltip({
  content,
  position = 'top',
  delay = 150,
  children,
  className,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    const t = setTimeout(() => setIsVisible(true), delay);
    setTimer(t);
  };

  const hide = () => {
    if (timer) clearTimeout(timer);
    setIsVisible(false);
  };

  if (!content) return children;

  return (
    <div className="relative inline-block" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {isVisible && (
        <div
          role="tooltip"
          className={cn(
            'absolute z-[var(--m-z-tooltip)] px-2.5 py-1 rounded-m-md bg-m-neutral-900 text-white text-[11px] font-medium leading-normal whitespace-nowrap shadow-m-md pointer-events-none animate-in fade-in duration-150',
            positionStyles[position],
            className,
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}
