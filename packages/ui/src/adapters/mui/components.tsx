'use client';

import { useState } from 'react';
import {
  Button as MuiButton,
  IconButton as MuiIconButton,
  TextField as MuiTextField,
  Select as MuiSelect,
  MenuItem as MuiMenuItem,
  InputLabel as MuiInputLabel,
  FormControl as MuiFormControl,
  FormHelperText as MuiFormHelperText,
  Checkbox as MuiCheckbox,
  Radio as MuiRadio,
  RadioGroup as MuiRadioGroup,
  FormControlLabel as MuiFormControlLabel,
  Switch as MuiSwitch,
  Dialog as MuiDialog,
  DialogTitle as MuiDialogTitle,
  DialogContent as MuiDialogContent,
  Drawer as MuiDrawer,
  Menu as MuiMenu,
  Popover as MuiPopover,
  Tooltip as MuiTooltip,
  Table as MuiTable,
  TableHead as MuiTableHead,
  TableBody as MuiTableBody,
  TableRow as MuiTableRow,
  TableCell as MuiTableCell,
  Pagination as MuiPagination,
  Chip as MuiChip,
  Avatar as MuiAvatar,
  Card as MuiCard,
  CardContent as MuiCardContent,
  Skeleton as MuiSkeleton,
  CircularProgress as MuiCircularProgress,
  Tabs as MuiTabs,
  Tab as MuiTab,
  Breadcrumbs as MuiBreadcrumbs,
  Accordion as MuiAccordion,
  AccordionSummary as MuiAccordionSummary,
  AccordionDetails as MuiAccordionDetails,
  Divider as MuiDivider,
  Typography as MuiTypography,
} from '@mui/material';

import { CSAUIComponentMap } from '../../contracts';
import { Icon } from '../../icons/Icon';

export const muiComponents: CSAUIComponentMap = {
  Button: ({
    variant = 'primary',
    size = 'md',
    loading = false,
    iconOnly = false,
    leftIcon,
    rightIcon,
    fullWidth = false,
    children,
    disabled,
    onClick,
    className,
    type = 'button',
  }) => {
    let muiVariant: 'contained' | 'outlined' | 'text' = 'contained';
    let color: 'primary' | 'secondary' | 'error' | 'inherit' = 'primary';

    if (variant === 'secondary') {
      muiVariant = 'contained';
      color = 'secondary'; // Distinct orange secondary color
    } else if (variant === 'outline') {
      muiVariant = 'outlined';
      color = 'primary';
    } else if (variant === 'ghost') {
      muiVariant = 'text';
      color = 'inherit';
    } else if (variant === 'danger') {
      muiVariant = 'contained';
      color = 'error';
    }

    const muiSize = size === 'sm' ? 'small' : size === 'lg' ? 'large' : 'medium';

    if (iconOnly) {
      return (
        <MuiIconButton
          color={color}
          size={muiSize}
          disabled={disabled || loading}
          onClick={onClick}
          className={className}
          type={type}
        >
          {loading ? <MuiCircularProgress size={18} color="inherit" /> : leftIcon || children}
        </MuiIconButton>
      );
    }

    return (
      <MuiButton
        variant={muiVariant}
        color={color}
        size={muiSize}
        disabled={disabled || loading}
        fullWidth={fullWidth}
        startIcon={loading ? <MuiCircularProgress size={16} color="inherit" /> : leftIcon}
        endIcon={!loading ? rightIcon : undefined}
        onClick={onClick}
        className={className}
        type={type}
      >
        {children}
      </MuiButton>
    );
  },

  IconButton: ({ icon, size = 'md', variant = 'secondary', label, loading, onClick, disabled, className }) => {
    const muiSize = size === 'sm' ? 'small' : size === 'lg' ? 'large' : 'medium';
    const color = variant === 'secondary' ? 'secondary' : variant === 'danger' ? 'error' : 'primary';

    return (
      <MuiIconButton
        color={color}
        size={muiSize}
        aria-label={label}
        disabled={disabled || loading}
        onClick={onClick}
        className={className}
      >
        {loading ? <MuiCircularProgress size={18} color="inherit" /> : icon}
      </MuiIconButton>
    );
  },

  Input: ({ inputSize = 'md', size, leftIcon, rightIcon, error, errorMessage, className, ...props }) => {
    const s = size || inputSize;
    const muiSize = s === 'sm' ? 'small' : 'medium';
    return (
      <MuiTextField
        size={muiSize}
        error={error || Boolean(errorMessage)}
        helperText={errorMessage}
        slotProps={{
          input: {
            startAdornment: leftIcon ? <span className="mr-2 text-gray-500">{leftIcon}</span> : undefined,
            endAdornment: rightIcon ? <span className="ml-2 text-gray-500">{rightIcon}</span> : undefined,
          } as any,
        }}
        fullWidth
        className={className}
        {...(props as any)}
      />
    );
  },

  TextArea: ({ error, errorMessage, className, ...props }) => {
    return (
      <MuiTextField
        multiline
        minRows={3}
        error={error || Boolean(errorMessage)}
        helperText={errorMessage}
        fullWidth
        className={className}
        {...(props as any)}
      />
    );
  },

  SearchBar: ({ value, onChange, placeholder = 'Search...', onClear, loading, className, disabled }) => {
    return (
      <MuiTextField
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        size="small"
        fullWidth
        slotProps={{
          input: {
            startAdornment: <Icon name="search" size="sm" className="mr-2 text-gray-400" />,
            endAdornment: loading ? (
              <MuiCircularProgress size={16} color="secondary" />
            ) : value && onClear ? (
              <MuiIconButton size="small" onClick={onClear}>
                <Icon name="x" size="xs" />
              </MuiIconButton>
            ) : undefined,
          } as any,
        }}
        className={className}
      />
    );
  },

  Select: ({ options, value, defaultValue, placeholder, label, error, errorMessage, disabled, required, className, onChange }) => {
    return (
      <MuiFormControl size="small" fullWidth error={error || Boolean(errorMessage)} className={className}>
        {label && <MuiInputLabel required={required}>{label}</MuiInputLabel>}
        <MuiSelect
          value={value ?? defaultValue ?? ''}
          label={label}
          disabled={disabled}
          displayEmpty={Boolean(placeholder)}
          onChange={(e) => onChange && onChange(e.target.value as string)}
        >
          {placeholder && (
            <MuiMenuItem value="" disabled>
              <em>{placeholder}</em>
            </MuiMenuItem>
          )}
          {options.map((opt) => (
            <MuiMenuItem key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </MuiMenuItem>
          ))}
        </MuiSelect>
        {errorMessage && <MuiFormHelperText>{errorMessage}</MuiFormHelperText>}
      </MuiFormControl>
    );
  },

  Checkbox: ({ label, description, error, indeterminate, checked, defaultChecked, onChange, disabled, className }) => {
    return (
      <MuiFormControlLabel
        control={
          <MuiCheckbox
            checked={checked}
            defaultChecked={defaultChecked}
            indeterminate={indeterminate}
            color={error ? 'error' : 'secondary'} // Orange secondary accent
            disabled={disabled}
            onChange={(e) => onChange && onChange(e.target.checked)}
          />
        }
        label={
          <div>
            <div>{label}</div>
            {description && <div className="text-xs text-gray-500">{description}</div>}
          </div>
        }
        className={className}
      />
    );
  },

  Radio: ({ label, description, checked, onChange, disabled, className }) => {
    return (
      <MuiFormControlLabel
        control={
          <MuiRadio
            checked={checked}
            disabled={disabled}
            color="secondary" // Orange secondary accent
            onChange={(e) => onChange && onChange(e.target.checked)}
          />
        }
        label={
          <div>
            <div>{label}</div>
            {description && <div className="text-xs text-gray-500">{description}</div>}
          </div>
        }
        className={className}
      />
    );
  },

  RadioGroup: ({ name, options, value, defaultValue, onChange, orientation = 'vertical', disabled, className }) => {
    return (
      <MuiRadioGroup
        name={name}
        value={value}
        defaultValue={defaultValue}
        row={orientation === 'horizontal'}
        onChange={(e) => onChange && onChange(e.target.value)}
        className={className}
      >
        {options.map((opt) => (
          <MuiFormControlLabel
            key={opt.value}
            value={opt.value}
            disabled={disabled || opt.disabled}
            control={<MuiRadio color="secondary" />}
            label={
              <div>
                <div>{opt.label}</div>
                {opt.description && <div className="text-xs text-gray-500">{opt.description}</div>}
              </div>
            }
          />
        ))}
      </MuiRadioGroup>
    );
  },

  Switch: ({ label, description, checked, defaultChecked, onChange, disabled, className }) => {
    return (
      <MuiFormControlLabel
        control={
          <MuiSwitch
            checked={checked}
            defaultChecked={defaultChecked}
            disabled={disabled}
            color="secondary" // Orange secondary accent
            onChange={(e) => onChange && onChange(e.target.checked)}
          />
        }
        label={
          <div>
            <div>{label}</div>
            {description && <div className="text-xs text-gray-500">{description}</div>}
          </div>
        }
        className={className}
      />
    );
  },

  Label: ({ required, children, className, ...props }) => {
    return (
      <label className={`text-xs font-semibold text-gray-700 flex items-center gap-1 ${className || ''}`} {...props}>
        {children}
        {required && <span className="text-red-500">*</span>}
      </label>
    );
  },

  FormField: ({ label, required, error, helperText, children, className }) => {
    return (
      <div className={`flex flex-col gap-1.5 ${className || ''}`}>
        {label && (
          <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
            {label}
            {required && <span className="text-red-500">*</span>}
          </label>
        )}
        {children}
        {error && <span className="text-xs text-red-500">{error}</span>}
        {!error && helperText && <span className="text-xs text-gray-500">{helperText}</span>}
      </div>
    );
  },

  Separator: ({ orientation = 'horizontal', className }) => {
    return <MuiDivider orientation={orientation} className={className} />;
  },

  Text: ({ as = 'p', size = 'base', weight = 'regular', variant = 'default', truncate, children, className }) => {
    let color: string | undefined = undefined;
    if (variant === 'muted') color = 'text.secondary';
    if (variant === 'primary') color = 'primary.main';
    if (variant === 'secondary') color = 'secondary.main'; // Orange secondary
    if (variant === 'error') color = 'error.main';

    return (
      <MuiTypography
        component={as as any}
        noWrap={truncate}
        sx={{
          fontWeight: weight === 'bold' ? 700 : weight === 'semibold' ? 600 : weight === 'medium' ? 500 : 400,
          color,
          fontSize: size === 'xs' ? '0.75rem' : size === 'sm' ? '0.875rem' : size === 'lg' ? '1.125rem' : '1rem',
        }}
        className={className}
      >
        {children}
      </MuiTypography>
    );
  },

  Heading: ({ level = 2, children, className }) => {
    const variant = (`h${level}` as any);
    return (
      <MuiTypography variant={variant} sx={{ fontWeight: 700 }} className={className}>
        {children}
      </MuiTypography>
    );
  },

  Modal: ({ isOpen, onClose, title, description, children, size = 'md' }) => {
    const maxWidth = size === 'sm' ? 'xs' : size === 'lg' ? 'md' : size === 'xl' ? 'lg' : size === 'full' ? false : 'sm';
    return (
      <MuiDialog open={isOpen} onClose={onClose} maxWidth={maxWidth as any} fullWidth>
        {title && (
          <MuiDialogTitle>
            <div className="font-bold text-lg">{title}</div>
            {description && <div className="text-xs text-gray-500">{description}</div>}
          </MuiDialogTitle>
        )}
        <MuiDialogContent dividers>{children}</MuiDialogContent>
      </MuiDialog>
    );
  },

  Drawer: ({ isOpen, onClose, title, description, children, position = 'right' }) => {
    return (
      <MuiDrawer anchor={position} open={isOpen} onClose={onClose}>
        <div className="w-80 sm:w-96 p-6 flex flex-col h-full">
          {title && (
            <div className="mb-4 pb-2 border-b border-gray-100">
              <div className="font-bold text-lg">{title}</div>
              {description && <div className="text-xs text-gray-500">{description}</div>}
            </div>
          )}
          <div className="flex-1 overflow-y-auto">{children}</div>
        </div>
      </MuiDrawer>
    );
  },

  Dropdown: ({ trigger, items, align = 'end' }) => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const horizontalOrigin = align === 'start' ? 'left' : align === 'center' ? 'center' : 'right';

    return (
      <>
        <span onClick={(e) => setAnchorEl(e.currentTarget)}>{trigger}</span>
        <MuiMenu
          anchorEl={anchorEl}
          open={open}
          onClose={() => setAnchorEl(null)}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: horizontalOrigin,
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: horizontalOrigin,
          }}
        >
          {items.map((item) =>
            item.divider ? (
              <MuiDivider key={item.key} />
            ) : (
              <MuiMenuItem
                key={item.key}
                disabled={item.disabled}
                onClick={() => {
                  setAnchorEl(null);
                  item.onClick && item.onClick();
                }}
                sx={{ color: item.danger ? 'error.main' : undefined, gap: 1 }}
              >
                {item.icon}
                {item.label}
              </MuiMenuItem>
            ),
          )}
        </MuiMenu>
      </>
    );
  },

  Popover: ({ trigger, content, open, onOpenChange, align = 'center', side = 'bottom' }) => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const isControlled = open !== undefined;
    const isOpen = isControlled ? open : Boolean(anchorEl);
    const horizontalOrigin = align === 'start' ? 'left' : align === 'center' ? 'center' : 'right';

    return (
      <>
        <span onClick={(e) => {
          setAnchorEl(e.currentTarget);
          onOpenChange && onOpenChange(true);
        }}>
          {trigger}
        </span>
        <MuiPopover
          open={isOpen}
          anchorEl={anchorEl}
          onClose={() => {
            setAnchorEl(null);
            onOpenChange && onOpenChange(false);
          }}
          anchorOrigin={{
            vertical: side === 'top' ? 'top' : 'bottom',
            horizontal: horizontalOrigin,
          }}
          transformOrigin={{
            vertical: side === 'top' ? 'bottom' : 'top',
            horizontal: horizontalOrigin,
          }}
        >
          <div className="p-4">{content}</div>
        </MuiPopover>
      </>
    );
  },

  Tooltip: ({ content, children, side = 'top' }) => {
    const placement = side === 'top' ? 'top' : side === 'bottom' ? 'bottom' : side === 'left' ? 'left' : 'right';
    return (
      <MuiTooltip title={content} placement={placement} arrow>
        <span>{children}</span>
      </MuiTooltip>
    );
  },

  Toast: ({ title, description, variant = 'info', onDismiss, id }) => {
    const borderColor = variant === 'success' ? '#16A34A' : variant === 'error' ? '#DC2626' : '#EA580C';
    return (
      <div
        className="p-3 rounded border shadow-sm flex items-start justify-between bg-white border-l-4"
        style={{ borderLeftColor: borderColor }}
      >
        <div>
          <div className="font-semibold text-sm">{title}</div>
          {description && <div className="text-xs text-gray-600">{description}</div>}
        </div>
        {onDismiss && (
          <button onClick={() => onDismiss(id)} className="text-gray-400 hover:text-gray-600">
            <Icon name="x" size="xs" />
          </button>
        )}
      </div>
    );
  },

  Table: ({ data, columns, rowKey, isLoading, emptyText = 'No data available', onRowClick, hoverable = true, className }) => {
    if (isLoading) {
      return (
        <div className="p-8 flex justify-center items-center">
          <MuiCircularProgress color="secondary" />
        </div>
      );
    }

    if (!data || data.length === 0) {
      return <div className="p-8 text-center text-sm text-gray-500">{emptyText}</div>;
    }

    return (
      <div className={`overflow-x-auto border border-gray-200 rounded-lg ${className || ''}`}>
        <MuiTable size="small">
          <MuiTableHead sx={{ backgroundColor: 'grey.50' }}>
            <MuiTableRow>
              {columns.map((col) => (
                <MuiTableCell key={col.key} align={col.align || 'left'} sx={{ fontWeight: 700, width: col.width }}>
                  {col.header}
                </MuiTableCell>
              ))}
            </MuiTableRow>
          </MuiTableHead>
          <MuiTableBody>
            {data.map((row, rowIndex) => {
              const key = rowKey ? rowKey(row, rowIndex) : String(rowIndex);
              return (
                <MuiTableRow
                  key={key}
                  hover={hoverable}
                  onClick={() => onRowClick && onRowClick(row)}
                  sx={{
                    cursor: onRowClick ? 'pointer' : 'default',
                    '&:hover': onRowClick ? { backgroundColor: 'orange.50' } : undefined,
                  }}
                >
                  {columns.map((col) => (
                    <MuiTableCell key={col.key} align={col.align || 'left'}>
                      {col.render ? col.render(row, rowIndex) : (row as any)[col.key]}
                    </MuiTableCell>
                  ))}
                </MuiTableRow>
              );
            })}
          </MuiTableBody>
        </MuiTable>
      </div>
    );
  },

  Pagination: ({ currentPage, totalPages, onPageChange, className }) => {
    return (
      <div className={`flex justify-center my-4 ${className || ''}`}>
        <MuiPagination
          count={totalPages}
          page={currentPage}
          onChange={(_, page) => onPageChange(page)}
          color="secondary" // Orange pagination
        />
      </div>
    );
  },

  Badge: ({ variant = 'secondary', size = 'sm', children, className }) => {
    let color: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'default' = 'secondary';
    if (variant === 'primary') color = 'primary';
    if (variant === 'success') color = 'success';
    if (variant === 'warning') color = 'warning';
    if (variant === 'error') color = 'error';
    if (variant === 'neutral') color = 'default';

    return (
      <MuiChip
        label={children}
        color={color}
        size={size === 'xs' || size === 'sm' ? 'small' : 'medium'}
        sx={{ fontWeight: 600 }}
        className={className}
      />
    );
  },

  Chip: ({ label, onDelete, selected, disabled, variant = 'secondary' }) => {
    return (
      <MuiChip
        label={label}
        onDelete={onDelete}
        disabled={disabled}
        color={variant === 'secondary' ? 'secondary' : 'primary'}
        variant={selected ? 'filled' : 'outlined'}
      />
    );
  },

  Avatar: ({ src, name, initials, size = 'md', className }) => {
    const dim = size === 'xs' ? 24 : size === 'sm' ? 32 : size === 'lg' ? 48 : size === 'xl' ? 56 : 40;
    return (
      <MuiAvatar
        src={src}
        alt={name}
        sx={{ width: dim, height: dim, bgcolor: 'secondary.main', fontSize: '0.875rem' }}
        className={className}
      >
        {initials || (name ? name.slice(0, 2).toUpperCase() : '?')}
      </MuiAvatar>
    );
  },

  Card: ({ hoverable, padding = 'md', children, className }) => {
    return (
      <MuiCard
        variant="outlined"
        sx={{
          borderRadius: 2,
          transition: 'all 0.2s',
          '&:hover': hoverable ? { boxShadow: 3, borderColor: 'secondary.main' } : undefined,
        }}
        className={className}
      >
        <MuiCardContent sx={{ p: padding === 'none' ? 0 : padding === 'sm' ? 1.5 : padding === 'lg' ? 4 : 2.5 }}>
          {children}
        </MuiCardContent>
      </MuiCard>
    );
  },

  Skeleton: ({ width, height, animate = true, className }) => {
    return (
      <MuiSkeleton
        variant="rectangular"
        width={width}
        height={height}
        animation={animate ? 'wave' : false}
        sx={{ borderRadius: 1 }}
        className={className}
      />
    );
  },

  Loader: ({ size = 'md', color = 'secondary', className }) => {
    const s = size === 'xs' ? 16 : size === 'sm' ? 24 : size === 'lg' ? 40 : 32;
    return <MuiCircularProgress size={s} color={color === 'primary' ? 'primary' : 'secondary'} className={className} />;
  },

  EmptyState: ({ icon, title, description, action, className }) => {
    return (
      <div className={`flex flex-col items-center justify-center p-8 text-center rounded-lg border border-dashed border-orange-200 bg-orange-50/20 ${className || ''}`}>
        {icon && <div className="mb-3 text-orange-600">{icon}</div>}
        <h4 className="font-semibold text-gray-900 text-sm">{title}</h4>
        {description && <p className="text-xs text-gray-500 mt-1 max-w-sm">{description}</p>}
        {action && <div className="mt-4">{action}</div>}
      </div>
    );
  },

  Tabs: ({ tabs, activeTab, onChange, className }) => {
    return (
      <MuiTabs
        value={activeTab}
        onChange={(_, val) => onChange(val)}
        textColor="secondary"
        indicatorColor="secondary"
        className={className}
      >
        {tabs.map((tab) => (
          <MuiTab key={tab.id} value={tab.id} label={tab.label} icon={tab.icon as any} disabled={tab.disabled} />
        ))}
      </MuiTabs>
    );
  },

  Breadcrumbs: ({ items, separator = '/', className }) => {
    return (
      <MuiBreadcrumbs separator={separator} className={className}>
        {items.map((item, idx) => (
          <span
            key={idx}
            onClick={item.onClick}
            className={`text-xs ${item.onClick || item.href ? 'text-orange-600 hover:underline cursor-pointer' : 'text-gray-500'}`}
          >
            {item.label}
          </span>
        ))}
      </MuiBreadcrumbs>
    );
  },

  Accordion: ({ items, allowMultiple: _allowMultiple, defaultOpen, className }) => {
    return (
      <div className={className}>
        {items.map((item) => (
          <MuiAccordion key={item.id} defaultExpanded={defaultOpen?.includes(item.id)} disabled={item.disabled}>
            <MuiAccordionSummary expandIcon={<Icon name="chevron-down" size="sm" />}>
              <span className="font-semibold text-sm">{item.title}</span>
            </MuiAccordionSummary>
            <MuiAccordionDetails>{item.content}</MuiAccordionDetails>
          </MuiAccordion>
        ))}
      </div>
    );
  },

  PageHeader: ({ title, subtitle, breadcrumbs, actions, badges, className }) => {
    return (
      <div className={`mb-6 pb-4 border-b border-orange-100 flex flex-col gap-3 ${className || ''}`}>
        {breadcrumbs && <div>{breadcrumbs}</div>}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
              {badges}
            </div>
            {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </div>
    );
  },

  PageShell: ({ children, header, className, padded = true }) => {
    return (
      <div className={`flex flex-col w-full min-h-screen bg-gray-50/50 ${padded ? 'p-6' : ''} ${className || ''}`}>
        {header}
        <main className="flex-1 w-full">{children}</main>
      </div>
    );
  },

  Panel: ({ title, actions, footer, children, className }) => {
    return (
      <div className={`rounded-lg border border-orange-100 bg-white shadow-xs overflow-hidden ${className || ''}`}>
        {title && (
          <div className="px-5 py-3 border-b border-orange-100 bg-orange-50/30 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            {actions && <div>{actions}</div>}
          </div>
        )}
        <div className="p-5">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-orange-100 bg-gray-50/50">{footer}</div>}
      </div>
    );
  },

  Toolbar: ({ left, right, children, className }) => {
    return (
      <div className={`flex items-center justify-between p-3 bg-white border border-orange-100 rounded-lg shadow-xs ${className || ''}`}>
        <div className="flex items-center gap-2">{left || children}</div>
        {right && <div className="flex items-center gap-2">{right}</div>}
      </div>
    );
  },

  StickyActionBar: ({ children, actions, className }) => {
    return (
      <div className={`sticky bottom-0 z-10 flex items-center justify-between p-4 bg-white/95 backdrop-blur-sm border-t border-orange-200 shadow-md ${className || ''}`}>
        <div>{children}</div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    );
  },
};
