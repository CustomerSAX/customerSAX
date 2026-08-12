'use client';

import React from 'react';
import { cn } from '../../utils';
import { Icon } from '../../icons/Icon';
import { Button } from '../../primitives/Button';

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  children: React.ReactNode;
}

export function Table({ className, children, ...props }: TableProps) {
  return (
    <div className="w-full overflow-x-auto rounded-m-lg border border-m-border bg-m-surface shadow-m-xs">
      <table className={cn('w-full text-left border-collapse text-xs text-m-text', className)} {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ className, children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={cn('bg-m-surface-2 border-b border-m-border text-m-text-muted font-semibold uppercase tracking-wider text-[11px]', className)} {...props}>
      {children}
    </thead>
  );
}

export function TableBody({ className, children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn('divide-y divide-m-border/60 bg-m-surface', className)} {...props}>
      {children}
    </tbody>
  );
}

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean;
  clickable?: boolean;
}

export function TableRow({ selected = false, clickable = false, className, children, ...props }: TableRowProps) {
  return (
    <tr
      className={cn(
        'transition-colors duration-150',
        clickable && 'cursor-pointer hover:bg-m-surface-2/70',
        !clickable && 'hover:bg-m-surface-2/40',
        selected && 'bg-m-primary-50/60 hover:bg-m-primary-50',
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sortable?: boolean;
  sortDirection?: 'asc' | 'desc' | false;
  onSort?: () => void;
}

export function TableHead({
  sortable = false,
  sortDirection = false,
  onSort,
  className,
  children,
  ...props
}: TableHeadProps) {
  return (
    <th
      className={cn(
        'px-4 py-3 font-semibold select-none',
        sortable && 'cursor-pointer hover:text-m-text',
        className,
      )}
      onClick={sortable ? onSort : undefined}
      {...props}
    >
      <div className="inline-flex items-center gap-1.5">
        <span>{children}</span>
        {sortable && (
          <span className="text-m-text-muted">
            {sortDirection === 'asc' ? (
              <Icon name="chevron-up" size="xs" />
            ) : sortDirection === 'desc' ? (
              <Icon name="chevron-down" size="xs" />
            ) : (
              <Icon name="chevrons-up-down" size="xs" />
            )}
          </span>
        )}
      </div>
    </th>
  );
}

export function TableCell({ className, children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('px-4 py-3 align-middle text-xs', className)} {...props}>
      {children}
    </td>
  );
}

export interface TablePaginationProps {
  page: number;
  totalPages: number;
  totalItems?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export function TablePagination({
  page,
  totalPages,
  totalItems,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  className,
}: TablePaginationProps) {
  const startItem = totalItems ? (page - 1) * pageSize + 1 : 0;
  const endItem = totalItems ? Math.min(page * pageSize, totalItems) : 0;

  return (
    <tfoot>
      <tr>
        <td colSpan={100} className="p-0">
          <div className={cn('flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-m-border bg-m-surface-2/40 text-xs text-m-text-muted', className)}>
      <div className="flex items-center gap-4">
        {totalItems !== undefined && (
          <span>
            Showing <strong className="font-semibold text-m-text">{startItem}</strong> to{' '}
            <strong className="font-semibold text-m-text">{endItem}</strong> of{' '}
            <strong className="font-semibold text-m-text">{totalItems}</strong> entries
          </span>
        )}
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5">
            <span>Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded border border-m-border bg-m-surface px-2 py-1 text-xs text-m-text outline-none focus:border-m-primary"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          iconOnly
          leftIcon={<Icon name="chevron-left" size="xs" />}
          aria-label="Previous page"
        />
        <span className="px-2 font-medium text-m-text">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          iconOnly
          leftIcon={<Icon name="chevron-right" size="xs" />}
          aria-label="Next page"
        />
      </div>
          </div>
        </td>
      </tr>
    </tfoot>
  );
}

Table.Header = TableHeader;
Table.Body = TableBody;
Table.Row = TableRow;
Table.Head = TableHead;
Table.Cell = TableCell;
Table.Pagination = TablePagination;
