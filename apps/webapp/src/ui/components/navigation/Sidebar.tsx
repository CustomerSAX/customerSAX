'use client';

import React, { useState } from 'react';
import { cn } from '../../utils';
import { Icon } from '../../icons/Icon';

export interface SidebarItem {
  id: string;
  label: string;
  icon?: string;
  href?: string;
  badge?: string | number;
  badgeVariant?: 'neutral' | 'primary' | 'success' | 'warning' | 'error';
  disabled?: boolean;
}

export interface SidebarGroup {
  id: string;
  title?: string;
  items: SidebarItem[];
}

export interface SidebarProps {
  brand?: React.ReactNode;
  groups: SidebarGroup[];
  activeItemId?: string;
  onSelectItem?: (item: SidebarItem) => void;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  footer?: React.ReactNode;
  className?: string;
}

export function Sidebar({
  brand,
  groups,
  activeItemId,
  onSelectItem,
  collapsible = true,
  defaultCollapsed = false,
  footer,
  className,
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-m-sidebar-bg text-m-sidebar-text border-r border-m-neutral-800 transition-all duration-300 ease-out select-none',
        isCollapsed ? 'w-[72px]' : 'w-64',
        className,
      )}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-m-neutral-800/80 shrink-0">
        {!isCollapsed && brand && <div className="truncate font-semibold text-white">{brand}</div>}
        {isCollapsed && brand && <div className="mx-auto font-bold text-white text-lg">M</div>}
        {collapsible && (
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-m-md text-m-sidebar-text hover:text-white hover:bg-m-sidebar-item-hover transition-colors outline-none ml-auto"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Icon name={isCollapsed ? 'panel-left-open' : 'panel-left-close'} size="sm" />
          </button>
        )}
      </div>

      {/* Nav Groups */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {groups.map((group) => (
          <div key={group.id} className="space-y-1">
            {!isCollapsed && group.title && (
              <h4 className="px-3 text-[10px] font-bold uppercase tracking-wider text-m-neutral-500 mb-2">
                {group.title}
              </h4>
            )}
            {group.items.map((item) => {
              const isActive = activeItemId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={item.disabled}
                  onClick={() => onSelectItem?.(item)}
                  className={cn(
                    'flex items-center w-full gap-3 px-3 py-2.5 rounded-m-lg text-xs font-medium transition-all outline-none',
                    isActive
                      ? 'bg-m-primary/20 text-white font-semibold border-l-2 border-m-primary'
                      : 'text-m-sidebar-text hover:bg-m-sidebar-item-hover hover:text-white',
                    item.disabled && 'opacity-40 cursor-not-allowed',
                    isCollapsed && 'justify-center px-0',
                  )}
                  title={isCollapsed ? item.label : undefined}
                >
                  {item.icon && <Icon name={item.icon} size="sm" className={cn(isActive && 'text-m-primary')} />}
                  {!isCollapsed && <span className="truncate flex-1 text-left">{item.label}</span>}
                  {!isCollapsed && item.badge && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-m-primary/30 text-m-primary-200">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer */}
      {footer && (
        <div className="p-3 border-t border-m-neutral-800/80 shrink-0">
          {!isCollapsed ? footer : <div className="flex justify-center">{footer}</div>}
        </div>
      )}
    </aside>
  );
}
