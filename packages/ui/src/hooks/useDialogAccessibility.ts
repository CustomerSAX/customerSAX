'use client';

import React from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true',
  );
}

/** Provides focus entry, containment, restoration, and background inerting for modal UI. */
export function useDialogAccessibility<T extends HTMLElement>({
  isOpen,
  onClose,
  closeOnEsc = true,
  initialFocusRef,
}: {
  isOpen: boolean;
  onClose: () => void;
  closeOnEsc?: boolean;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}) {
  const dialogRef = React.useRef<T>(null);
  const openerRef = React.useRef<HTMLElement | null>(null);
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  React.useEffect(() => {
    if (!isOpen || !dialogRef.current) return;

    const dialog = dialogRef.current;
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const backgroundSet = new Set<HTMLElement>();
    let current: HTMLElement = dialog;
    while (current.parentElement) {
      Array.from(current.parentElement.children).forEach((element) => {
        if (element instanceof HTMLElement && element !== current && !element.contains(dialog)) {
          backgroundSet.add(element);
        }
      });
      if (current.parentElement === document.body) break;
      current = current.parentElement;
    }
    const backgroundElements = Array.from(backgroundSet);
    const previousInertValues = backgroundElements.map((element) => element.inert);
    backgroundElements.forEach((element) => {
      element.inert = true;
    });

    const focusFrame = window.requestAnimationFrame(() => {
      const target = initialFocusRef?.current ?? getFocusableElements(dialog)[0] ?? dialog;
      target.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeOnEsc) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = getFocusableElements(dialog);
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      backgroundElements.forEach((element, index) => {
        element.inert = previousInertValues[index];
      });
      window.requestAnimationFrame(() => openerRef.current?.focus());
    };
  }, [closeOnEsc, initialFocusRef, isOpen]);

  return dialogRef;
}
