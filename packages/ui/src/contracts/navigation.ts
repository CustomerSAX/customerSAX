import React from 'react';

export interface CSATabItem {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  disabled?: boolean;
}

export interface CSATabsProps {
  tabs: CSATabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: 'underline' | 'pills' | 'segmented';
  className?: string;
}

export interface CSABreadcrumbItem {
  label: React.ReactNode;
  href?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}

export interface CSABreadcrumbsProps {
  items: CSABreadcrumbItem[];
  separator?: React.ReactNode;
  className?: string;
}
