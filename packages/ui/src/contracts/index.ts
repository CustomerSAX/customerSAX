import React from 'react';

import { CSAButtonProps, CSAIconButtonProps } from './button';
import { CSAInputProps, CSATextAreaProps, CSASearchBarProps } from './input';
import { CSASelectProps } from './select';
import { CSACheckboxProps } from './checkbox';
import { CSARadioProps, CSARadioGroupProps } from './radio';
import { CSASwitchProps } from './switch';
import { CSAFormFieldProps, CSALabelProps } from './form-field';
import { CSASeparatorProps } from './separator';
import { CSATextProps, CSAHeadingProps } from './typography';
import { CSAModalProps, CSADrawerProps } from './modal';
import { CSADropdownProps } from './dropdown';
import { CSAPopoverProps } from './popover';
import { CSATooltipProps } from './tooltip';
import { CSAToastProps } from './toast';
import { CSATableProps, CSAPaginationProps } from './table';
import { CSABadgeProps, CSAChipProps, CSAAvatarProps, CSACardProps } from './data-display';
import { CSAEmptyStateProps, CSASkeletonProps, CSALoaderProps } from './feedback';
import { CSATabsProps, CSABreadcrumbsProps } from './navigation';
import {
  CSAPageHeaderProps,
  CSAPageShellProps,
  CSAPanelProps,
  CSAToolbarProps,
  CSAStickyActionBarProps,
  CSAAccordionProps,
} from './layout';

export * from './button';
export * from './input';
export * from './select';
export * from './checkbox';
export * from './radio';
export * from './switch';
export * from './form-field';
export * from './separator';
export * from './typography';
export * from './modal';
export * from './dropdown';
export * from './popover';
export * from './tooltip';
export * from './toast';
export * from './table';
export * from './data-display';
export * from './feedback';
export * from './navigation';
export * from './layout';

export interface CSAUIComponentMap {
  Button: React.ComponentType<CSAButtonProps>;
  IconButton: React.ComponentType<CSAIconButtonProps>;
  Input: React.ComponentType<CSAInputProps>;
  TextArea: React.ComponentType<CSATextAreaProps>;
  SearchBar: React.ComponentType<CSASearchBarProps>;
  Select: React.ComponentType<CSASelectProps>;
  Checkbox: React.ComponentType<CSACheckboxProps>;
  Radio: React.ComponentType<CSARadioProps>;
  RadioGroup: React.ComponentType<CSARadioGroupProps>;
  Switch: React.ComponentType<CSASwitchProps>;
  Label: React.ComponentType<CSALabelProps>;
  FormField: React.ComponentType<CSAFormFieldProps>;
  Separator: React.ComponentType<CSASeparatorProps>;
  Text: React.ComponentType<CSATextProps>;
  Heading: React.ComponentType<CSAHeadingProps>;
  Modal: React.ComponentType<CSAModalProps>;
  Drawer: React.ComponentType<CSADrawerProps>;
  Dropdown: React.ComponentType<CSADropdownProps>;
  Popover: React.ComponentType<CSAPopoverProps>;
  Tooltip: React.ComponentType<CSATooltipProps>;
  Toast: React.ComponentType<CSAToastProps>;
  Table: React.ComponentType<CSATableProps<any>>;
  Pagination: React.ComponentType<CSAPaginationProps>;
  Badge: React.ComponentType<CSABadgeProps>;
  Chip: React.ComponentType<CSAChipProps>;
  Avatar: React.ComponentType<CSAAvatarProps>;
  Card: React.ComponentType<CSACardProps>;
  Skeleton: React.ComponentType<CSASkeletonProps>;
  Loader: React.ComponentType<CSALoaderProps>;
  EmptyState: React.ComponentType<CSAEmptyStateProps>;
  Tabs: React.ComponentType<CSATabsProps>;
  Breadcrumbs: React.ComponentType<CSABreadcrumbsProps>;
  Accordion: React.ComponentType<CSAAccordionProps>;
  PageHeader: React.ComponentType<CSAPageHeaderProps>;
  PageShell: React.ComponentType<CSAPageShellProps>;
  Panel: React.ComponentType<CSAPanelProps>;
  Toolbar: React.ComponentType<CSAToolbarProps>;
  StickyActionBar: React.ComponentType<CSAStickyActionBarProps>;
}
