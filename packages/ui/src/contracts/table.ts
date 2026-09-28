import React from 'react';

export interface CSATableColumn<T = any> {
  key: string;
  header: React.ReactNode;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  render?: (row: T, index: number) => React.ReactNode;
}

export interface CSATableProps<T = any> {
  data: T[];
  columns: CSATableColumn<T>[];
  rowKey?: (row: T, index: number) => string;
  isLoading?: boolean;
  emptyText?: React.ReactNode;
  onRowClick?: (row: T) => void;
  className?: string;
  bordered?: boolean;
  striped?: boolean;
  hoverable?: boolean;
}

export interface CSAPaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount?: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  className?: string;
}
