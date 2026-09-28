import { CSAUIComponentMap } from '../../contracts';

// Existing primitives
import { Button as BaseButton } from '../../primitives/Button';
import { Input as BaseInput } from '../../primitives/Input';
import { TextArea as BaseTextArea } from '../../primitives/TextArea';
import { SearchBar as BaseSearchBar } from '../../primitives/SearchBar';
import { Select as BaseSelect } from '../../primitives/Select';
import { Checkbox as BaseCheckbox } from '../../primitives/Checkbox';
import { Radio as BaseRadio, RadioGroup as BaseRadioGroup } from '../../primitives/Radio';
import { Switch as BaseSwitch } from '../../primitives/Switch';
import { Label as BaseLabel } from '../../primitives/Label';
import { FormField as BaseFormField } from '../../primitives/FormField';
import { Separator as BaseSeparator } from '../../primitives/Separator';
import { Text as BaseText } from '../../primitives/Text';

// Existing components
import { Modal as BaseModal, ModalHeader, ModalBody } from '../../components/overlays/Modal';
import { Drawer as BaseDrawer } from '../../components/overlays/Drawer';
import { Dropdown as BaseDropdown } from '../../components/overlays/Dropdown';
import { Popover as BasePopover } from '../../components/overlays/Popover';
import { Tooltip as BaseTooltip } from '../../components/overlays/Tooltip';
import { Toast as BaseToast } from '../../components/overlays/Toast';
import { Table as BaseTable } from '../../components/data-display/Table';
import { Pagination as BasePagination } from '../../components/navigation/Pagination';
import { Badge as BaseBadge } from '../../components/data-display/Badge';
import { Chip as BaseChip } from '../../components/data-display/Chip';
import { Avatar as BaseAvatar } from '../../components/data-display/Avatar';
import { Card as BaseCard } from '../../components/data-display/Card';
import { Skeleton as BaseSkeleton } from '../../components/feedback/Skeleton';
import { LoadingSpinner as BaseLoadingSpinner } from '../../components/feedback/LoadingSpinner';
import { EmptyState as BaseEmptyState } from '../../components/feedback/EmptyState';
import { Tabs as BaseTabs } from '../../components/navigation/Tabs';
import { Breadcrumbs as BaseBreadcrumbs } from '../../components/navigation/Breadcrumbs';
import { Accordion as BaseAccordion } from '../../components/layout/Accordion';
import { PageHeader as BasePageHeader } from '../../components/layout/PageHeader';
import { PageShell as BasePageShell } from '../../components/layout/PageShell';
import { Panel as BasePanel } from '../../components/layout/Panel';
import { Toolbar as BaseToolbar } from '../../components/layout/Toolbar';
import { StickyActionBar as BaseStickyActionBar } from '../../components/layout/StickyActionBar';

export const csaCustomComponents: CSAUIComponentMap = {
  Button: BaseButton as any,
  IconButton: ({ icon, label, ...props }) => (
    <BaseButton iconOnly aria-label={label} {...(props as any)}>
      {icon}
    </BaseButton>
  ),
  Input: BaseInput as any,
  TextArea: BaseTextArea as any,
  SearchBar: BaseSearchBar as any,
  Select: BaseSelect as any,
  Checkbox: BaseCheckbox as any,
  Radio: BaseRadio as any,
  RadioGroup: BaseRadioGroup as any,
  Switch: BaseSwitch as any,
  Label: BaseLabel as any,
  FormField: BaseFormField as any,
  Separator: BaseSeparator as any,
  Text: BaseText as any,
  Heading: ({ level = 2, children, className, ...props }) => {
    const variant = (`h${Math.min(level, 4)}` as 'h1' | 'h2' | 'h3' | 'h4');
    return (
      <BaseText variant={variant} className={className} {...(props as any)}>
        {children}
      </BaseText>
    );
  },
  Modal: ({ title, description, children, ...props }) => (
    <BaseModal {...(props as any)}>
      {title && (
        <ModalHeader title={title} subtitle={description} onClose={props.onClose} />
      )}
      <ModalBody>{children}</ModalBody>
    </BaseModal>
  ),
  Drawer: BaseDrawer as any,
  Dropdown: BaseDropdown as any,
  Popover: BasePopover as any,
  Tooltip: BaseTooltip as any,
  Toast: BaseToast as any,
  Table: BaseTable as any,
  Pagination: BasePagination as any,
  Badge: BaseBadge as any,
  Chip: BaseChip as any,
  Avatar: BaseAvatar as any,
  Card: BaseCard as any,
  Skeleton: BaseSkeleton as any,
  Loader: ({ size, className }) => <BaseLoadingSpinner size={size} className={className} />,
  EmptyState: BaseEmptyState as any,
  Tabs: BaseTabs as any,
  Breadcrumbs: BaseBreadcrumbs as any,
  Accordion: BaseAccordion as any,
  PageHeader: BasePageHeader as any,
  PageShell: BasePageShell as any,
  Panel: BasePanel as any,
  Toolbar: BaseToolbar as any,
  StickyActionBar: BaseStickyActionBar as any,
};
