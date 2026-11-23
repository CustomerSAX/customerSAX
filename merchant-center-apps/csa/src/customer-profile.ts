import type { Customer } from './types';

export type CustomerProfileValues = {
  title: string;
  salutation: string;
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  companyName: string;
  vatId: string;
  locale: string;
  customerGroupId: string;
  dateOfBirth: string;
};

export type CustomerUpdateAction =
  | { action: 'setTitle'; title?: string }
  | { action: 'setSalutation'; salutation?: string }
  | { action: 'setFirstName'; firstName?: string }
  | { action: 'setMiddleName'; middleName?: string }
  | { action: 'setLastName'; lastName?: string }
  | { action: 'changeEmail'; email: string }
  | { action: 'setCompanyName'; companyName?: string }
  | { action: 'setVatId'; vatId?: string }
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
  title: trimmed(customer.title),
  salutation: trimmed(customer.salutation),
  firstName: trimmed(customer.firstName),
  middleName: trimmed(customer.middleName),
  lastName: trimmed(customer.lastName),
  email: trimmed(customer.email),
  companyName: trimmed(customer.companyName),
  vatId: trimmed(customer.vatId),
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
    title: trimmed(values.title),
    salutation: trimmed(values.salutation),
    firstName: trimmed(values.firstName),
    middleName: trimmed(values.middleName),
    lastName: trimmed(values.lastName),
    email: trimmed(values.email),
    companyName: trimmed(values.companyName),
    vatId: trimmed(values.vatId),
    locale: trimmed(values.locale),
    customerGroupId: trimmed(values.customerGroupId),
    dateOfBirth: trimmed(values.dateOfBirth),
  };
  const actions: CustomerUpdateAction[] = [];

  if (next.title !== current.title)
    actions.push({
      action: 'setTitle',
      ...(next.title ? { title: next.title } : {}),
    });
  if (next.salutation !== current.salutation)
    actions.push({
      action: 'setSalutation',
      ...(next.salutation ? { salutation: next.salutation } : {}),
    });
  if (next.firstName !== current.firstName)
    actions.push({
      action: 'setFirstName',
      ...(next.firstName ? { firstName: next.firstName } : {}),
    });
  if (next.middleName !== current.middleName)
    actions.push({
      action: 'setMiddleName',
      ...(next.middleName ? { middleName: next.middleName } : {}),
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
  if (next.vatId !== current.vatId)
    actions.push({
      action: 'setVatId',
      ...(next.vatId ? { vatId: next.vatId } : {}),
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
