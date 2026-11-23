import { useEffect, useMemo, useState } from 'react';
import { useShowNotification } from '@commercetools-frontend/actions-global';
import { useApplicationContext } from '@commercetools-frontend/application-shell-connectors';
import { TabularDetailPage } from '@commercetools-frontend/application-components';
import {
  MC_API_PROXY_TARGETS,
  NOTIFICATION_DOMAINS,
  NOTIFICATION_KINDS_SIDE,
} from '@commercetools-frontend/constants';
import { useIsAuthorized } from '@commercetools-frontend/permissions';
import { actions, useAsyncDispatch } from '@commercetools-frontend/sdk';
import CollapsiblePanel from '@commercetools-uikit/collapsible-panel';
import DataTable from '@commercetools-uikit/data-table';
import Grid from '@commercetools-uikit/grid';
import { ContentNotification } from '@commercetools-uikit/notifications';
import PrimaryButton from '@commercetools-uikit/primary-button';
import SelectField from '@commercetools-uikit/select-field';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import TextField from '@commercetools-uikit/text-field';
import { PERMISSIONS } from '../constants';
import type {
  Address,
  Customer,
  DiscountCodeInfo,
  Money,
  Payment,
  ShoppingList,
} from '../types';
import {
  formatAddress,
  formatDate,
  formatMoney,
  getErrorMessage,
} from '../utils';
import { PageState } from '../components/common';

type RestPage<T> = { total: number; results: T[] };

const localizedValue = (value?: Record<string, string> | string | null) =>
  typeof value === 'string'
    ? value
    : value
    ? Object.values(value)[0] ?? '—'
    : '—';

const usePlatformGet = <T,>(uri?: string) => {
  const dispatch = useAsyncDispatch();
  const [state, setState] = useState<{
    data?: T;
    loading: boolean;
    error?: unknown;
  }>({ loading: Boolean(uri) });

  useEffect(() => {
    if (!uri) {
      setState({ loading: false });
      return;
    }
    let active = true;
    setState({ loading: true });
    dispatch(
      actions.get({
        mcApiProxyTarget: MC_API_PROXY_TARGETS.COMMERCETOOLS_PLATFORM,
        uri,
      })
    ).then(
      (data) => active && setState({ data: data as T, loading: false }),
      (error: unknown) => active && setState({ error, loading: false })
    );
    return () => {
      active = false;
    };
  }, [dispatch, uri]);

  return state;
};

type ExpandedPaymentReference = { id: string; obj?: Payment };
type PaymentOrder = {
  id: string;
  orderNumber?: string;
  paymentInfo?: { payments: ExpandedPaymentReference[] };
};

export const CustomerPayments = ({ customerId }: { customerId: string }) => {
  const projectKey = useApplicationContext((context) => context.project?.key);
  const where = encodeURIComponent(`customerId="${customerId}"`);
  const uri = projectKey
    ? `/${projectKey}/orders?where=${where}&limit=100&expand=paymentInfo.payments[*]`
    : undefined;
  const { data, loading, error } = usePlatformGet<RestPage<PaymentOrder>>(uri);
  const rows = useMemo(
    () =>
      (data?.results ?? []).flatMap((order) =>
        (order.paymentInfo?.payments ?? [])
          .filter(
            (
              reference
            ): reference is ExpandedPaymentReference & {
              obj: Payment;
            } => Boolean(reference.obj)
          )
          .map((reference) => ({
            ...reference.obj,
            id: `${order.id}:${reference.id}`,
            paymentId: reference.id,
            order: order.orderNumber ?? order.id,
          }))
      ),
    [data]
  );

  return (
    <PageState
      loading={loading}
      error={error}
      isEmpty={!loading && rows.length === 0}
      emptyTitle="No payments for this customer"
    >
      <DataTable<(typeof rows)[number]>
        columns={[
          { key: 'order', label: 'Order' },
          { key: 'id', label: 'Payment ID' },
          { key: 'amountPlanned', label: 'Amount planned' },
          { key: 'method', label: 'Method' },
          { key: 'transactions', label: 'Transactions' },
        ]}
        rows={rows}
        itemRenderer={(item, column) =>
          column.key === 'amountPlanned'
            ? formatMoney(item.amountPlanned)
            : column.key === 'method'
            ? localizedValue(item.paymentMethodInfo?.name) !== '—'
              ? localizedValue(item.paymentMethodInfo?.name)
              : item.paymentMethodInfo?.method ?? '—'
            : column.key === 'transactions'
            ? item.transactions
                .map(
                  (transaction) => `${transaction.type}: ${transaction.state}`
                )
                .join(', ') || '—'
            : column.key === 'id'
            ? item.paymentId
            : item.order
        }
      />
    </PageState>
  );
};

export const CustomerPassword = ({ customer }: { customer: Customer }) => {
  const projectKey = useApplicationContext((context) => context.project?.key);
  const dispatch = useAsyncDispatch();
  const showNotification = useShowNotification();
  const canManage = useIsAuthorized({
    demandedPermissions: [PERMISSIONS.ManageCustomers],
  });
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>();
  const invalid = password.length > 0 && password.length < 8;
  const mismatch = confirmation.length > 0 && password !== confirmation;

  const resetPassword = async () => {
    if (!projectKey || !canManage || invalid || mismatch || !password) return;
    setSaving(true);
    setError(undefined);
    try {
      const token = (await dispatch(
        actions.post({
          mcApiProxyTarget: MC_API_PROXY_TARGETS.COMMERCETOOLS_PLATFORM,
          uri: `/${projectKey}/customers/password-token`,
          payload: { id: customer.id, ttlMinutes: 10 },
        })
      )) as { value: string };
      await dispatch(
        actions.post({
          mcApiProxyTarget: MC_API_PROXY_TARGETS.COMMERCETOOLS_PLATFORM,
          uri: `/${projectKey}/customers/password/reset`,
          payload: { tokenValue: token.value, newPassword: password },
        })
      );
      setPassword('');
      setConfirmation('');
      showNotification({
        domain: NOTIFICATION_DOMAINS.SIDE,
        kind: NOTIFICATION_KINDS_SIDE.success,
        text: 'Customer password updated.',
      });
    } catch (caught) {
      setError(caught);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Spacings.Stack scale="l">
      <ContentNotification type="warning">
        <Text.Body>
          This immediately replaces the B2C customer password. The current
          password is never displayed or returned by commercetools.
        </Text.Body>
      </ContentNotification>
      <Grid gridGap="24px" gridTemplateColumns="repeat(2, minmax(0, 1fr))">
        <Grid.Item>
          <PasswordInput
            name="new-password"
            title="New password"
            value={password}
            onChange={setPassword}
            isDisabled={!canManage || saving}
            error={invalid ? 'Use at least 8 characters.' : undefined}
          />
        </Grid.Item>
        <Grid.Item>
          <PasswordInput
            name="confirm-password"
            title="Confirm password"
            value={confirmation}
            onChange={setConfirmation}
            isDisabled={!canManage || saving}
            error={mismatch ? 'Passwords must match.' : undefined}
          />
        </Grid.Item>
      </Grid>
      {error ? (
        <ContentNotification type="error">
          <Text.Body>{getErrorMessage(error)}</Text.Body>
        </ContentNotification>
      ) : null}
      <TabularDetailPage.FormPrimaryButton
        label={saving ? 'Updating…' : 'Update password'}
        onClick={() => void resetPassword()}
        isDisabled={
          !canManage ||
          saving ||
          !password ||
          !confirmation ||
          invalid ||
          mismatch
        }
      />
    </Spacings.Stack>
  );
};

export const PasswordInput = (props: {
  name: string;
  title: string;
  value: string;
  onChange: (value: string) => void;
  isDisabled?: boolean;
  error?: string;
}) => (
  <label htmlFor={props.name} style={{ display: 'block' }}>
    <Text.Detail isBold>{props.title}</Text.Detail>
    <input
      id={props.name}
      name={props.name}
      type="password"
      autoComplete="new-password"
      value={props.value}
      disabled={props.isDisabled}
      onChange={(event) => props.onChange(event.target.value)}
      style={{
        background: props.isDisabled
          ? 'var(--color-neutral-95)'
          : 'var(--color-surface)',
        border: `1px solid ${
          props.error ? 'var(--color-error)' : 'var(--color-neutral-60)'
        }`,
        borderRadius: 'var(--border-radius-4)',
        boxSizing: 'border-box',
        display: 'block',
        font: 'inherit',
        height: '40px',
        marginTop: '8px',
        padding: '0 12px',
        width: '100%',
      }}
    />
    {props.error ? (
      <Text.Detail tone="critical">{props.error}</Text.Detail>
    ) : null}
  </label>
);

export const CustomerWishlists = ({ customerId }: { customerId: string }) => {
  const projectKey = useApplicationContext((context) => context.project?.key);
  const canView = useIsAuthorized({
    demandedPermissions: [PERMISSIONS.ViewShoppingLists],
  });
  const predicate = encodeURIComponent(`customer(id="${customerId}")`);
  const uri =
    projectKey && canView
      ? `/${projectKey}/shopping-lists?where=${predicate}&limit=100&sort=lastModifiedAt%20desc`
      : undefined;
  const { data, loading, error } = usePlatformGet<RestPage<ShoppingList>>(uri);

  if (!canView) {
    return (
      <ContentNotification type="warning">
        <Text.Body>
          Your CSA role does not include permission to view B2C shopping lists.
        </Text.Body>
      </ContentNotification>
    );
  }

  return (
    <PageState
      loading={loading}
      error={error}
      isEmpty={!loading && (data?.results.length ?? 0) === 0}
      emptyTitle="No wishlists for this customer"
    >
      <DataTable<ShoppingList>
        columns={[
          { key: 'name', label: 'Wishlist' },
          { key: 'key', label: 'Key' },
          { key: 'items', label: 'Items' },
          { key: 'createdAt', label: 'Created' },
          { key: 'lastModifiedAt', label: 'Modified' },
        ]}
        rows={data?.results ?? []}
        itemRenderer={(item, column) =>
          column.key === 'name'
            ? localizedValue(item.name)
            : column.key === 'items'
            ? String(
                (item.lineItems ?? []).reduce(
                  (total, row) => total + row.quantity,
                  0
                ) +
                  (item.textLineItems ?? []).reduce(
                    (total, row) => total + row.quantity,
                    0
                  )
              )
            : column.key === 'createdAt' || column.key === 'lastModifiedAt'
            ? formatDate(item[column.key])
            : item.key ?? '—'
        }
      />
    </PageState>
  );
};

type PromotionResource = {
  id: string;
  key?: string;
  orderNumber?: string;
  totalPrice: Money;
  discountCodes?: DiscountCodeInfo[];
};

export const CustomerPromotions = ({ customerId }: { customerId: string }) => {
  const projectKey = useApplicationContext((context) => context.project?.key);
  const where = encodeURIComponent(`customerId="${customerId}"`);
  const ordersUri = projectKey
    ? `/${projectKey}/orders?where=${where}&limit=100&expand=discountCodes[*].discountCode`
    : undefined;
  const cartsUri = projectKey
    ? `/${projectKey}/carts?where=${where}&limit=100&expand=discountCodes[*].discountCode`
    : undefined;
  const orders = usePlatformGet<RestPage<PromotionResource>>(ordersUri);
  const carts = usePlatformGet<RestPage<PromotionResource>>(cartsUri);
  const rows = useMemo(
    () =>
      [
        ...(orders.data?.results ?? []).map((item) => ({
          ...item,
          resourceType: 'Order',
        })),
        ...(carts.data?.results ?? []).map((item) => ({
          ...item,
          resourceType: 'Cart',
        })),
      ].flatMap((resource) =>
        (resource.discountCodes ?? []).map((discount, index) => ({
          id: `${resource.resourceType}-${resource.id}-${index}`,
          resource: resource.orderNumber ?? resource.key ?? resource.id,
          resourceType: resource.resourceType,
          code: discount.discountCode.obj?.code ?? discount.discountCode.id,
          name: localizedValue(discount.discountCode.obj?.name),
          state: discount.state,
          total: resource.totalPrice,
        }))
      ),
    [carts.data, orders.data]
  );

  return (
    <PageState
      loading={orders.loading || carts.loading}
      error={orders.error ?? carts.error}
      isEmpty={!orders.loading && !carts.loading && rows.length === 0}
      emptyTitle="No promotions used by this customer"
    >
      <DataTable<(typeof rows)[number]>
        columns={[
          { key: 'resourceType', label: 'Type' },
          { key: 'resource', label: 'Cart / order' },
          { key: 'code', label: 'Discount code' },
          { key: 'name', label: 'Promotion' },
          { key: 'state', label: 'State' },
          { key: 'total', label: 'Resource total' },
        ]}
        rows={rows}
        itemRenderer={(item, column) =>
          column.key === 'total'
            ? formatMoney(item.total)
            : String(item[column.key as keyof typeof item] ?? '—')
        }
      />
    </PageState>
  );
};

const emptyAddress: Address = {
  firstName: '',
  lastName: '',
  company: '',
  streetName: '',
  streetNumber: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
  email: '',
  phone: '',
};

const addressFields: Array<{
  key: keyof Address;
  label: string;
  required?: boolean;
}> = [
  { key: 'firstName', label: 'First name' },
  { key: 'lastName', label: 'Last name' },
  { key: 'company', label: 'Company' },
  { key: 'streetName', label: 'Street name', required: true },
  { key: 'streetNumber', label: 'Street number' },
  { key: 'city', label: 'City', required: true },
  { key: 'state', label: 'State / province' },
  { key: 'postalCode', label: 'Postal code', required: true },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
];

export const CustomerAddresses = (props: {
  customer: Customer;
  onSaved: () => Promise<unknown>;
}) => {
  const project = useApplicationContext((context) => context.project);
  const dispatch = useAsyncDispatch();
  const showNotification = useShowNotification();
  const canManage = useIsAuthorized({
    demandedPermissions: [PERMISSIONS.ManageCustomers],
  });
  const [draft, setDraft] = useState<Address>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>();
  const addresses = props.customer.addresses ?? [];
  const rows = addresses.map((address, index) => ({
    ...address,
    id: address.id ?? `address-${index}`,
  }));
  const countries = (project?.countries ?? []).map((country) => ({
    value: country,
    label: country,
  }));

  useEffect(() => setDraft(undefined), [props.customer.version]);

  const update = (key: keyof Address, value: string) =>
    setDraft((current) => ({ ...(current ?? emptyAddress), [key]: value }));

  const save = async () => {
    if (!project?.key || !canManage || !draft) return;
    const address = Object.fromEntries(
      Object.entries(draft).filter(
        ([key, value]) => key !== 'id' && value !== '' && value != null
      )
    );
    setSaving(true);
    setError(undefined);
    try {
      await dispatch(
        actions.post({
          mcApiProxyTarget: MC_API_PROXY_TARGETS.COMMERCETOOLS_PLATFORM,
          uri: `/${project.key}/customers/${props.customer.id}`,
          payload: {
            version: props.customer.version,
            actions: [
              draft.id
                ? { action: 'changeAddress', addressId: draft.id, address }
                : { action: 'addAddress', address },
            ],
          },
        })
      );
      await props.onSaved();
      setDraft(undefined);
      showNotification({
        domain: NOTIFICATION_DOMAINS.SIDE,
        kind: NOTIFICATION_KINDS_SIDE.success,
        text: draft.id ? 'Address updated.' : 'Address added.',
      });
    } catch (caught) {
      setError(caught);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (addressId: string) => {
    if (!project?.key || !canManage) return;
    setSaving(true);
    setError(undefined);
    try {
      await dispatch(
        actions.post({
          mcApiProxyTarget: MC_API_PROXY_TARGETS.COMMERCETOOLS_PLATFORM,
          uri: `/${project.key}/customers/${props.customer.id}`,
          payload: {
            version: props.customer.version,
            actions: [{ action: 'removeAddress', addressId }],
          },
        })
      );
      await props.onSaved();
      showNotification({
        domain: NOTIFICATION_DOMAINS.SIDE,
        kind: NOTIFICATION_KINDS_SIDE.success,
        text: 'Address removed.',
      });
    } catch (caught) {
      setError(caught);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Spacings.Stack scale="xl">
      <Spacings.Inline scale="m">
        <PrimaryButton
          label="Add address"
          onClick={() => setDraft({ ...emptyAddress })}
          isDisabled={!canManage || saving}
        />
        {!canManage ? (
          <Text.Detail tone="secondary">
            Manage-customer permission is required to change addresses.
          </Text.Detail>
        ) : null}
      </Spacings.Inline>
      <PageState isEmpty={addresses.length === 0} emptyTitle="No addresses">
        <DataTable<(typeof rows)[number]>
          columns={[
            { key: 'address', label: 'Address' },
            { key: 'email', label: 'Email' },
            { key: 'phone', label: 'Phone' },
          ]}
          rows={rows}
          itemRenderer={(item, column) =>
            column.key === 'address'
              ? formatAddress(item)
              : String(item[column.key as 'email' | 'phone'] ?? '—')
          }
          onRowClick={(row) => canManage && setDraft(row)}
        />
      </PageState>
      {draft ? (
        <CollapsiblePanel
          header={draft.id ? 'Edit address' : 'Add address'}
          isDefaultClosed={false}
        >
          <Spacings.Stack scale="l">
            <Grid
              gridGap="24px"
              gridTemplateColumns="repeat(2, minmax(0, 1fr))"
            >
              {addressFields.map((field) => (
                <Grid.Item key={field.key}>
                  <TextField
                    name={field.key}
                    title={field.label}
                    value={String(draft[field.key] ?? '')}
                    onChange={(event) => update(field.key, event.target.value)}
                    isRequired={field.required}
                    isDisabled={saving}
                    horizontalConstraint="scale"
                  />
                </Grid.Item>
              ))}
              <Grid.Item>
                <SelectField
                  name="country"
                  title="Country"
                  value={draft.country || null}
                  options={countries}
                  onChange={(event) =>
                    update('country', String(event.target.value ?? ''))
                  }
                  isRequired
                  isDisabled={saving}
                  horizontalConstraint="scale"
                />
              </Grid.Item>
            </Grid>
            {error ? (
              <ContentNotification type="error">
                <Text.Body>{getErrorMessage(error)}</Text.Body>
              </ContentNotification>
            ) : null}
            <Spacings.Inline scale="m">
              <TabularDetailPage.FormSecondaryButton
                label="Cancel"
                onClick={() => setDraft(undefined)}
                isDisabled={saving}
              />
              {draft.id ? (
                <TabularDetailPage.FormSecondaryButton
                  label="Remove"
                  onClick={() => void remove(draft.id as string)}
                  isDisabled={saving}
                />
              ) : null}
              <TabularDetailPage.FormPrimaryButton
                label={saving ? 'Saving…' : 'Save address'}
                onClick={() => void save()}
                isDisabled={
                  saving ||
                  !draft.streetName ||
                  !draft.city ||
                  !draft.postalCode ||
                  !draft.country
                }
              />
            </Spacings.Inline>
          </Spacings.Stack>
        </CollapsiblePanel>
      ) : null}
    </Spacings.Stack>
  );
};
