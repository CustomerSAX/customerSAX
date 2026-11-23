import {
  buildCustomerProfileUpdateActions,
  customerToProfileValues,
  validateCustomerProfile,
} from './customer-profile';
import type { Customer } from './types';

const customer: Customer = {
  id: 'customer-id',
  version: 3,
  email: 'person@example.com',
  firstName: 'First',
  lastName: 'Last',
  companyName: 'Company',
  locale: 'en-AU',
  dateOfBirth: '1990-08-03',
  isEmailVerified: true,
  createdAt: '2026-01-01T00:00:00Z',
  lastModifiedAt: '2026-01-01T00:00:00Z',
  customerGroup: { id: 'old-group', name: 'Old group' },
};

describe('customer profile updates', () => {
  it('does not create update actions for unchanged values', () => {
    expect(
      buildCustomerProfileUpdateActions(
        customer,
        customerToProfileValues(customer)
      )
    ).toEqual([]);
  });

  it('creates version-safe API actions only for changed fields', () => {
    expect(
      buildCustomerProfileUpdateActions(customer, {
        ...customerToProfileValues(customer),
        firstName: 'Updated',
        companyName: '',
        customerGroupId: 'new-group',
      })
    ).toEqual([
      { action: 'setFirstName', firstName: 'Updated' },
      { action: 'setCompanyName' },
      {
        action: 'setCustomerGroup',
        customerGroup: { typeId: 'customer-group', id: 'new-group' },
      },
    ]);
  });

  it('validates email and ISO date values', () => {
    expect(
      validateCustomerProfile({
        ...customerToProfileValues(customer),
        email: 'invalid',
        dateOfBirth: '2026-02-30',
      })
    ).toMatchObject({ emailInvalid: true, dateInvalid: true });
  });
});
