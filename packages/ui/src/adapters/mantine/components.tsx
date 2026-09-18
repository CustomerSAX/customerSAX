'use client';

import {
  Button as MantineButton,
  ActionIcon as MantineActionIcon,
  TextInput as MantineTextInput,
  Textarea as MantineTextarea,
  Select as MantineSelect,
  Checkbox as MantineCheckbox,
  Radio as MantineRadio,
  Switch as MantineSwitch,
  Modal as MantineModal,
  Drawer as MantineDrawer,
  Menu as MantineMenu,
  Popover as MantinePopover,
  Tooltip as MantineTooltip,
  Table as MantineTable,
  Pagination as MantinePagination,
  Badge as MantineBadge,
  Avatar as MantineAvatar,
  Card as MantineCard,
  Skeleton as MantineSkeleton,
  Loader as MantineLoader,
  Tabs as MantineTabs,
  Breadcrumbs as MantineBreadcrumbs,
  Accordion as MantineAccordion,
  Divider as MantineDivider,
  Text as MantineText,
  Title as MantineTitle,
} from '@mantine/core';

import { CSAUIComponentMap } from '../../contracts';
import { Icon } from '../../icons/Icon';

export const mantineComponents: CSAUIComponentMap = {
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
    let mantineVariant: 'filled' | 'light' | 'outline' | 'subtle' = 'filled';
    let color = 'blue';

    if (variant === 'secondary') {
      mantineVariant = 'filled';
      color = 'teal'; // Distinct teal secondary color
    } else if (variant === 'outline') {
      mantineVariant = 'outline';
      color = 'blue';
    } else if (variant === 'ghost') {
      mantineVariant = 'subtle';
      color = 'gray';
    } else if (variant === 'danger') {
      mantineVariant = 'filled';
      color = 'red';
    }

    const mantineSize = size === 'sm' ? 'xs' : size === 'lg' ? 'md' : 'sm';

    if (iconOnly) {
      return (
        <MantineActionIcon
          variant={mantineVariant}
          color={color}
          size={mantineSize}
          loading={loading}
          disabled={disabled}
          onClick={onClick}
          className={className}
          type={type}
        >
          {leftIcon || children}
        </MantineActionIcon>
      );
    }

    return (
      <MantineButton
        variant={mantineVariant}
        color={color}
        size={mantineSize}
        loading={loading}
        disabled={disabled}
        fullWidth={fullWidth}
        leftSection={leftIcon}
        rightSection={rightIcon}
        onClick={onClick}
        className={className}
        type={type}
      >
        {children}
      </MantineButton>
    );
  },

  IconButton: ({ icon, size = 'md', variant = 'secondary', label, loading, onClick, disabled, className }) => {
    const mantineSize = size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'md';
    const color = variant === 'secondary' ? 'teal' : variant === 'danger' ? 'red' : 'blue';
    const mantineVariant = variant === 'ghost' ? 'subtle' : variant === 'outline' ? 'outline' : 'filled';

    return (
      <MantineActionIcon
        variant={mantineVariant}
        color={color}
        size={mantineSize}
        aria-label={label}
        loading={loading}
        disabled={disabled}
        onClick={onClick}
        className={className}
      >
        {icon}
      </MantineActionIcon>
    );
  },

  Input: ({ inputSize = 'md', size, leftIcon, rightIcon, error, errorMessage, className, ...props }) => {
    const s = size || inputSize;
    const mantineSize = s === 'sm' ? 'xs' : s === 'lg' ? 'md' : 'sm';
    return (
      <MantineTextInput
        size={mantineSize}
        leftSection={leftIcon}
        rightSection={rightIcon}
        error={errorMessage || (error ? true : undefined)}
        className={className}
        {...(props as any)}
      />
    );
  },

  TextArea: ({ error, errorMessage, className, ...props }) => {
    return (
      <MantineTextarea
        error={errorMessage || (error ? true : undefined)}
        className={className}
        {...(props as any)}
      />
    );
  },

  SearchBar: ({ value, onChange, placeholder = 'Search...', onClear, loading, className, disabled }) => {
    return (
      <MantineTextInput
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        placeholder={placeholder}
        disabled={disabled}
        leftSection={<Icon name="search" size="sm" />}
        rightSection={
          loading ? (
            <MantineLoader size="xs" color="teal" />
          ) : value && onClear ? (
            <MantineActionIcon size="xs" variant="transparent" onClick={onClear}>
              <Icon name="x" size="xs" />
            </MantineActionIcon>
          ) : null
        }
        className={className}
      />
    );
  },

  Select: ({ options, value, defaultValue, placeholder, label, error, errorMessage, disabled, required, className, onChange }) => {
    const data = options.map((opt) => ({
      value: opt.value,
      label: opt.label,
      disabled: opt.disabled,
    }));

    return (
      <MantineSelect
        data={data}
        value={value}
        defaultValue={defaultValue}
        placeholder={placeholder}
        label={label}
        disabled={disabled}
        required={required}
        error={errorMessage || (error ? true : undefined)}
        onChange={(val) => val && onChange && onChange(val)}
        className={className}
      />
    );
  },

  Checkbox: ({ label, description, error, indeterminate, checked, defaultChecked, onChange, disabled, className }) => {
    return (
      <MantineCheckbox
        label={label}
        description={description}
        error={error}
        indeterminate={indeterminate}
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled}
        color="teal" // Teal secondary accent
        onChange={(e) => onChange && onChange(e.currentTarget.checked)}
        className={className}
      />
    );
  },

  Radio: ({ label, description, checked, onChange, disabled, className }) => {
    return (
      <MantineRadio
        label={label}
        description={description}
        checked={checked}
        disabled={disabled}
        color="teal" // Teal secondary accent
        onChange={(e) => onChange && onChange(e.currentTarget.checked)}
        className={className}
      />
    );
  },

  RadioGroup: ({ name, options, value, defaultValue, onChange, orientation = 'vertical', disabled, className }) => {
    return (
      <MantineRadio.Group
        name={name}
        value={value}
        defaultValue={defaultValue}
        onChange={(val) => onChange && onChange(val)}
        className={className}
      >
        <div className={`flex ${orientation === 'horizontal' ? 'flex-row gap-4' : 'flex-col gap-2'}`}>
          {options.map((opt) => (
            <MantineRadio
              key={opt.value}
              value={opt.value}
              label={opt.label}
              description={opt.description}
              disabled={disabled || opt.disabled}
              color="teal"
            />
          ))}
        </div>
      </MantineRadio.Group>
    );
  },

  Switch: ({ label, description, checked, defaultChecked, onChange, disabled, size = 'md', className }) => {
    const mantineSize = size === 'sm' ? 'xs' : size === 'lg' ? 'md' : 'sm';
    return (
      <MantineSwitch
        label={label}
        description={description}
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled}
        size={mantineSize}
        color="teal" // Teal secondary accent
        onChange={(e) => onChange && onChange(e.currentTarget.checked)}
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
    return <MantineDivider orientation={orientation} className={className} />;
  },

  Text: ({ as = 'p', size = 'base', weight = 'regular', variant = 'default', truncate, children, className }) => {
    let color = undefined;
    if (variant === 'muted') color = 'dimmed';
    if (variant === 'primary') color = 'blue';
    if (variant === 'secondary') color = 'teal'; // Teal secondary
    if (variant === 'error') color = 'red';
    if (variant === 'success') color = 'green';

    return (
      <MantineText
        component={as as any}
        size={size === 'xs' ? 'xs' : size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'md'}
        fw={weight === 'bold' ? 700 : weight === 'semibold' ? 600 : weight === 'medium' ? 500 : 400}
        c={color}
        truncate={truncate ? 'end' : undefined}
        className={className}
      >
        {children}
      </MantineText>
    );
  },

  Heading: ({ level = 2, children, className }) => {
    const order = (level >= 1 && level <= 6 ? level : 2) as 1 | 2 | 3 | 4 | 5 | 6;
    return (
      <MantineTitle order={order} className={className}>
        {children}
      </MantineTitle>
    );
  },

  Modal: ({ isOpen, onClose, title, description, children, size = 'md' }) => {
    const mantineSize = size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : size === 'xl' ? 'xl' : size === 'full' ? '100%' : 'md';
    return (
      <MantineModal
        opened={isOpen}
        onClose={onClose}
        title={
          <div>
            {title && <div className="font-bold text-base text-gray-900">{title}</div>}
            {description && <div className="text-xs text-gray-500">{description}</div>}
          </div>
        }
        size={mantineSize}
      >
        {children}
      </MantineModal>
    );
  },

  Drawer: ({ isOpen, onClose, title, description, children, position = 'right', size = 'md' }) => {
    const mantineSize = size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : size === 'xl' ? 'xl' : size === 'full' ? '100%' : 'md';
    return (
      <MantineDrawer
        opened={isOpen}
        onClose={onClose}
        position={position}
        size={mantineSize}
        title={
          <div>
            {title && <div className="font-bold text-base text-gray-900">{title}</div>}
            {description && <div className="text-xs text-gray-500">{description}</div>}
          </div>
        }
      >
        {children}
      </MantineDrawer>
    );
  },

  Dropdown: ({ trigger, items, align = 'end' }) => {
    const position = align === 'start' ? 'bottom-start' : align === 'center' ? 'bottom' : 'bottom-end';
    return (
      <MantineMenu position={position} shadow="md" width={200}>
        <MantineMenu.Target>{trigger}</MantineMenu.Target>
        <MantineMenu.Dropdown>
          {items.map((item) =>
            item.divider ? (
              <MantineMenu.Divider key={item.key} />
            ) : (
              <MantineMenu.Item
                key={item.key}
                leftSection={item.icon}
                color={item.danger ? 'red' : undefined}
                disabled={item.disabled}
                onClick={item.onClick}
              >
                {item.label}
              </MantineMenu.Item>
            ),
          )}
        </MantineMenu.Dropdown>
      </MantineMenu>
    );
  },

  Popover: ({ trigger, content, align = 'center', side = 'bottom', open, onOpenChange }) => {
    const position = `${side}-${align === 'start' ? 'start' : align === 'end' ? 'end' : 'center'}` as any;
    return (
      <MantinePopover opened={open} onChange={onOpenChange} position={position} shadow="md">
        <MantinePopover.Target>{trigger}</MantinePopover.Target>
        <MantinePopover.Dropdown>{content}</MantinePopover.Dropdown>
      </MantinePopover>
    );
  },

  Tooltip: ({ content, children, side = 'top', align = 'center' }) => {
    const position = `${side}-${align === 'start' ? 'start' : align === 'end' ? 'end' : 'center'}` as any;
    return (
      <MantineTooltip label={content} position={position} withArrow>
        <span>{children}</span>
      </MantineTooltip>
    );
  },

  Toast: ({ title, description, variant = 'info', onDismiss, id }) => {
    const color = variant === 'success' ? 'green' : variant === 'error' ? 'red' : variant === 'warning' ? 'yellow' : 'teal';
    return (
      <div className={`p-3 rounded border shadow-sm flex items-start justify-between bg-white border-l-4 border-l-${color}-500`}>
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

  Table: ({ data, columns, rowKey, isLoading, emptyText = 'No data available', onRowClick, striped = true, hoverable = true, className }) => {
    if (isLoading) {
      return (
        <div className="p-8 flex justify-center items-center">
          <MantineLoader color="teal" />
        </div>
      );
    }

    if (!data || data.length === 0) {
      return <div className="p-8 text-center text-sm text-gray-500">{emptyText}</div>;
    }

    return (
      <div className={`overflow-x-auto border border-gray-200 rounded-lg ${className || ''}`}>
        <MantineTable striped={striped} highlightOnHover={hoverable}>
          <MantineTable.Thead className="bg-gray-50">
            <MantineTable.Tr>
              {columns.map((col) => (
                <MantineTable.Th key={col.key} style={{ width: col.width, textAlign: col.align || 'left' }}>
                  {col.header}
                </MantineTable.Th>
              ))}
            </MantineTable.Tr>
          </MantineTable.Thead>
          <MantineTable.Tbody>
            {data.map((row, rowIndex) => {
              const key = rowKey ? rowKey(row, rowIndex) : String(rowIndex);
              return (
                <MantineTable.Tr
                  key={key}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={onRowClick ? 'cursor-pointer hover:bg-teal-50/40 transition-colors' : ''}
                >
                  {columns.map((col) => (
                    <MantineTable.Td key={col.key} style={{ textAlign: col.align || 'left' }}>
                      {col.render ? col.render(row, rowIndex) : (row as any)[col.key]}
                    </MantineTable.Td>
                  ))}
                </MantineTable.Tr>
              );
            })}
          </MantineTable.Tbody>
        </MantineTable>
      </div>
    );
  },

  Pagination: ({ currentPage, totalPages, onPageChange, className }) => {
    return (
      <div className={`flex justify-center my-4 ${className || ''}`}>
        <MantinePagination
          value={currentPage}
          total={totalPages}
          onChange={onPageChange}
          color="teal" // Teal pagination
        />
      </div>
    );
  },

  Badge: ({ variant = 'secondary', size = 'sm', children, className }) => {
    let color = 'teal'; // default secondary is teal
    if (variant === 'primary') color = 'blue';
    if (variant === 'brand') color = 'yellow';
    if (variant === 'success') color = 'green';
    if (variant === 'warning') color = 'orange';
    if (variant === 'error') color = 'red';
    if (variant === 'neutral') color = 'gray';

    const mantineSize = size === 'xs' ? 'xs' : size === 'md' ? 'md' : 'sm';

    return (
      <MantineBadge color={color} size={mantineSize} variant="light" className={className}>
        {children}
      </MantineBadge>
    );
  },

  Chip: ({ label, onDelete, selected, disabled, variant = 'secondary' }) => {
    const color = variant === 'secondary' ? 'teal' : 'blue';
    return (
      <MantineBadge
        color={color}
        variant={selected ? 'filled' : 'outline'}
        size="md"
        rightSection={
          onDelete && !disabled ? (
            <button onClick={onDelete} className="ml-1 text-xs hover:opacity-75">
              ×
            </button>
          ) : undefined
        }
      >
        {label}
      </MantineBadge>
    );
  },

  Avatar: ({ src, name, initials, size = 'md', className }) => {
    const mantineSize = size === 'xs' ? 'xs' : size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : size === 'xl' ? 'xl' : 'md';
    return (
      <MantineAvatar src={src} alt={name} size={mantineSize} color="teal" radius="xl" className={className}>
        {initials || (name ? name.slice(0, 2).toUpperCase() : '?')}
      </MantineAvatar>
    );
  },

  Card: ({ hoverable, padding = 'md', children, className }) => {
    const p = padding === 'none' ? 0 : padding === 'sm' ? 'xs' : padding === 'lg' ? 'xl' : 'md';
    return (
      <MantineCard
        shadow="xs"
        padding={p}
        radius="md"
        withBorder
        className={`${hoverable ? 'hover:shadow-md hover:border-teal-400 transition-all' : ''} ${className || ''}`}
      >
        {children}
      </MantineCard>
    );
  },

  Skeleton: ({ width, height, animate = true, className }) => {
    return <MantineSkeleton width={width} height={height} animate={animate} className={className} />;
  },

  Loader: ({ size = 'md', color = 'teal', className }) => {
    const mantineSize = size === 'xs' ? 'xs' : size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'md';
    return <MantineLoader size={mantineSize} color={color} className={className} />;
  },

  EmptyState: ({ icon, title, description, action, className }) => {
    return (
      <div className={`flex flex-col items-center justify-center p-8 text-center rounded-lg border border-dashed border-teal-200 bg-teal-50/20 ${className || ''}`}>
        {icon && <div className="mb-3 text-teal-600">{icon}</div>}
        <h4 className="font-semibold text-gray-900 text-sm">{title}</h4>
        {description && <p className="text-xs text-gray-500 mt-1 max-w-sm">{description}</p>}
        {action && <div className="mt-4">{action}</div>}
      </div>
    );
  },

  Tabs: ({ tabs, activeTab, onChange, className }) => {
    return (
      <MantineTabs value={activeTab} onChange={(val) => val && onChange(val)} color="teal" className={className}>
        <MantineTabs.List>
          {tabs.map((tab) => (
            <MantineTabs.Tab key={tab.id} value={tab.id} leftSection={tab.icon} disabled={tab.disabled}>
              {tab.label}
              {tab.badge && <span className="ml-1.5">{tab.badge}</span>}
            </MantineTabs.Tab>
          ))}
        </MantineTabs.List>
      </MantineTabs>
    );
  },

  Breadcrumbs: ({ items, separator = '/', className }) => {
    return (
      <MantineBreadcrumbs separator={separator} className={className}>
        {items.map((item, idx) => (
          <span
            key={idx}
            onClick={item.onClick}
            className={`text-xs ${item.onClick || item.href ? 'text-teal-600 hover:underline cursor-pointer' : 'text-gray-500'}`}
          >
            {item.label}
          </span>
        ))}
      </MantineBreadcrumbs>
    );
  },

  Accordion: ({ items, allowMultiple, defaultOpen, className }) => {
    const defaultValue = allowMultiple ? (defaultOpen || []) : (defaultOpen?.[0] || null);
    return (
      <MantineAccordion multiple={allowMultiple as any} defaultValue={defaultValue as any} className={className}>
        {items.map((item) => (
          <MantineAccordion.Item key={item.id} value={item.id}>
            <MantineAccordion.Control disabled={item.disabled}>{item.title}</MantineAccordion.Control>
            <MantineAccordion.Panel>{item.content}</MantineAccordion.Panel>
          </MantineAccordion.Item>
        ))}
      </MantineAccordion>
    );
  },

  PageHeader: ({ title, subtitle, breadcrumbs, actions, badges, className }) => {
    return (
      <div className={`mb-6 pb-4 border-b border-teal-100 flex flex-col gap-3 ${className || ''}`}>
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
      <div className={`rounded-lg border border-teal-100 bg-white shadow-xs overflow-hidden ${className || ''}`}>
        {title && (
          <div className="px-5 py-3 border-b border-teal-100 bg-teal-50/30 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            {actions && <div>{actions}</div>}
          </div>
        )}
        <div className="p-5">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-teal-100 bg-gray-50/50">{footer}</div>}
      </div>
    );
  },

  Toolbar: ({ left, right, children, className }) => {
    return (
      <div className={`flex items-center justify-between p-3 bg-white border border-teal-100 rounded-lg shadow-xs ${className || ''}`}>
        <div className="flex items-center gap-2">{left || children}</div>
        {right && <div className="flex items-center gap-2">{right}</div>}
      </div>
    );
  },

  StickyActionBar: ({ children, actions, className }) => {
    return (
      <div className={`sticky bottom-0 z-10 flex items-center justify-between p-4 bg-white/95 backdrop-blur-sm border-t border-teal-200 shadow-md ${className || ''}`}>
        <div>{children}</div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    );
  },
};
