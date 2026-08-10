"use client";

import { useCallback, useRef, useState } from "react";
import type { ToastVariant } from "@csa/ui";

export interface ReportToastState {
  id: number;
  variant: ToastVariant;
  title: string;
}

const TOAST_DURATION_MS = 4000;

export function useReportToasts() {
  const [toasts, setToasts] = useState<ReportToastState[]>([]);
  const nextId = useRef(0);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    (variant: ToastVariant, title: string) => {
      nextId.current += 1;
      const id = nextId.current;
      setToasts((prev) => [...prev, { id, variant, title }]);
      window.setTimeout(() => dismissToast(id), TOAST_DURATION_MS);
    },
    [dismissToast],
  );

  return { toasts, pushToast, dismissToast };
}
