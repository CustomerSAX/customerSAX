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
      style={{
        width: isCollapsed ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width)',
        background: 'linear-gradient(160deg, var(--csa-navy-900) 0%, var(--csa-navy-950) 100%)',
        borderRight: '1px solid var(--sidebar-border)',
        transition: 'width var(--duration-base) var(--ease-enterprise)',
      }}
      className={cn(
        'flex flex-col h-full select-none overflow-hidden shrink-0',
        className,
      )}
    >
      {/* ── Brand Header ─────────────────────────── */}
      <div
        style={{
          height: 'var(--topbar-height)',
          borderBottom: '1px solid var(--sidebar-border)',
          padding: isCollapsed ? '0 12px' : '0 16px',
        }}
        className="flex items-center justify-between shrink-0"
      >
        {!isCollapsed && brand && (
          <div
            style={{
              color: 'var(--csa-white)',
              fontSize: 'var(--text-lg)',
              fontWeight: 'var(--weight-bold)',
              letterSpacing: '-0.02em',
            }}
            className="truncate"
          >
            {brand}
          </div>
        )}

        {isCollapsed && (
          <div
            style={{
              color: 'var(--csa-white)',
              fontSize: 'var(--text-xl)',
              fontWeight: 'var(--weight-extrabold)',
            }}
            className="mx-auto"
          >
            {'C'}
          </div>
        )}

        {collapsible && (
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{
              color: 'var(--sidebar-text)',
              padding: '6px',
              borderRadius: 'var(--radius-md)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              transition: 'color var(--duration-fast), background var(--duration-fast)',
              marginLeft: isCollapsed ? 'auto' : '4px',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--csa-white)';
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--sidebar-item-hover)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--sidebar-text)';
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            }}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Icon name={isCollapsed ? 'panel-left-open' : 'panel-left-close'} size="sm" />
          </button>
        )}
      </div>

      {/* ── Nav Groups ───────────────────────────── */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {groups.map((group) => (
          <div key={group.id} className="mb-2">
            {!isCollapsed && group.title && (
              <div
                style={{
                  color: 'var(--sidebar-group-label)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 'var(--weight-semibold)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  padding: '8px 12px 4px',
                }}
              >
                {group.title}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = activeItemId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={item.disabled}
                    onClick={() => onSelectItem?.(item)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      width: '100%',
                      gap: isCollapsed ? 0 : '10px',
                      padding: isCollapsed ? '10px 0' : '9px 12px',
                      justifyContent: isCollapsed ? 'center' : 'flex-start',
                      borderRadius: 'var(--radius-lg)',
                      border: 'none',
                      cursor: item.disabled ? 'not-allowed' : 'pointer',
                      opacity: item.disabled ? 0.4 : 1,
                      transition: 'background var(--duration-fast), color var(--duration-fast)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: isActive ? 'var(--weight-semibold)' : 'var(--weight-medium)',
                      background: isActive ? 'var(--sidebar-item-active-bg)' : 'transparent',
                      color: isActive ? 'var(--sidebar-text-active)' : 'var(--sidebar-text)',
                    }}
                    onMouseEnter={e => {
                      if (!isActive) {
                        (e.currentTarget as HTMLButtonElement).style.background = 'var(--sidebar-item-hover)';
                        (e.currentTarget as HTMLButtonElement).style.color = 'var(--sidebar-text-hover)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isActive) {
                        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                        (e.currentTarget as HTMLButtonElement).style.color = 'var(--sidebar-text)';
                      }
                    }}
                    title={isCollapsed ? item.label : undefined}
                  >
                    {item.icon && (
                      <Icon
                        name={item.icon}
                        size="sm"
                        style={{ color: isActive ? 'var(--sidebar-text-active)' : 'inherit', flexShrink: 0 }}
                      />
                    )}

                    {!isCollapsed && (
                      <span className="truncate flex-1 text-left">
                        {item.label}
                      </span>
                    )}

                    {!isCollapsed && item.badge && (
                      <span
                        style={{
                          padding: '1px 7px',
                          fontSize: 'var(--text-xs)',
                          fontWeight: 'var(--weight-semibold)',
                          borderRadius: 'var(--radius-full)',
                          background: isActive
                            ? 'rgba(5,8,46,0.18)'
                            : 'rgba(245,166,36,0.20)',
                          color: isActive
                            ? 'var(--sidebar-text-active)'
                            : 'var(--csa-yellow-400)',
                          minWidth: '20px',
                          textAlign: 'center',
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ── Footer ───────────────────────────────── */}
      {footer && (
        <div
          style={{ borderTop: '1px solid var(--sidebar-border)', padding: '12px' }}
          className="shrink-0"
        >
          {!isCollapsed ? footer : <div className="flex justify-center">{footer}</div>}
        </div>
      )}
    </aside>
  );
}
