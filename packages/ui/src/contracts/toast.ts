import React from 'react';

export type CSAToastVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

export interface CSAToastOptions {
  id?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  variant?: CSAToastVariant;
  duration?: number;
}

export interface CSAToastProps {
  id: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  variant?: CSAToastVariant;
  onDismiss?: (id: string) => void;
  className?: string;
}
