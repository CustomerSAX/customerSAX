import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHistory, useRouteMatch } from 'react-router-dom';
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
import { Pagination } from '@commercetools-uikit/pagination';
import PrimaryButton from '@commercetools-uikit/primary-button';
import SelectField from '@commercetools-uikit/select-field';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import TextField from '@commercetools-uikit/text-field';
import { PERMISSIONS } from '../constants';
import {
  paymentMethodLabel,
  paymentProviderLabel,
  paymentsForOrder,
  paymentStatusLabel,
} from '../order-payments';
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
import { BackLink, KeyValueGrid, PageState } from '../components/common';

type RestPage<T> = { total: number; results: T[] };

const localizedValue = (value?: Record<string, string> | string | null) =>
  typeof value === 'string'
    ? value
    : value
    ? Object.values(value)[0] ?? '—'
    : '—';

const usePlatformGet = <T,>(uri?: string) => {
  const dispatch = useAsyncDispatch();
  const [requestVersion, setRequestVersion] = useState(0);
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
  }, [dispatch, requestVersion, uri]);

  const refetch = useCallback(
    () => setRequestVersion((current) => current + 1),
    []
  );

  return { ...state, refetch };
};

type ExpandedPaymentReference = { id: string; obj?: Payment };
type PaymentOrder = {
  id: string;
  orderNumber?: string;
  paymentState?: string | null;
  createdAt: string;
  lastModifiedAt: string;
  totalPrice: Money;
  paymentInfo?: { payments: ExpandedPaymentReference[] };
};

type CustomerPaymentRow = Payment & {
  id: string;
  paymentId: string;
  orderId: string;
  order: string;
  orderPaymentState?: string | null;
};

export const CustomerPayments = ({
  customerId,
  baseUrl,
}: {
  customerId: string;
  baseUrl: string;
}) => {
  const history = useHistory();
  const projectKey = useApplicationContext((context) => context.project?.key);
  const detailMatch = useRouteMatch<{
    orderId: string;
    paymentId: string;
  }>({
    path: `${baseUrl}/:orderId/:paymentId`,
    exact: true,
  });
  const where = encodeURIComponent(`customerId="${customerId}"`);
  const uri = projectKey
    ? `/${projectKey}/orders?where=${where}&limit=100&expand=paymentInfo.payments[*]`
    : undefined;
  const { data, loading, error } = usePlatformGet<RestPage<PaymentOrder>>(uri);
  const rows = useMemo<CustomerPaymentRow[]>(
    () =>
      (data?.results ?? []).flatMap((order) => {
        const linkedPayments = (order.paymentInfo?.payments ?? []).flatMap(
          (reference) => (reference.obj ? [reference.obj] : [])
        );

        return paymentsForOrder({
          ...order,
          paymentInfo: { payments: linkedPayments },
        }).map((payment) => ({
          ...payment,
          id: `${order.id}:${payment.id}`,
          paymentId: payment.id,
          orderId: order.id,
          order: order.orderNumber ?? order.id,
          orderPaymentState: order.paymentState,
        }));
      }),
    [data]
  );
  const selectedPayment =
    rows.find(
      (payment) =>
        payment.orderId === detailMatch?.params.orderId &&
        payment.paymentId === detailMatch.params.paymentId
    ) ?? null;

  return (
    <PageState
      loading={loading}
      error={error}
      isEmpty={!loading && rows.length === 0}
      emptyTitle="No payments for this customer"
    >
      {detailMatch ? (
        <Spacings.Stack scale="xl">
          <BackLink to={baseUrl} label="Back to customer payments" />
          <PageState
            isEmpty={!selectedPayment}
            emptyTitle="Payment not found"
            emptyBody="This payment is not available for the selected customer."
          >
            {selectedPayment ? (
              <CustomerPaymentDetail payment={selectedPayment} />
            ) : null}
          </PageState>
        </Spacings.Stack>
      ) : (
        <DataTable<CustomerPaymentRow>
          columns={[
            { key: 'order', label: 'Order' },
            { key: 'id', label: 'Payment ID' },
            { key: 'amountPlanned', label: 'Amount planned' },
            { key: 'method', label: 'Method' },
            { key: 'provider', label: 'PSP provider' },
            { key: 'status', label: 'Status' },
            { key: 'transactions', label: 'Transactions' },
            { key: 'createdAt', label: 'Date' },
          ]}
          rows={rows}
          onRowClick={(payment) =>
            history.push(
              `${baseUrl}/${encodeURIComponent(
                payment.orderId
              )}/${encodeURIComponent(payment.paymentId)}`
            )
          }
          itemRenderer={(item, column) => {
            if (column.key === 'amountPlanned')
              return formatMoney(item.amountPlanned);
            if (column.key === 'method') return paymentMethodLabel(item);
            if (column.key === 'provider') return paymentProviderLabel(item);
            if (column.key === 'status')
              return paymentStatusLabel(item, {
                paymentState: item.orderPaymentState,
              });
            if (column.key === 'transactions')
              return (
                item.transactions
                  .map(
                    (transaction) => `${transaction.type}: ${transaction.state}`
                  )
                  .join(', ') || '—'
              );
            if (column.key === 'createdAt') return formatDate(item.createdAt);
            if (column.key === 'id') return item.paymentId;
            return item.order;
          }}
        />
      )}
    </PageState>
  );
};

const CustomerPaymentDetail = ({
  payment,
}: {
  payment: CustomerPaymentRow;
}) => (
  <CollapsiblePanel
    header={`Payment details: ${payment.paymentId}`}
    isDefaultClosed={false}
  >
    <Spacings.Stack scale="xl">
      <Grid gridGap="24px" gridTemplateColumns="repeat(2, minmax(0, 1fr))">
        <Grid.Item>
          <KeyValueGrid
            items={[
              { label: 'Order', value: payment.order },
              { label: 'Payment ID', value: payment.paymentId },
              {
                label: 'Interface ID',
                value: payment.interfaceId ?? '—',
              },
              {
                label: 'Status',
                value: paymentStatusLabel(payment, {
                  paymentState: payment.orderPaymentState,
                }),
              },
            ]}
          />
        </Grid.Item>
        <Grid.Item>
          <KeyValueGrid
            items={[
              {
                label: 'Amount planned',
                value: formatMoney(payment.amountPlanned),
              },
              {
                label: 'Payment method',
                value: paymentMethodLabel(payment),
              },
              {
                label: 'PSP provider',
                value: paymentProviderLabel(payment),
              },
              { label: 'Created', value: formatDate(payment.createdAt) },
              {
                label: 'Modified',
                value: formatDate(payment.lastModifiedAt ?? payment.createdAt),
              },
            ]}
          />
        </Grid.Item>
      </Grid>

      <Text.Subheadline as="h4">Transactions breakdown</Text.Subheadline>
      <PageState
        isEmpty={payment.transactions.length === 0}
        emptyTitle="No payment transactions"
      >
        <DataTable<(typeof payment.transactions)[number]>
          columns={[
            { key: 'timestamp', label: 'Date' },
            { key: 'type', label: 'Transaction type' },
            { key: 'state', label: 'Status' },
            { key: 'amount', label: 'Amount' },
            { key: 'interactionId', label: 'Interaction ID' },
            { key: 'id', label: 'Transaction ID' },
          ]}
          rows={payment.transactions}
          itemRenderer={(item, column) => {
            if (column.key === 'timestamp') return formatDate(item.timestamp);
            if (column.key === 'amount') return formatMoney(item.amount);
            if (column.key === 'interactionId')
              return item.interactionId ?? '—';
            if (column.key === 'type') return item.type;
            if (column.key === 'state') return item.state;
            return item.id;
          }}
        />
      </PageState>
    </Spacings.Stack>
  </CollapsiblePanel>
);

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

type WishlistProductVariant = {
  id: number;
  sku?: string;
  key?: string;
  prices?: Array<{ value: Money }>;
  availability?: {
    availableQuantity?: number;
    isOnStock?: boolean;
  };
};

type WishlistProductProjection = {
  id: string;
  key?: string;
  name: Record<string, string>;
  masterVariant: WishlistProductVariant;
  variants?: WishlistProductVariant[];
};

type WishlistProductSearchResponse = {
  results: WishlistProductProjection[];
};

type WishlistProductRow = {
  id: string;
  productId: string;
  variantId: number;
  name: string;
  sku?: string;
  price?: Money;
  availableQuantity?: number;
};

const wishlistProductMatches = (
  product: WishlistProductProjection,
  searchTerm: string
) => {
  const normalizedSearchTerm = searchTerm.toLocaleLowerCase();
  const variants = [product.masterVariant, ...(product.variants ?? [])];
  return [
    product.id,
    product.key,
    ...Object.values(product.name),
    ...variants.flatMap((variant) => [variant.sku, variant.key]),
  ].some((value) => value?.toLocaleLowerCase().includes(normalizedSearchTerm));
};

const isProductSearchUnavailable = (error: unknown) =>
  getErrorMessage(error)
    .toLocaleLowerCase()
    .includes('endpoint is deactivated');

export const CustomerWishlists = ({ customerId }: { customerId: string }) => {
  const projectKey = useApplicationContext((context) => context.project?.key);
  const locale = useApplicationContext(
    (context) => context.dataLocale ?? context.project?.languages?.[0] ?? 'en'
  );
  const dispatch = useAsyncDispatch();
  const showNotification = useShowNotification();
  const canView = useIsAuthorized({
    demandedPermissions: [PERMISSIONS.ViewShoppingLists],
  });
  const canManage = useIsAuthorized({
    demandedPermissions: [PERMISSIONS.ManageShoppingLists],
  });
  const predicate = encodeURIComponent(`customer(id="${customerId}")`);
  const uri =
    projectKey && canView
      ? `/${projectKey}/shopping-lists?where=${predicate}&limit=100&sort=lastModifiedAt%20desc&expand=lineItems%5B%2A%5D.variant`
      : undefined;
  const { data, loading, error, refetch } =
    usePlatformGet<RestPage<ShoppingList>>(uri);
  const [updatedWishlists, setUpdatedWishlists] = useState<
    Record<string, ShoppingList>
  >({});
  const [deletedWishlistIds, setDeletedWishlistIds] = useState<Set<string>>(
    () => new Set()
  );
  const wishlists = useMemo(() => {
    const byId = new Map(
      (data?.results ?? [])
        .filter((wishlist) => !deletedWishlistIds.has(wishlist.id))
        .map((wishlist) => [wishlist.id, wishlist])
    );
    Object.values(updatedWishlists)
      .filter((wishlist) => !deletedWishlistIds.has(wishlist.id))
      .forEach((wishlist) => byId.set(wishlist.id, wishlist));
    return Array.from(byId.values()).sort((left, right) =>
      right.lastModifiedAt.localeCompare(left.lastModifiedAt)
    );
  }, [data, deletedWishlistIds, updatedWishlists]);
  const [wishlistName, setWishlistName] = useState('Wishlist');
  const [creating, setCreating] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string>();
  const [deletingWishlistId, setDeletingWishlistId] = useState<string>();
  const [mutationError, setMutationError] = useState<unknown>();

  const saveUpdatedWishlist = (wishlist: ShoppingList) => {
    setDeletedWishlistIds((current) => {
      if (!current.has(wishlist.id)) return current;
      const next = new Set(current);
      next.delete(wishlist.id);
      return next;
    });
    setUpdatedWishlists((current) => ({
      ...current,
      [wishlist.id]: wishlist,
    }));
    refetch();
  };

  const createWishlist = async () => {
    const name = wishlistName.trim();
    if (!projectKey || !canManage || !name) return;
    setCreating(true);
    setMutationError(undefined);
    try {
      const wishlist = (await dispatch(
        actions.post({
          mcApiProxyTarget: MC_API_PROXY_TARGETS.COMMERCETOOLS_PLATFORM,
          uri: `/${projectKey}/shopping-lists`,
          payload: {
            name: { [locale]: name },
            customer: { typeId: 'customer', id: customerId },
          },
        })
      )) as ShoppingList;
      saveUpdatedWishlist(wishlist);
      setWishlistName('Wishlist');
      showNotification({
        domain: NOTIFICATION_DOMAINS.SIDE,
        kind: NOTIFICATION_KINDS_SIDE.success,
        text: `${name} created.`,
      });
    } catch (caught) {
      setMutationError(caught);
    } finally {
      setCreating(false);
    }
  };

  const deleteWishlist = async (wishlist: ShoppingList) => {
    if (!projectKey || !canManage || confirmingDeleteId !== wishlist.id) return;
    setDeletingWishlistId(wishlist.id);
    setMutationError(undefined);
    try {
      await dispatch(
        actions.del({
          mcApiProxyTarget: MC_API_PROXY_TARGETS.COMMERCETOOLS_PLATFORM,
          uri: `/${projectKey}/shopping-lists/${wishlist.id}?version=${wishlist.version}`,
        })
      );
      const deletedName = localizedValue(wishlist.name);
      setDeletedWishlistIds((current) => new Set(current).add(wishlist.id));
      setUpdatedWishlists((current) => {
        const next = { ...current };
        delete next[wishlist.id];
        return next;
      });
      setConfirmingDeleteId(undefined);
      refetch();
      showNotification({
        domain: NOTIFICATION_DOMAINS.SIDE,
        kind: NOTIFICATION_KINDS_SIDE.success,
        text: `${deletedName} deleted.`,
      });
    } catch (caught) {
      setMutationError(caught);
    } finally {
      setDeletingWishlistId(undefined);
    }
  };

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
    <PageState loading={loading} error={error}>
      <Spacings.Stack scale="xl">
        {!canManage ? (
          <ContentNotification type="warning">
            <Text.Body>
              You can view wishlists, but your CSA role cannot create them or
              add products.
            </Text.Body>
          </ContentNotification>
        ) : null}

        <CollapsiblePanel header="Wishlist management" isDefaultClosed={false}>
          <Spacings.Stack scale="l">
            <Text.Body>
              {wishlists.length === 1
                ? '1 wishlist for this customer'
                : `${wishlists.length} wishlists for this customer`}
            </Text.Body>
            <Spacings.Inline scale="m" alignItems="flex-end">
              <TextField
                name="wishlist-name"
                title="New wishlist name"
                value={wishlistName}
                onChange={(event) => setWishlistName(event.target.value)}
                isDisabled={!canManage || creating}
                horizontalConstraint={10}
              />
              <PrimaryButton
                label={creating ? 'Creating…' : 'Create wishlist'}
                onClick={() => void createWishlist()}
                isDisabled={!canManage || creating || !wishlistName.trim()}
              />
            </Spacings.Inline>

            {wishlists.length === 0 ? (
              <ContentNotification type="info">
                <Text.Body>
                  This customer has no wishlists. Create one to start adding
                  products.
                </Text.Body>
              </ContentNotification>
            ) : null}
            {mutationError ? (
              <ContentNotification type="error">
                <Text.Body>{getErrorMessage(mutationError)}</Text.Body>
              </ContentNotification>
            ) : null}
          </Spacings.Stack>
        </CollapsiblePanel>

        {wishlists.map((wishlist) => (
          <CollapsiblePanel
            key={wishlist.id}
            header={`Wishlist: ${localizedValue(wishlist.name)}`}
            isDefaultClosed={false}
          >
            <Spacings.Stack scale="l">
              {canManage ? (
                confirmingDeleteId === wishlist.id ? (
                  <ContentNotification type="warning">
                    <Spacings.Stack scale="m">
                      <Text.Body>
                        Permanently delete “{localizedValue(wishlist.name)}” and
                        all of its items?
                      </Text.Body>
                      <Spacings.Inline scale="m">
                        <TabularDetailPage.FormSecondaryButton
                          label="Cancel"
                          onClick={() => setConfirmingDeleteId(undefined)}
                          isDisabled={deletingWishlistId === wishlist.id}
                        />
                        <PrimaryButton
                          tone="critical"
                          label={
                            deletingWishlistId === wishlist.id
                              ? 'Deleting…'
                              : 'Confirm delete'
                          }
                          onClick={() => void deleteWishlist(wishlist)}
                          isDisabled={deletingWishlistId === wishlist.id}
                        />
                      </Spacings.Inline>
                    </Spacings.Stack>
                  </ContentNotification>
                ) : (
                  <Spacings.Inline scale="m">
                    <PrimaryButton
                      tone="critical"
                      label="Delete wishlist"
                      onClick={() => setConfirmingDeleteId(wishlist.id)}
                      isDisabled={Boolean(deletingWishlistId)}
                    />
                  </Spacings.Inline>
                )
              ) : null}

              <KeyValueGrid
                items={[
                  { label: 'Wishlist ID', value: wishlist.id },
                  { label: 'Key', value: wishlist.key ?? '—' },
                  {
                    label: 'Items',
                    value: String(
                      (wishlist.lineItems ?? []).reduce(
                        (total, item) => total + item.quantity,
                        0
                      )
                    ),
                  },
                  {
                    label: 'Created',
                    value: formatDate(wishlist.createdAt),
                  },
                  {
                    label: 'Modified',
                    value: formatDate(wishlist.lastModifiedAt),
                  },
                ]}
              />
              <PageState
                isEmpty={(wishlist.lineItems ?? []).length === 0}
                emptyTitle="No products in this wishlist"
                emptyBody="Use product search below to add the first item."
              >
                <DataTable<NonNullable<ShoppingList['lineItems']>[number]>
                  columns={[
                    { key: 'name', label: 'Product' },
                    { key: 'sku', label: 'SKU' },
                    { key: 'variantId', label: 'Variant' },
                    { key: 'price', label: 'Price' },
                    { key: 'quantity', label: 'Quantity' },
                    { key: 'addedAt', label: 'Added' },
                  ]}
                  rows={wishlist.lineItems ?? []}
                  itemRenderer={(item, column) => {
                    if (column.key === 'name')
                      return localizedValue(item.name) !== '—'
                        ? localizedValue(item.name)
                        : item.productId;
                    if (column.key === 'sku') return item.variant?.sku ?? '—';
                    if (column.key === 'price')
                      return item.variant?.prices?.[0]?.value
                        ? formatMoney(item.variant.prices[0].value)
                        : '—';
                    if (column.key === 'addedAt')
                      return formatDate(item.addedAt);
                    if (column.key === 'variantId')
                      return String(item.variantId);
                    return String(item.quantity);
                  }}
                />
              </PageState>

              <AddWishlistItems
                key={wishlist.id}
                wishlist={wishlist}
                locale={locale}
                canManage={canManage}
                onUpdated={saveUpdatedWishlist}
              />
            </Spacings.Stack>
          </CollapsiblePanel>
        ))}
      </Spacings.Stack>
    </PageState>
  );
};

const AddWishlistItems = (props: {
  wishlist: ShoppingList;
  locale: string;
  canManage: boolean;
  onUpdated: (wishlist: ShoppingList) => void;
}) => {
  const projectKey = useApplicationContext((context) => context.project?.key);
  const dispatch = useAsyncDispatch();
  const showNotification = useShowNotification();
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<WishlistProductRow[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<string>();
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<unknown>();

  const productName = (product: WishlistProductProjection) =>
    product.name[props.locale] ??
    product.name[props.locale.split('-')[0]] ??
    Object.values(product.name)[0] ??
    product.key ??
    product.id;

  const searchProducts = async () => {
    const value = search.trim();
    if (!projectKey || !value || !props.canManage) return;
    setSearching(true);
    setHasSearched(true);
    setError(undefined);
    try {
      let result: WishlistProductSearchResponse;
      try {
        const query = new URLSearchParams({
          staged: 'true',
          limit: '40',
          markMatchingVariants: 'true',
        });
        query.set(`text.${props.locale}`, value);
        result = (await dispatch(
          actions.get({
            mcApiProxyTarget: MC_API_PROXY_TARGETS.COMMERCETOOLS_PLATFORM,
            uri: `/${projectKey}/product-projections/search?${query.toString()}`,
          })
        )) as WishlistProductSearchResponse;
      } catch (caught) {
        if (!isProductSearchUnavailable(caught)) throw caught;
        const query = new URLSearchParams({
          staged: 'true',
          limit: '500',
          withTotal: 'false',
        });
        const fallbackResult = (await dispatch(
          actions.get({
            mcApiProxyTarget: MC_API_PROXY_TARGETS.COMMERCETOOLS_PLATFORM,
            uri: `/${projectKey}/product-projections?${query.toString()}`,
          })
        )) as WishlistProductSearchResponse;
        result = {
          results: fallbackResult.results
            .filter((product) => wishlistProductMatches(product, value))
            .slice(0, 40),
        };
      }

      const nextRows = result.results.flatMap((product) =>
        [product.masterVariant, ...(product.variants ?? [])].map((variant) => ({
          id: `${product.id}-${variant.id}`,
          productId: product.id,
          variantId: variant.id,
          name: productName(product),
          sku: variant.sku ?? variant.key,
          price: variant.prices?.[0]?.value,
          availableQuantity: variant.availability?.availableQuantity,
        }))
      );
      setRows(nextRows);
      setQuantities(Object.fromEntries(nextRows.map((row) => [row.id, '1'])));
    } catch (caught) {
      setRows([]);
      setError(caught);
    } finally {
      setSearching(false);
    }
  };

  const addItem = async (row: WishlistProductRow) => {
    const quantity = Number(quantities[row.id]);
    if (
      !projectKey ||
      !props.canManage ||
      !Number.isInteger(quantity) ||
      quantity < 1
    )
      return;
    setAddingId(row.id);
    setError(undefined);
    try {
      const wishlist = (await dispatch(
        actions.post({
          mcApiProxyTarget: MC_API_PROXY_TARGETS.COMMERCETOOLS_PLATFORM,
          uri: `/${projectKey}/shopping-lists/${props.wishlist.id}?expand=lineItems%5B%2A%5D.variant`,
          payload: {
            version: props.wishlist.version,
            actions: [
              {
                action: 'addLineItem',
                productId: row.productId,
                variantId: row.variantId,
                quantity,
              },
            ],
          },
        })
      )) as ShoppingList;
      props.onUpdated(wishlist);
      showNotification({
        domain: NOTIFICATION_DOMAINS.SIDE,
        kind: NOTIFICATION_KINDS_SIDE.success,
        text: `${row.name} added to ${localizedValue(wishlist.name)}.`,
      });
    } catch (caught) {
      setError(caught);
    } finally {
      setAddingId(undefined);
    }
  };

  return (
    <CollapsiblePanel
      header={`Add products to ${localizedValue(props.wishlist.name)}`}
      isDefaultClosed={false}
    >
      <Spacings.Stack scale="l">
        <Spacings.Inline scale="m" alignItems="flex-end">
          <TextField
            name="wishlist-product-search"
            title="Search products"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Product name, SKU, key, or ID"
            horizontalConstraint={10}
            isDisabled={!props.canManage || searching}
          />
          <PrimaryButton
            label={searching ? 'Searching…' : 'Search'}
            onClick={() => void searchProducts()}
            isDisabled={
              !props.canManage || searching || search.trim().length === 0
            }
          />
        </Spacings.Inline>

        {hasSearched && !searching && rows.length === 0 && !error ? (
          <ContentNotification type="info">
            <Text.Body>No products matched this search.</Text.Body>
          </ContentNotification>
        ) : null}
        {rows.length > 0 ? (
          <DataTable<WishlistProductRow>
            columns={[
              { key: 'name', label: 'Product' },
              { key: 'sku', label: 'SKU' },
              { key: 'price', label: 'Price' },
              { key: 'availableQuantity', label: 'Available' },
              { key: 'quantity', label: 'Qty' },
              { key: 'add', label: '' },
            ]}
            rows={rows}
            itemRenderer={(item, column) => {
              if (column.key === 'price')
                return item.price ? formatMoney(item.price) : '—';
              if (column.key === 'availableQuantity')
                return item.availableQuantity == null
                  ? '—'
                  : String(item.availableQuantity);
              if (column.key === 'quantity')
                return (
                  <TextField
                    name={`wishlist-quantity-${item.id}`}
                    title="Quantity"
                    value={quantities[item.id] ?? '1'}
                    onChange={(event) =>
                      setQuantities((current) => ({
                        ...current,
                        [item.id]: event.target.value,
                      }))
                    }
                    isDisabled={Boolean(addingId)}
                    horizontalConstraint={3}
                  />
                );
              if (column.key === 'add') {
                const quantity = Number(quantities[item.id]);
                return (
                  <PrimaryButton
                    label={addingId === item.id ? 'Adding…' : 'Add'}
                    onClick={() => void addItem(item)}
                    isDisabled={
                      Boolean(addingId) ||
                      !Number.isInteger(quantity) ||
                      quantity < 1
                    }
                  />
                );
              }
              return String(
                item[column.key as keyof WishlistProductRow] ?? '—'
              );
            }}
          />
        ) : null}
        {error ? (
          <ContentNotification type="error">
            <Text.Body>{getErrorMessage(error)}</Text.Body>
          </ContentNotification>
        ) : null}
      </Spacings.Stack>
    </CollapsiblePanel>
  );
};

type PromotionUsageResource = {
  id: string;
  key?: string;
  orderNumber?: string;
  createdAt: string;
  totalPrice: Money;
  discountCodes?: DiscountCodeInfo[];
};

type CartDiscount = {
  id: string;
  key?: string;
  name: Record<string, string>;
  description?: Record<string, string>;
  value: {
    type: 'relative' | 'absolute' | 'fixed' | 'giftLineItem';
    permyriad?: number;
    money?: Money[];
  };
  target?: { type: string };
  isActive: boolean;
  requiresDiscountCode: boolean;
  validFrom?: string;
  validUntil?: string;
};

type PromotionReference = { typeId: 'cart-discount'; id: string };

type PromotionAssignmentType = {
  key: string;
  resourceTypeIds: string[];
  fieldDefinitions: Array<{
    name: string;
    type: {
      name: string;
      elementType?: { name: string; referenceTypeId?: string };
    };
  }>;
};

const PROMOTIONS_TYPE_KEY = 'promotionsList';
const PROMOTIONS_FIELD_NAME = 'promotions';

const promotionReferenceIds = (value: unknown): string[] => {
  if (typeof value === 'string') {
    try {
      return promotionReferenceIds(JSON.parse(value));
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value.flatMap((reference) =>
    reference &&
    typeof reference === 'object' &&
    'id' in reference &&
    typeof reference.id === 'string'
      ? [reference.id]
      : []
  );
};

const promotionValueLabel = (promotion: CartDiscount) => {
  if (
    promotion.value.type === 'relative' &&
    typeof promotion.value.permyriad === 'number'
  ) {
    return `${promotion.value.permyriad / 100}%`;
  }
  if (
    (promotion.value.type === 'absolute' || promotion.value.type === 'fixed') &&
    promotion.value.money?.[0]
  ) {
    return formatMoney(promotion.value.money[0]);
  }
  return promotion.value.type === 'giftLineItem' ? 'Gift item' : '—';
};

const promotionTypeLabel = (promotion: CartDiscount) => {
  const labels: Record<CartDiscount['value']['type'], string> = {
    relative: 'Relative',
    absolute: 'Absolute',
    fixed: 'Fixed price',
    giftLineItem: 'Gift item',
  };
  return labels[promotion.value.type];
};

export const CustomerPromotions = ({
  customer,
  onSaved,
}: {
  customer: Customer;
  onSaved: () => Promise<unknown>;
}) => {
  const projectKey = useApplicationContext((context) => context.project?.key);
  const dispatch = useAsyncDispatch();
  const showNotification = useShowNotification();
  const canManage = useIsAuthorized({
    demandedPermissions: [PERMISSIONS.ManageCustomers],
  });
  const where = encodeURIComponent(`customerId="${customer.id}"`);
  const ordersUri = projectKey
    ? `/${projectKey}/orders?where=${where}&limit=100&expand=discountCodes[*].discountCode`
    : undefined;
  const cartsUri = projectKey
    ? `/${projectKey}/carts?where=${where}&limit=100&expand=discountCodes[*].discountCode`
    : undefined;
  const promotionsUri = projectKey
    ? `/${projectKey}/cart-discounts?limit=500&sort=createdAt%20desc`
    : undefined;
  const promotionTypeWhere = encodeURIComponent(`key="${PROMOTIONS_TYPE_KEY}"`);
  const promotionTypesUri = projectKey
    ? `/${projectKey}/types?where=${promotionTypeWhere}&limit=1`
    : undefined;
  const orders = usePlatformGet<RestPage<PromotionUsageResource>>(ordersUri);
  const carts = usePlatformGet<RestPage<PromotionUsageResource>>(cartsUri);
  const promotions = usePlatformGet<RestPage<CartDiscount>>(promotionsUri);
  const promotionTypes =
    usePlatformGet<RestPage<PromotionAssignmentType>>(promotionTypesUri);
  const promotionField = customer.custom?.customFieldsRaw?.find(
    (field) => field.name === PROMOTIONS_FIELD_NAME
  );
  const customerPromotionIds = useMemo(
    () => promotionReferenceIds(promotionField?.value),
    [promotionField?.value]
  );
  const [assignedIds, setAssignedIds] = useState(customerPromotionIds);
  const [selectedPromotionIds, setSelectedPromotionIds] = useState<string[]>(
    []
  );
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [saving, setSaving] = useState(false);
  const [mutationError, setMutationError] = useState<unknown>();

  useEffect(() => setAssignedIds(customerPromotionIds), [customerPromotionIds]);

  const allPromotions = promotions.data?.results ?? [];
  const assignedPromotions = assignedIds.map(
    (id) =>
      allPromotions.find((promotion) => promotion.id === id) ?? {
        id,
        name: {},
        value: { type: 'relative' as const },
        isActive: false,
        requiresDiscountCode: false,
      }
  );
  const assignmentType = promotionTypes.data?.results[0];
  const currentTypeKey = customer.custom?.type?.key;
  const promotionFieldDefinition = assignmentType?.fieldDefinitions.find(
    (field) => field.name === PROMOTIONS_FIELD_NAME
  );
  const isAssignmentTypeValid = Boolean(
    assignmentType?.resourceTypeIds.includes('customer') &&
      promotionFieldDefinition?.type.name === 'Set' &&
      promotionFieldDefinition.type.elementType?.name === 'Reference' &&
      promotionFieldDefinition.type.elementType.referenceTypeId ===
        'cart-discount'
  );
  const assignmentBlockingReason =
    assignmentType && !isAssignmentTypeValid
      ? `The “${PROMOTIONS_TYPE_KEY}” Custom Type must define “${PROMOTIONS_FIELD_NAME}” as a set of Cart Discount references.`
      : currentTypeKey && currentTypeKey !== PROMOTIONS_TYPE_KEY
      ? `This customer already uses the “${currentTypeKey}” Custom Type. A customer can use only one Custom Type at a time.`
      : undefined;
  const assignmentSetupNotice = !assignmentType
    ? `The “${PROMOTIONS_TYPE_KEY}” Customer Custom Type will be created automatically when you submit the first promotion.`
    : undefined;
  const promotionOptions = allPromotions
    .filter(
      (promotion) => promotion.isActive && !assignedIds.includes(promotion.id)
    )
    .map((promotion) => ({
      value: promotion.id,
      label: `${
        promotion.key ?? localizedValue(promotion.name)
      } — ${localizedValue(promotion.name)}`,
    }));
  const pagedAssignedPromotions = assignedPromotions.slice(
    (page - 1) * perPage,
    page * perPage
  );

  useEffect(() => {
    const lastPage = Math.max(
      1,
      Math.ceil(assignedPromotions.length / perPage)
    );
    if (page > lastPage) setPage(lastPage);
  }, [assignedPromotions.length, page, perPage]);

  const saveAssignments = async (nextIds: string[], successMessage: string) => {
    if (!projectKey || !canManage || assignmentBlockingReason) return false;
    const references: PromotionReference[] = nextIds.map((id) => ({
      typeId: 'cart-discount',
      id,
    }));
    const action =
      currentTypeKey === PROMOTIONS_TYPE_KEY
        ? {
            action: 'setCustomField',
            name: PROMOTIONS_FIELD_NAME,
            value: references,
          }
        : {
            action: 'setCustomType',
            type: { typeId: 'type', key: PROMOTIONS_TYPE_KEY },
            fields: { [PROMOTIONS_FIELD_NAME]: references },
          };

    setSaving(true);
    setMutationError(undefined);
    try {
      if (!assignmentType) {
        await dispatch(
          actions.post({
            mcApiProxyTarget: MC_API_PROXY_TARGETS.COMMERCETOOLS_PLATFORM,
            uri: `/${projectKey}/types`,
            payload: {
              key: PROMOTIONS_TYPE_KEY,
              name: { en: 'Promotions List' },
              description: {
                en: 'Cart Discounts assigned to a customer by customer service.',
              },
              resourceTypeIds: ['customer'],
              fieldDefinitions: [
                {
                  name: PROMOTIONS_FIELD_NAME,
                  label: { en: 'Promotions' },
                  type: {
                    name: 'Set',
                    elementType: {
                      name: 'Reference',
                      referenceTypeId: 'cart-discount',
                    },
                  },
                  required: false,
                  inputHint: 'SingleLine',
                },
              ],
            },
          })
        );
        promotionTypes.refetch();
      }
      await dispatch(
        actions.post({
          mcApiProxyTarget: MC_API_PROXY_TARGETS.COMMERCETOOLS_PLATFORM,
          uri: `/${projectKey}/customers/${customer.id}`,
          payload: { version: customer.version, actions: [action] },
        })
      );
      setAssignedIds(nextIds);
      await onSaved();
      showNotification({
        domain: NOTIFICATION_DOMAINS.SIDE,
        kind: NOTIFICATION_KINDS_SIDE.success,
        text: successMessage,
      });
      return true;
    } catch (caught) {
      setMutationError(caught);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const assignSelectedPromotions = async () => {
    if (selectedPromotionIds.length === 0) return;
    const nextIds = [...assignedIds, ...selectedPromotionIds].filter(
      (id, index, ids) => ids.indexOf(id) === index
    );
    const saved = await saveAssignments(
      nextIds,
      selectedPromotionIds.length === 1
        ? 'Promotion assigned to customer.'
        : `${selectedPromotionIds.length} promotions assigned to customer.`
    );
    if (saved) setSelectedPromotionIds([]);
  };

  const usageRows = useMemo(
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
          usedAt: resource.createdAt,
          total: resource.totalPrice,
        }))
      ),
    [carts.data, orders.data]
  );

  return (
    <Spacings.Stack scale="xl">
      <PageState
        loading={promotions.loading || promotionTypes.loading}
        error={promotions.error ?? promotionTypes.error}
      >
        <Spacings.Stack scale="l">
          <SelectField
            name="customer-promotions"
            title="Promotion"
            description="Assign promotions to customers"
            value={selectedPromotionIds}
            options={promotionOptions}
            onChange={(event) => {
              setSelectedPromotionIds(
                Array.isArray(event.target.value)
                  ? event.target.value.map(String)
                  : []
              );
              setMutationError(undefined);
            }}
            placeholder="Select…"
            isMulti
            isSearchable
            isClearable
            isRequired
            isDisabled={
              !canManage || saving || Boolean(assignmentBlockingReason)
            }
            horizontalConstraint={8}
          />

          <Spacings.Inline scale="m">
            <TabularDetailPage.FormSecondaryButton
              label="Reset"
              onClick={() => {
                setSelectedPromotionIds([]);
                setMutationError(undefined);
              }}
              isDisabled={saving || selectedPromotionIds.length === 0}
            />
            <TabularDetailPage.FormPrimaryButton
              label={saving ? 'Submitting…' : 'Submit'}
              onClick={() => void assignSelectedPromotions()}
              isDisabled={
                !canManage ||
                saving ||
                selectedPromotionIds.length === 0 ||
                Boolean(assignmentBlockingReason)
              }
            />
          </Spacings.Inline>

          {assignmentSetupNotice ? (
            <ContentNotification type="info">
              <Text.Body>{assignmentSetupNotice}</Text.Body>
            </ContentNotification>
          ) : null}
          {assignmentBlockingReason ? (
            <ContentNotification type="warning">
              <Text.Body>{assignmentBlockingReason}</Text.Body>
            </ContentNotification>
          ) : null}
          {mutationError ? (
            <ContentNotification type="error">
              <Text.Body>{getErrorMessage(mutationError)}</Text.Body>
            </ContentNotification>
          ) : null}

          <PageState
            isEmpty={assignedPromotions.length === 0}
            emptyTitle="No promotions assigned to this customer"
            emptyBody="Select one or more promotions above, then submit to assign them."
          >
            <Spacings.Stack scale="l">
              <DataTable<CartDiscount>
                columns={[
                  { key: 'key', label: 'Key' },
                  { key: 'name', label: 'Name' },
                  { key: 'value', label: 'Discount' },
                  { key: 'type', label: 'Type' },
                  { key: 'isActive', label: 'Active' },
                  {
                    key: 'requiresDiscountCode',
                    label: 'Discount Code Required',
                  },
                  { key: 'validFrom', label: 'Valid From' },
                  { key: 'validUntil', label: 'Valid Until' },
                  { key: 'remove', label: '' },
                ]}
                rows={pagedAssignedPromotions}
                itemRenderer={(item, column) => {
                  if (column.key === 'key') return item.key ?? '—';
                  if (column.key === 'name') return localizedValue(item.name);
                  if (column.key === 'value') return promotionValueLabel(item);
                  if (column.key === 'type') return promotionTypeLabel(item);
                  if (column.key === 'isActive')
                    return item.isActive ? 'Yes' : 'No';
                  if (column.key === 'requiresDiscountCode')
                    return item.requiresDiscountCode ? 'Yes' : 'No';
                  if (column.key === 'validFrom')
                    return item.validFrom ? formatDate(item.validFrom) : '—';
                  if (column.key === 'validUntil')
                    return item.validUntil ? formatDate(item.validUntil) : '—';
                  return (
                    <TabularDetailPage.FormSecondaryButton
                      label="Remove"
                      onClick={() =>
                        void saveAssignments(
                          assignedIds.filter((id) => id !== item.id),
                          'Promotion removed from customer.'
                        )
                      }
                      isDisabled={
                        !canManage ||
                        saving ||
                        Boolean(assignmentBlockingReason)
                      }
                    />
                  );
                }}
              />
              <Pagination
                page={page}
                onPageChange={setPage}
                perPage={perPage}
                onPerPageChange={(nextPerPage) => {
                  setPerPage(nextPerPage);
                  setPage(1);
                }}
                totalItems={assignedPromotions.length}
              />
            </Spacings.Stack>
          </PageState>
        </Spacings.Stack>
      </PageState>

      <CollapsiblePanel header="Promotion usage" isDefaultClosed={false}>
        <PageState
          loading={orders.loading || carts.loading}
          error={orders.error ?? carts.error}
          isEmpty={!orders.loading && !carts.loading && usageRows.length === 0}
          emptyTitle="No promotion codes used by this customer"
          emptyBody="Applied discount codes from the customer's carts and orders will appear here."
        >
          <DataTable<(typeof usageRows)[number]>
            columns={[
              { key: 'resourceType', label: 'Type' },
              { key: 'resource', label: 'Cart / order' },
              { key: 'code', label: 'Discount code' },
              { key: 'name', label: 'Promotion' },
              { key: 'state', label: 'State' },
              { key: 'usedAt', label: 'Used on' },
              { key: 'total', label: 'Resource total' },
            ]}
            rows={usageRows}
            itemRenderer={(item, column) => {
              if (column.key === 'total') return formatMoney(item.total);
              if (column.key === 'usedAt') return formatDate(item.usedAt);
              return String(item[column.key as keyof typeof item] ?? '—');
            }}
          />
        </PageState>
      </CollapsiblePanel>
    </Spacings.Stack>
  );
};

type CustomerCustomFieldType = {
  name: string;
  referenceTypeId?: string;
  values?: Array<{ key: string; label?: Record<string, string> }>;
  elementType?: CustomerCustomFieldType;
};

type CustomerCustomFieldDefinition = {
  name: string;
  label: Record<string, string>;
  required: boolean;
  inputHint: string;
  type: CustomerCustomFieldType;
};

type CustomerCustomType = {
  id: string;
  key: string;
  name: Record<string, string>;
  description?: Record<string, string>;
  resourceTypeIds: string[];
  fieldDefinitions: CustomerCustomFieldDefinition[];
};

const customFieldTypeLabel = (type: CustomerCustomFieldType): string =>
  type.name === 'Set' && type.elementType
    ? `Set of ${customFieldTypeLabel(type.elementType)}`
    : type.name.replace(/([a-z])([A-Z])/g, '$1 $2');

const customFieldInputValue = (
  value: unknown,
  type: CustomerCustomFieldType,
  locale: string
): string => {
  if (value == null) return '';
  if (type.name === 'LocalizedString' && typeof value === 'object') {
    const localized = value as Record<string, unknown>;
    return String(localized[locale] ?? Object.values(localized)[0] ?? '');
  }
  if (type.name === 'Money' && typeof value === 'object') {
    const money = value as Partial<Money>;
    if (!money.currencyCode || typeof money.centAmount !== 'number') return '';
    return `${money.currencyCode} ${(
      money.centAmount /
      10 ** (money.fractionDigits ?? 2)
    ).toFixed(money.fractionDigits ?? 2)}`;
  }
  if (type.name === 'Reference' && typeof value === 'object') {
    const reference = value as { id?: unknown };
    return typeof reference.id === 'string' ? reference.id : '';
  }
  if (type.name === 'Set' && Array.isArray(value) && type.elementType) {
    return value
      .map((item) => customFieldInputValue(item, type.elementType!, locale))
      .join(', ');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const parseCustomFieldInput = (
  input: string,
  type: CustomerCustomFieldType,
  locale: string,
  existingValue?: unknown
): unknown => {
  const value = input.trim();
  if (!value) return undefined;
  if (type.name === 'String' || type.name === 'Enum') return value;
  if (type.name === 'LocalizedEnum') return value;
  if (
    type.name === 'Date' ||
    type.name === 'Time' ||
    type.name === 'DateTime'
  ) {
    return value;
  }
  if (type.name === 'Number') {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error('Enter a valid number.');
    return number;
  }
  if (type.name === 'Boolean') return value === 'true';
  if (type.name === 'LocalizedString') {
    const current =
      existingValue && typeof existingValue === 'object'
        ? (existingValue as Record<string, unknown>)
        : {};
    return { ...current, [locale]: value };
  }
  if (type.name === 'Money') {
    const match = value.match(/^([A-Za-z]{3})\s+(-?\d+(?:\.\d{1,2})?)$/);
    if (!match) throw new Error('Use the format “AUD 40.00”.');
    return {
      type: 'centPrecision',
      currencyCode: match[1].toUpperCase(),
      centAmount: Math.round(Number(match[2]) * 100),
      fractionDigits: 2,
    };
  }
  if (type.name === 'Reference') {
    if (!type.referenceTypeId)
      throw new Error('The reference type is not configured.');
    return { typeId: type.referenceTypeId, id: value };
  }
  if (type.name === 'Set' && type.elementType) {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => parseCustomFieldInput(item, type.elementType!, locale));
  }
  try {
    return JSON.parse(value);
  } catch {
    throw new Error('Enter a valid JSON value.');
  }
};

const customFieldPlaceholder = (type: CustomerCustomFieldType) => {
  if (type.name === 'Money') return 'AUD 40.00';
  if (type.name === 'Date') return 'YYYY-MM-DD';
  if (type.name === 'Time') return 'HH:mm:ss';
  if (type.name === 'DateTime') return 'YYYY-MM-DDTHH:mm:ss.sssZ';
  if (type.name === 'Reference') return 'Resource ID';
  if (type.name === 'Set') return 'Comma-separated values';
  return undefined;
};

export const CustomerCustomAttributes = ({
  customer,
  onSaved,
}: {
  customer: Customer;
  onSaved: () => Promise<unknown>;
}) => {
  const projectKey = useApplicationContext((context) => context.project?.key);
  const locale = useApplicationContext(
    (context) => context.dataLocale ?? context.project?.languages?.[0] ?? 'en'
  );
  const dispatch = useAsyncDispatch();
  const showNotification = useShowNotification();
  const canManage = useIsAuthorized({
    demandedPermissions: [PERMISSIONS.ManageCustomers],
  });
  const customerTypesWhere = encodeURIComponent(
    'resourceTypeIds contains any("customer")'
  );
  const typesUri = projectKey
    ? `/${projectKey}/types?where=${customerTypesWhere}&limit=500&sort=key%20asc`
    : undefined;
  const types = usePlatformGet<RestPage<CustomerCustomType>>(typesUri);
  const currentTypeKey = customer.custom?.type?.key ?? '';
  const [selectedTypeKey, setSelectedTypeKey] = useState(currentTypeKey);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>();
  const [validationError, setValidationError] = useState<string>();
  const selectedType = types.data?.results.find(
    (type) => type.key === selectedTypeKey
  );
  const existingFields = useMemo(
    () =>
      new Map(
        (customer.custom?.customFieldsRaw ?? []).map((field) => [
          field.name,
          field.value,
        ])
      ),
    [customer.custom?.customFieldsRaw]
  );

  useEffect(() => setSelectedTypeKey(currentTypeKey), [currentTypeKey]);

  useEffect(() => {
    if (!selectedType) {
      setDraftValues({});
      return;
    }
    const sameType = selectedType.key === currentTypeKey;
    setDraftValues(
      Object.fromEntries(
        selectedType.fieldDefinitions.map((field) => [
          field.name,
          sameType
            ? customFieldInputValue(
                existingFields.get(field.name),
                field.type,
                locale
              )
            : '',
        ])
      )
    );
    setValidationError(undefined);
    setError(undefined);
  }, [currentTypeKey, existingFields, locale, selectedType]);

  const typeOptions = (types.data?.results ?? []).map((type) => ({
    value: type.key,
    label: `${localizedValue(type.name)} (${type.key})`,
  }));

  const save = async () => {
    if (!projectKey || !selectedType || !canManage) return;
    const values: Record<string, unknown> = {};
    setValidationError(undefined);
    setError(undefined);
    try {
      selectedType.fieldDefinitions.forEach((field) => {
        const input = draftValues[field.name] ?? '';
        if (field.required && !input.trim()) {
          throw new Error(
            `${localizedValue(field.label) || field.name} is required.`
          );
        }
        const parsed = parseCustomFieldInput(
          input,
          field.type,
          locale,
          existingFields.get(field.name)
        );
        if (parsed !== undefined) values[field.name] = parsed;
      });
    } catch (caught) {
      setValidationError(
        caught instanceof Error ? caught.message : 'Check the field values.'
      );
      return;
    }

    const isCurrentType = selectedType.key === currentTypeKey;
    const updateActions = isCurrentType
      ? selectedType.fieldDefinitions.map((field) => ({
          action: 'setCustomField',
          name: field.name,
          value: values[field.name] ?? null,
        }))
      : [
          {
            action: 'setCustomType',
            type: { typeId: 'type', key: selectedType.key },
            fields: values,
          },
        ];

    setSaving(true);
    try {
      await dispatch(
        actions.post({
          mcApiProxyTarget: MC_API_PROXY_TARGETS.COMMERCETOOLS_PLATFORM,
          uri: `/${projectKey}/customers/${customer.id}`,
          payload: { version: customer.version, actions: updateActions },
        })
      );
      await onSaved();
      showNotification({
        domain: NOTIFICATION_DOMAINS.SIDE,
        kind: NOTIFICATION_KINDS_SIDE.success,
        text: isCurrentType
          ? 'Customer custom attributes updated.'
          : 'Custom type added to customer.',
      });
    } catch (caught) {
      setError(caught);
    } finally {
      setSaving(false);
    }
  };

  const renderField = (field: CustomerCustomFieldDefinition) => {
    const title = localizedValue(field.label) || field.name;
    const value = draftValues[field.name] ?? '';
    const common = {
      name: `custom-field-${field.name}`,
      title,
      value,
      isRequired: field.required,
      isDisabled: !canManage || saving,
      horizontalConstraint: 'scale' as const,
    };
    if (field.type.name === 'Boolean') {
      return (
        <SelectField
          {...common}
          value={value || null}
          options={[
            { value: 'true', label: 'Yes' },
            { value: 'false', label: 'No' },
          ]}
          onChange={(event) =>
            setDraftValues((current) => ({
              ...current,
              [field.name]: String(event.target.value ?? ''),
            }))
          }
          isClearable={!field.required}
        />
      );
    }
    if (
      (field.type.name === 'Enum' || field.type.name === 'LocalizedEnum') &&
      field.type.values
    ) {
      return (
        <SelectField
          {...common}
          value={value || null}
          options={field.type.values.map((option) => ({
            value: option.key,
            label: option.label ? localizedValue(option.label) : option.key,
          }))}
          onChange={(event) =>
            setDraftValues((current) => ({
              ...current,
              [field.name]: String(event.target.value ?? ''),
            }))
          }
          isClearable={!field.required}
        />
      );
    }
    return (
      <TextField
        {...common}
        onChange={(event) =>
          setDraftValues((current) => ({
            ...current,
            [field.name]: event.target.value,
          }))
        }
        placeholder={customFieldPlaceholder(field.type)}
        hint={`${customFieldTypeLabel(field.type)}${
          field.inputHint === 'MultiLine' ? ' · Multi-line value' : ''
        }`}
      />
    );
  };

  return (
    <PageState loading={types.loading} error={types.error}>
      <Spacings.Stack scale="xl">
        <CollapsiblePanel
          header="Customer custom attributes"
          isDefaultClosed={false}
        >
          <Spacings.Stack scale="l">
            {currentTypeKey ? (
              <KeyValueGrid
                items={[
                  {
                    label: 'Custom type',
                    value:
                      localizedValue(selectedType?.name) ||
                      customer.custom?.type?.name ||
                      currentTypeKey,
                  },
                  { label: 'Type key', value: currentTypeKey },
                  {
                    label: 'Fields',
                    value: selectedType?.fieldDefinitions.length ?? 0,
                  },
                ]}
              />
            ) : (
              <SelectField
                name="customer-custom-type"
                title="Custom type"
                value={selectedTypeKey || null}
                options={typeOptions}
                onChange={(event) =>
                  setSelectedTypeKey(String(event.target.value ?? ''))
                }
                placeholder={
                  typeOptions.length > 0
                    ? 'Select a customer custom type'
                    : 'No customer custom types configured'
                }
                isClearable
                isDisabled={!canManage || saving || typeOptions.length === 0}
                horizontalConstraint={8}
              />
            )}

            {!selectedTypeKey ? (
              <ContentNotification type="info">
                <Text.Body>
                  <strong>No custom attributes</strong>
                </Text.Body>
                <Text.Body>
                  Select a customer custom type to add its fields.
                </Text.Body>
              </ContentNotification>
            ) : selectedType ? (
              selectedType.fieldDefinitions.length > 0 ? (
                <Grid
                  gridGap="24px"
                  gridTemplateColumns="repeat(2, minmax(0, 1fr))"
                >
                  {selectedType.fieldDefinitions.map((field) => (
                    <Grid.Item key={field.name}>{renderField(field)}</Grid.Item>
                  ))}
                </Grid>
              ) : (
                <ContentNotification type="info">
                  <Text.Body>
                    This custom type has no field definitions.
                  </Text.Body>
                </ContentNotification>
              )
            ) : (
              <ContentNotification type="error">
                <Text.Body>
                  The customer’s custom type definition could not be loaded.
                </Text.Body>
              </ContentNotification>
            )}

            {validationError ? (
              <ContentNotification type="error">
                <Text.Body>{validationError}</Text.Body>
              </ContentNotification>
            ) : null}
            {error ? (
              <ContentNotification type="error">
                <Text.Body>{getErrorMessage(error)}</Text.Body>
              </ContentNotification>
            ) : null}
            {selectedType ? (
              <Spacings.Inline scale="m">
                <TabularDetailPage.FormSecondaryButton
                  label="Reset"
                  onClick={() => {
                    const sameType = selectedType.key === currentTypeKey;
                    setDraftValues(
                      Object.fromEntries(
                        selectedType.fieldDefinitions.map((field) => [
                          field.name,
                          sameType
                            ? customFieldInputValue(
                                existingFields.get(field.name),
                                field.type,
                                locale
                              )
                            : '',
                        ])
                      )
                    );
                    setValidationError(undefined);
                    setError(undefined);
                  }}
                  isDisabled={!canManage || saving}
                />
                <TabularDetailPage.FormPrimaryButton
                  label={
                    saving
                      ? 'Saving…'
                      : currentTypeKey
                      ? 'Save attributes'
                      : 'Add custom type'
                  }
                  onClick={() => void save()}
                  isDisabled={!canManage || saving}
                />
              </Spacings.Inline>
            ) : null}
          </Spacings.Stack>
        </CollapsiblePanel>
      </Spacings.Stack>
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
