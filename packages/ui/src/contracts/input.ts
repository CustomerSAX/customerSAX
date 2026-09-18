import React from 'react';

export type CSAInputSize = 'sm' | 'md' | 'lg';

export interface CSAInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  inputSize?: CSAInputSize;
  size?: CSAInputSize;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  error?: boolean;
  errorMessage?: string;
}

export interface CSATextAreaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  errorMessage?: string;
  autoResize?: boolean;
}

export interface CSASearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onClear?: () => void;
  loading?: boolean;
  className?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}
