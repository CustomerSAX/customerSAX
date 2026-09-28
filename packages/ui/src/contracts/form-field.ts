import React from 'react';

export interface CSALabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
  disabled?: boolean;
}

export interface CSAFormFieldProps {
  label?: React.ReactNode;
  id?: string;
  name?: string;
  required?: boolean;
  error?: string;
  helperText?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}
