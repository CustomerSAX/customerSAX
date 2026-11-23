import type { Customer } from './types';

export type CustomerProfileValues = {
  firstName: string;
  lastName: string;
  email: string;
  companyName: string;
  locale: string;
  customerGroupId: string;
  dateOfBirth: string;
};

export type CustomerUpdateAction =
  | { action: 'setFirstName'; firstName?: string }
  | { action: 'setLastName'; lastName?: string }
  | { action: 'changeEmail'; email: string }
  | { action: 'setCompanyName'; companyName?: string }
  | { action: 'setLocale'; locale?: string }
  | {
      action: 'setCustomerGroup';
      customerGroup?: { typeId: 'customer-group'; id: string };
    }
  | { action: 'setDateOfBirth'; dateOfBirth?: string };

const trimmed = (value?: string | null) => value?.trim() ?? '';

export const customerToProfileValues = (
  customer: Customer
): CustomerProfileValues => ({
  firstName: trimmed(customer.firstName),
  lastName: trimmed(customer.lastName),
  email: trimmed(customer.email),
  companyName: trimmed(customer.companyName),
  locale: trimmed(customer.locale),
  customerGroupId: customer.customerGroup?.id ?? '',
  dateOfBirth: trimmed(customer.dateOfBirth),
});

export const buildCustomerProfileUpdateActions = (
  customer: Customer,
  values: CustomerProfileValues
): CustomerUpdateAction[] => {
  const current = customerToProfileValues(customer);
  const next = {
    ...values,
    firstName: trimmed(values.firstName),
    lastName: trimmed(values.lastName),
    email: trimmed(values.email),
    companyName: trimmed(values.companyName),
    locale: trimmed(values.locale),
    customerGroupId: trimmed(values.customerGroupId),
    dateOfBirth: trimmed(values.dateOfBirth),
  };
  const actions: CustomerUpdateAction[] = [];

  if (next.firstName !== current.firstName)
    actions.push({
      action: 'setFirstName',
      ...(next.firstName ? { firstName: next.firstName } : {}),
    });
  if (next.lastName !== current.lastName)
    actions.push({
      action: 'setLastName',
      ...(next.lastName ? { lastName: next.lastName } : {}),
    });
  if (next.email !== current.email)
    actions.push({ action: 'changeEmail', email: next.email });
  if (next.companyName !== current.companyName)
    actions.push({
      action: 'setCompanyName',
      ...(next.companyName ? { companyName: next.companyName } : {}),
    });
  if (next.locale !== current.locale)
    actions.push({
      action: 'setLocale',
      ...(next.locale ? { locale: next.locale } : {}),
    });
  if (next.customerGroupId !== current.customerGroupId)
    actions.push({
      action: 'setCustomerGroup',
      ...(next.customerGroupId
        ? {
            customerGroup: {
              typeId: 'customer-group' as const,
              id: next.customerGroupId,
            },
          }
        : {}),
    });
  if (next.dateOfBirth !== current.dateOfBirth)
    actions.push({
      action: 'setDateOfBirth',
      ...(next.dateOfBirth ? { dateOfBirth: next.dateOfBirth } : {}),
    });

  return actions;
};

const isValidIsoDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

export const validateCustomerProfile = (values: CustomerProfileValues) => ({
  emailMissing: trimmed(values.email).length === 0,
  emailInvalid:
    trimmed(values.email).length > 0 &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed(values.email)),
  dateInvalid:
    trimmed(values.dateOfBirth).length > 0 &&
    !isValidIsoDate(trimmed(values.dateOfBirth)),
});
