import React from 'react';

export interface CSAPageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
  actions?: React.ReactNode;
  badges?: React.ReactNode;
  className?: string;
}

export interface CSAPageShellProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  className?: string;
  padded?: boolean;
}

export interface CSAPanelProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export interface CSAToolbarProps {
  left?: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export interface CSAStickyActionBarProps {
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export interface CSAAccordionItem {
  id: string;
  title: React.ReactNode;
  content: React.ReactNode;
  disabled?: boolean;
}

export interface CSAAccordionProps {
  items: CSAAccordionItem[];
  allowMultiple?: boolean;
  defaultOpen?: string[];
  className?: string;
}
