import React from 'react';

export interface CSADropdownItem {
  key: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
  onClick?: () => void;
  divider?: boolean;
}

export interface CSADropdownProps {
  trigger: React.ReactNode;
  items: CSADropdownItem[];
  align?: 'start' | 'center' | 'end';
  className?: string;
  children?: React.ReactNode;
}
