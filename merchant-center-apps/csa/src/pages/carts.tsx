import { useEffect, useMemo, useState } from 'react';
import {
  Redirect,
  Route,
  Switch,
  useHistory,
  useParams,
  useRouteMatch,
} from 'react-router-dom';
import {
  SuspendedRoute,
  useMcQuery,
} from '@commercetools-frontend/application-shell';
import { useShowNotification } from '@commercetools-frontend/actions-global';
import { useApplicationContext } from '@commercetools-frontend/application-shell-connectors';
import {
  TabHeader,
  TabularDetailPage,
} from '@commercetools-frontend/application-components';
import {
  GRAPHQL_TARGETS,
  MC_API_PROXY_TARGETS,
  NOTIFICATION_DOMAINS,
  NOTIFICATION_KINDS_SIDE,
} from '@commercetools-frontend/constants';
import { useIsAuthorized } from '@commercetools-frontend/permissions';
import { actions, useAsyncDispatch } from '@commercetools-frontend/sdk';
import CollapsiblePanel from '@commercetools-uikit/collapsible-panel';
import DataTable from '@commercetools-uikit/data-table';
import Grid from '@commercetools-uikit/grid';
import {
  useDataTableSortingState,
  usePaginationState,
} from '@commercetools-uikit/hooks';
import { Pagination } from '@commercetools-uikit/pagination';
import { ContentNotification } from '@commercetools-uikit/notifications';
import PrimaryButton from '@commercetools-uikit/primary-button';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import TextField from '@commercetools-uikit/text-field';
import SelectField from '@commercetools-uikit/select-field';
import {
  CART_CUSTOMER_ADDRESSES_QUERY,
  CART_DETAIL_QUERY,
  CARTS_QUERY,
} from '../graphql';
import { PERMISSIONS } from '../constants';
import type { Address, Cart, Customer, QueryPage } from '../types';
import {
  exactSearchPredicate,
  formatAddress,
  formatDate,
  formatMoney,
  getErrorMessage,
} from '../utils';
import {
  CustomFieldsTable,
  KeyValueGrid,
  ListPage,
  PageState,
} from '../components/common';

type CartsData = { carts: QueryPage<Cart> };
type CartDetailData = { cart: Cart | null };
type CartCustomerAddressesData = { customer: Customer | null };

type ProductProjectionVariant = {
  id: number;
  sku?: string;
  key?: string;
  prices?: Array<{ value: Cart['totalPrice'] }>;
  availability?: {
    availableQuantity?: number;
    isOnStock?: boolean;
  };
};

type ProductProjection = {
  id: string;
  key?: string;
  name: Record<string, string>;
  masterVariant: ProductProjectionVariant;
  variants: ProductProjectionVariant[];
};

type ProductProjectionSearchResponse = {
  results: ProductProjection[];
};

type ProductVariantSearchRow = {
  id: string;
  productId: string;
  variantId: number;
  name: string;
  sku?: string;
  price?: Cart['totalPrice'];
  availableQuantity?: number;
};

type CartAddressForm = {
  firstName: string;
  lastName: string;
  company: string;
  streetNumber: string;
  streetName: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  email: string;
  phone: string;
};

const addressToForm = (address?: Address | null): CartAddressForm => ({
  firstName: address?.firstName ?? '',
  lastName: address?.lastName ?? '',
  company: address?.company ?? '',
  streetNumber: address?.streetNumber ?? '',
  streetName: address?.streetName ?? '',
  city: address?.city ?? '',
  state: address?.state ?? '',
  postalCode: address?.postalCode ?? '',
  country: address?.country ?? '',
  email: address?.email ?? '',
  phone: address?.phone ?? '',
});

const hasAddressValues = (address: CartAddressForm) =>
  Object.values(address).some((value) => value.trim().length > 0);

const formToAddress = (form: CartAddressForm): Address =>
  Object.fromEntries(
    Object.entries({
      ...form,
      country: form.country.trim().toUpperCase(),
    })
      .map(([key, value]) => [key, value.trim()])
      .filter(([, value]) => value.length > 0)
  );

const validateAddress = (label: string, address: CartAddressForm) => {
  if (!hasAddressValues(address)) return undefined;
  if (!/^[A-Za-z]{2}$/.test(address.country.trim()))
    return `${label} country must be a two-letter ISO code, for example AU.`;
  return undefined;
};

const savedAddressOptionLabel = (
  address: Address,
  index: number,
  customer?: Customer | null
) => {
  const labels = [
    address.id === customer?.defaultShippingAddressId
      ? 'Default shipping'
      : undefined,
    address.id === customer?.defaultBillingAddressId
      ? 'Default billing'
      : undefined,
  ].filter(Boolean);
  const formattedAddress = formatAddress(address).replace(/\n/g, ', ');

  return [labels.join(' & '), formattedAddress || `Saved address ${index + 1}`]
    .filter(Boolean)
    .join(' — ');
};

const isProductSearchDeactivatedError = (error: unknown) =>
  getErrorMessage(error)
    .toLocaleLowerCase()
    .includes('endpoint is deactivated');

const productProjectionMatches = (
  product: ProductProjection,
  searchTerm: string
) => {
  const normalizedSearchTerm = searchTerm.toLocaleLowerCase();
  const variants = [product.masterVariant, ...(product.variants ?? [])];
  const searchableValues = [
    product.id,
    product.key,
    ...Object.values(product.name),
    ...variants.flatMap((variant) => [variant.sku, variant.key]),
  ];

  return searchableValues.some((value) =>
    value?.toLocaleLowerCase().includes(normalizedSearchTerm)
  );
};

const Carts = () => {
  const match = useRouteMatch();
  const history = useHistory();

  return (
    <Switch>
      <SuspendedRoute exact path={`${match.path}/new`}>
        <CartCreate onClose={() => history.push(match.url)} />
      </SuspendedRoute>
      <SuspendedRoute path={`${match.path}/:id`}>
        <CartDetail onClose={() => history.push(match.url)} />
      </SuspendedRoute>
      <SuspendedRoute>
        <CartList baseUrl={match.url} />
      </SuspendedRoute>
    </Switch>
  );
};

const CartList = (props: { baseUrl: string }) => {
  const history = useHistory();
  const { page, perPage } = usePaginationState();
  const sorting = useDataTableSortingState({
    key: 'lastModifiedAt',
    order: 'desc',
  });
  const [search, setSearch] = useState('');
  const where = useMemo(
    () =>
      exactSearchPredicate(search, [
        'key',
        'customerEmail',
        'customerId',
        'id',
      ]),
    [search]
  );
  const { data, loading, error } = useMcQuery<CartsData>(CARTS_QUERY, {
    variables: {
      limit: perPage.value,
      offset: (page.value - 1) * perPage.value,
      sort: [`${sorting.value.key} ${sorting.value.order}`],
      where,
    },
    context: { target: GRAPHQL_TARGETS.COMMERCETOOLS_PLATFORM },
    fetchPolicy: 'cache-and-network',
  });
  const rows = data?.carts.results ?? [];
  return (
    <ListPage
      title="Carts"
      subtitle="Active and historical B2C shopping carts"
      controls={
        <PrimaryButton
          label="Create cart"
          onClick={() => history.push(`${props.baseUrl}/new`)}
        />
      }
    >
      <Spacings.Stack scale="l">
        <TextField
          name="cart-search"
          title="Exact cart search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Key, customer email, customer ID, or cart ID"
          horizontalConstraint={10}
        />
        <PageState
          loading={loading}
          error={error}
          isEmpty={!loading && rows.length === 0}
          emptyTitle="No carts found"
        >
          <DataTable<Cart>
            columns={[
              { key: 'key', label: 'Cart' },
              { key: 'customerEmail', label: 'Customer' },
              { key: 'cartState', label: 'State' },
              { key: 'totalLineItemQuantity', label: 'Items' },
              { key: 'totalPrice', label: 'Total' },
              { key: 'lastModifiedAt', label: 'Modified', isSortable: true },
            ]}
            rows={rows}
            itemRenderer={(item, column) =>
              column.key === 'key'
                ? item.key ?? item.id
                : column.key === 'totalPrice'
                ? formatMoney(item.totalPrice)
                : column.key === 'lastModifiedAt'
                ? formatDate(item.lastModifiedAt)
                : String(item[column.key as keyof Cart] ?? '—')
            }
            sortedBy={sorting.value.key}
            sortDirection={sorting.value.order}
            onSortChange={sorting.onChange}
            onRowClick={(row) =>
              history.push(`${props.baseUrl}/${row.id}/general`)
            }
          />
          <Pagination
            page={page.value}
            onPageChange={page.onChange}
            perPage={perPage.value}
            onPerPageChange={perPage.onChange}
            totalItems={data?.carts.total ?? 0}
            perPageRange="s"
          />
        </PageState>
      </Spacings.Stack>
    </ListPage>
  );
};

const CartCreate = (props: { onClose: () => void }) => {
  const project = useApplicationContext((context) => context.project);
  const history = useHistory();
  const match = useRouteMatch();
  const dispatch = useAsyncDispatch();
  const showNotification = useShowNotification();
  const canManage = useIsAuthorized({
    demandedPermissions: [PERMISSIONS.ManageCarts],
  });
  const availableCurrencies = useMemo(
    () =>
      project?.currencies?.length ? [...project.currencies].sort() : ['USD'],
    [project?.currencies]
  );
  const [customerReference, setCustomerReference] = useState('');
  const [currency, setCurrency] = useState(availableCurrencies[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>();

  useEffect(() => {
    if (!availableCurrencies.includes(currency))
      setCurrency(availableCurrencies[0]);
  }, [availableCurrencies, currency]);

  const save = async () => {
    const customerWhere = exactSearchPredicate(customerReference, [
      'email',
      'id',
    ]);
    if (!project?.key || !canManage || !currency || !customerWhere) return;

    setSaving(true);
    setError(undefined);
    try {
      const query = new URLSearchParams({
        limit: '2',
        where: customerWhere,
      });
      const customerPage = (await dispatch(
        actions.get({
          mcApiProxyTarget: MC_API_PROXY_TARGETS.COMMERCETOOLS_PLATFORM,
          uri: `/${project.key}/customers?${query.toString()}`,
        })
      )) as QueryPage<Customer>;
      const customer = customerPage.results[0];
      if (!customer) {
        throw new Error(
          'No customer was found with that email address or customer ID.'
        );
      }

      const preferredCountry =
        customer.addresses?.find(
          (address) => address.id === customer.defaultShippingAddressId
        )?.country ??
        customer.addresses?.find(
          (address) => address.id === customer.defaultBillingAddressId
        )?.country ??
        customer.addresses?.find((address) => address.country)?.country;
      const country =
        preferredCountry &&
        (!project.countries?.length ||
          project.countries.includes(preferredCountry))
          ? preferredCountry
          : undefined;
      const cart = (await dispatch(
        actions.post({
          mcApiProxyTarget: MC_API_PROXY_TARGETS.COMMERCETOOLS_PLATFORM,
          uri: `/${project.key}/carts`,
          payload: {
            currency,
            country,
            customerId: customer.id,
            customerEmail: customer.email,
          },
        })
      )) as Pick<Cart, 'id'>;

      showNotification({
        domain: NOTIFICATION_DOMAINS.SIDE,
        kind: NOTIFICATION_KINDS_SIDE.success,
        text: 'Customer cart created.',
      });
      history.replace(`${match.url.replace(/\/new$/, '')}/${cart.id}/general`);
    } catch (caught) {
      setError(caught);
    } finally {
      setSaving(false);
    }
  };

  return (
    <TabularDetailPage
      title="Create B2C cart"
      subtitle="Create a cart for an existing customer"
      previousPathLabel="Go to View carts"
      onPreviousPathClick={props.onClose}
      tabControls={<TabHeader to={match.url} label="Cart" />}
      hideControls
    >
      <Spacings.Stack scale="l">
        {!canManage ? (
          <ContentNotification type="warning">
            <Text.Body>
              Manage-cart permission is required to create a cart.
            </Text.Body>
          </ContentNotification>
        ) : null}
        <Grid gridGap="24px" gridTemplateColumns="repeat(2, minmax(0, 1fr))">
          <Grid.Item>
            <TextField
              name="customer-reference"
              title="Customer email or ID"
              value={customerReference}
              onChange={(event) => setCustomerReference(event.target.value)}
              placeholder="customer@example.com or customer ID"
              isRequired
              isDisabled={!canManage || saving}
              horizontalConstraint="scale"
            />
          </Grid.Item>
          <Grid.Item>
            <SelectField
              name="currency"
              title="Currency"
              value={currency}
              options={availableCurrencies.map((value) => ({
                value,
                label: value,
              }))}
              onChange={(event) => setCurrency(String(event.target.value))}
              isRequired
              isDisabled={!canManage || saving}
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
            onClick={props.onClose}
            isDisabled={saving}
          />
          <TabularDetailPage.FormPrimaryButton
            label={saving ? 'Creating…' : 'Create cart'}
            onClick={() => void save()}
            isDisabled={
              !canManage ||
              saving ||
              !project?.key ||
              !currency ||
              !customerReference.trim()
            }
          />
        </Spacings.Inline>
      </Spacings.Stack>
    </TabularDetailPage>
  );
};

const CartDetail = (props: { onClose: () => void }) => {
  const { id } = useParams<{ id: string }>();
  const match = useRouteMatch();
  const history = useHistory();
  const { data, loading, error, refetch } = useMcQuery<CartDetailData>(
    CART_DETAIL_QUERY,
    {
      variables: { id },
      context: { target: GRAPHQL_TARGETS.COMMERCETOOLS_PLATFORM },
    }
  );
  const cart = data?.cart;
  const base = match.url.replace(/\/general$/, '');
  const applicationBase = base.replace(/\/carts\/[^/]+$/, '');
  return (
    <TabularDetailPage
      title={cart?.key ?? cart?.id ?? 'Cart'}
      subtitle={cart?.customerEmail ?? cart?.customerId ?? id}
      previousPathLabel="Go to View carts"
      onPreviousPathClick={props.onClose}
      tabControls={<TabHeader to={`${base}/general`} label="General" />}
      hideControls
    >
      <PageState
        loading={loading}
        error={error}
        isEmpty={cart === null}
        emptyTitle="Cart not found"
      >
        {cart ? (
          <Switch>
            <Route exact path={base}>
              <Redirect to={`${base}/general`} />
            </Route>
            <SuspendedRoute path={`${base}/general`}>
              <CartGeneral
                cart={cart}
                onSaved={() => refetch()}
                onOrderCreated={(orderId) =>
                  history.push(`${applicationBase}/orders/${orderId}/general`)
                }
              />
            </SuspendedRoute>
            <Redirect to={`${base}/general`} />
          </Switch>
        ) : null}
      </PageState>
    </TabularDetailPage>
  );
};

const CartGeneral = (props: {
  cart: Cart;
  onSaved: () => Promise<unknown>;
  onOrderCreated: (orderId: string) => void;
}) => (
  <Spacings.Stack scale="xl">
    <CartActions {...props} />
    <CollapsiblePanel header="Cart summary" isDefaultClosed={false}>
      <Grid gridGap="24px" gridTemplateColumns="repeat(2, minmax(0, 1fr))">
        <Grid.Item>
          <KeyValueGrid
            items={[
              { label: 'Cart', value: props.cart.key ?? props.cart.id },
              { label: 'Cart status', value: props.cart.cartState },
              {
                label: 'Customer',
                value: props.cart.customerEmail ?? props.cart.customerId ?? '—',
              },
              {
                label: 'Items',
                value: String(props.cart.totalLineItemQuantity ?? 0),
              },
            ]}
          />
        </Grid.Item>
        <Grid.Item>
          <KeyValueGrid
            items={[
              { label: 'Total', value: formatMoney(props.cart.totalPrice) },
              { label: 'Created', value: formatDate(props.cart.createdAt) },
              {
                label: 'Modified',
                value: formatDate(props.cart.lastModifiedAt),
              },
            ]}
          />
        </Grid.Item>
      </Grid>
    </CollapsiblePanel>
    <CollapsiblePanel header="Cart items" isDefaultClosed={false}>
      <PageState
        isEmpty={(props.cart.lineItems ?? []).length === 0}
        emptyTitle="No line items"
      >
        <DataTable<NonNullable<Cart['lineItems']>[number]>
          columns={[
            { key: 'name', label: 'Product' },
            { key: 'sku', label: 'SKU' },
            { key: 'unitPrice', label: 'Unit price' },
            { key: 'quantity', label: 'Qty' },
            { key: 'totalPrice', label: 'Total price' },
          ]}
          rows={props.cart.lineItems ?? []}
          itemRenderer={(item, column) =>
            column.key === 'name'
              ? item.name ??
                item.nameAllLocales?.[0]?.value ??
                item.productId ??
                '—'
              : column.key === 'sku'
              ? item.variant?.sku ?? '—'
              : column.key === 'unitPrice'
              ? formatMoney({
                  ...item.totalPrice,
                  centAmount:
                    item.quantity > 0
                      ? Math.round(item.totalPrice.centAmount / item.quantity)
                      : 0,
                })
              : column.key === 'totalPrice'
              ? formatMoney(item.totalPrice)
              : String(item.quantity)
          }
        />
      </PageState>
    </CollapsiblePanel>
    <AddLineItems cart={props.cart} onSaved={props.onSaved} />
    <CartAddresses cart={props.cart} onSaved={props.onSaved} />
    <CollapsiblePanel header="Custom attributes" isDefaultClosed>
      <CustomFieldsTable fields={props.cart.custom?.customFieldsRaw} />
    </CollapsiblePanel>
  </Spacings.Stack>
);

const CartAddressFields = (props: {
  prefix: string;
  title: string;
  value: CartAddressForm;
  onChange: (value: CartAddressForm) => void;
  savedAddressOptions: Array<{ value: string; label: string }>;
  selectedAddressId: string;
  onSelectAddress: (addressId: string) => void;
  isLoadingSavedAddresses: boolean;
  isDisabled: boolean;
}) => {
  const updateField = (field: keyof CartAddressForm, value: string) =>
    props.onChange({ ...props.value, [field]: value });

  const field = (
    name: keyof CartAddressForm,
    title: string,
    placeholder?: string
  ) => (
    <TextField
      name={`${props.prefix}-${name}`}
      title={title}
      value={props.value[name]}
      onChange={(event) => updateField(name, event.target.value)}
      placeholder={placeholder}
      isDisabled={props.isDisabled}
      horizontalConstraint="scale"
    />
  );

  return (
    <Spacings.Stack scale="m">
      <Text.Subheadline as="h4">{props.title}</Text.Subheadline>
      <SelectField
        name={`${props.prefix}-saved-address`}
        title="Saved customer address"
        value={props.selectedAddressId || null}
        options={props.savedAddressOptions}
        onChange={(event) =>
          props.onSelectAddress(String(event.target.value ?? ''))
        }
        placeholder={
          props.isLoadingSavedAddresses
            ? 'Loading saved addresses…'
            : props.savedAddressOptions.length > 0
            ? 'Select a saved address'
            : 'No saved addresses available'
        }
        isClearable
        isDisabled={
          props.isDisabled ||
          props.isLoadingSavedAddresses ||
          props.savedAddressOptions.length === 0
        }
        horizontalConstraint="scale"
      />
      <Grid gridGap="16px" gridTemplateColumns="repeat(2, minmax(0, 1fr))">
        <Grid.Item>{field('firstName', 'First name')}</Grid.Item>
        <Grid.Item>{field('lastName', 'Last name')}</Grid.Item>
        <Grid.Item>{field('company', 'Company')}</Grid.Item>
        <Grid.Item>{field('phone', 'Phone')}</Grid.Item>
        <Grid.Item>{field('streetNumber', 'Street number')}</Grid.Item>
        <Grid.Item>{field('streetName', 'Street name')}</Grid.Item>
        <Grid.Item>{field('city', 'City')}</Grid.Item>
        <Grid.Item>{field('state', 'State / region')}</Grid.Item>
        <Grid.Item>{field('postalCode', 'Postal code')}</Grid.Item>
        <Grid.Item>
          {field('country', 'Country', 'Two-letter code, e.g. AU')}
        </Grid.Item>
        <Grid.Item>{field('email', 'Email')}</Grid.Item>
      </Grid>
    </Spacings.Stack>
  );
};

const CartAddresses = (props: {
  cart: Cart;
  onSaved: () => Promise<unknown>;
}) => {
  const projectKey = useApplicationContext((context) => context.project?.key);
  const dispatch = useAsyncDispatch();
  const showNotification = useShowNotification();
  const canManage = useIsAuthorized({
    demandedPermissions: [PERMISSIONS.ManageCarts],
  });
  const [shippingAddress, setShippingAddress] = useState<CartAddressForm>(() =>
    addressToForm(props.cart.shippingAddress)
  );
  const [billingAddress, setBillingAddress] = useState<CartAddressForm>(() =>
    addressToForm(props.cart.billingAddress)
  );
  const [selectedShippingAddressId, setSelectedShippingAddressId] =
    useState('');
  const [selectedBillingAddressId, setSelectedBillingAddressId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>();
  const isActive = props.cart.cartState === 'Active';
  const isDisabled = !canManage || !isActive || saving;
  const {
    data: customerAddressesData,
    loading: loadingCustomerAddresses,
    error: customerAddressesError,
  } = useMcQuery<CartCustomerAddressesData>(CART_CUSTOMER_ADDRESSES_QUERY, {
    variables: { id: props.cart.customerId ?? '' },
    context: { target: GRAPHQL_TARGETS.COMMERCETOOLS_PLATFORM },
    fetchPolicy: 'cache-and-network',
    skip: !props.cart.customerId,
  });
  const savedAddresses = useMemo<Address[]>(
    () => customerAddressesData?.customer?.addresses ?? [],
    [customerAddressesData?.customer?.addresses]
  );
  const savedAddressOptions = useMemo<Array<{ value: string; label: string }>>(
    () =>
      savedAddresses.map((address, index) => ({
        value: address.id ?? `saved-address-${index}`,
        label: savedAddressOptionLabel(
          address,
          index,
          customerAddressesData?.customer
        ),
      })),
    [customerAddressesData?.customer, savedAddresses]
  );

  useEffect(() => {
    setShippingAddress(addressToForm(props.cart.shippingAddress));
    setBillingAddress(addressToForm(props.cart.billingAddress));
    setSelectedShippingAddressId('');
    setSelectedBillingAddressId('');
    setError(undefined);
  }, [props.cart]);

  const selectSavedAddress = (
    addressId: string,
    setSelectedAddressId: (value: string) => void,
    setAddress: (value: CartAddressForm) => void
  ) => {
    setSelectedAddressId(addressId);
    if (!addressId) return;

    const selectedIndex = savedAddressOptions.findIndex(
      (option) => option.value === addressId
    );
    const selectedAddress = savedAddresses[selectedIndex];
    if (selectedAddress) setAddress(addressToForm(selectedAddress));
  };

  const saveAddresses = async () => {
    if (!projectKey || !canManage || !isActive) return;

    const shippingError = validateAddress('Shipping address', shippingAddress);
    const billingError = validateAddress('Billing address', billingAddress);
    if (shippingError || billingError) {
      setError(new Error(shippingError ?? billingError));
      return;
    }

    const updateActions = [
      ...(hasAddressValues(shippingAddress)
        ? [
            {
              action: 'setShippingAddress',
              address: formToAddress(shippingAddress),
            },
          ]
        : []),
      ...(hasAddressValues(billingAddress)
        ? [
            {
              action: 'setBillingAddress',
              address: formToAddress(billingAddress),
            },
          ]
        : []),
    ];

    if (updateActions.length === 0) {
      setError(new Error('Enter a shipping or billing address to save.'));
      return;
    }

    setSaving(true);
    setError(undefined);
    try {
      await dispatch(
        actions.post({
          mcApiProxyTarget: MC_API_PROXY_TARGETS.COMMERCETOOLS_PLATFORM,
          uri: `/${projectKey}/carts/${props.cart.id}`,
          payload: {
            version: props.cart.version,
            actions: updateActions,
          },
        })
      );
      await props.onSaved();
      showNotification({
        domain: NOTIFICATION_DOMAINS.SIDE,
        kind: NOTIFICATION_KINDS_SIDE.success,
        text: 'Cart addresses updated.',
      });
    } catch (caught) {
      setError(caught);
    } finally {
      setSaving(false);
    }
  };

  return (
    <CollapsiblePanel header="Addresses" isDefaultClosed={false}>
      <Spacings.Stack scale="l">
        {!isActive ? (
          <ContentNotification type="info">
            <Text.Body>
              Addresses can only be updated while the cart is active.
            </Text.Body>
          </ContentNotification>
        ) : !canManage ? (
          <ContentNotification type="warning">
            <Text.Body>
              You can view these addresses, but your CSA role cannot update
              carts.
            </Text.Body>
          </ContentNotification>
        ) : null}
        {customerAddressesError ? (
          <ContentNotification type="warning">
            <Text.Body>
              Saved customer addresses could not be loaded. You can still enter
              an address manually: {getErrorMessage(customerAddressesError)}
            </Text.Body>
          </ContentNotification>
        ) : null}
        <Grid gridGap="32px" gridTemplateColumns="repeat(2, minmax(0, 1fr))">
          <Grid.Item>
            <CartAddressFields
              prefix="shipping-address"
              title="Shipping address"
              value={shippingAddress}
              onChange={setShippingAddress}
              savedAddressOptions={savedAddressOptions}
              selectedAddressId={selectedShippingAddressId}
              onSelectAddress={(addressId) =>
                selectSavedAddress(
                  addressId,
                  setSelectedShippingAddressId,
                  setShippingAddress
                )
              }
              isLoadingSavedAddresses={loadingCustomerAddresses}
              isDisabled={isDisabled}
            />
          </Grid.Item>
          <Grid.Item>
            <CartAddressFields
              prefix="billing-address"
              title="Billing address"
              value={billingAddress}
              onChange={setBillingAddress}
              savedAddressOptions={savedAddressOptions}
              selectedAddressId={selectedBillingAddressId}
              onSelectAddress={(addressId) =>
                selectSavedAddress(
                  addressId,
                  setSelectedBillingAddressId,
                  setBillingAddress
                )
              }
              isLoadingSavedAddresses={loadingCustomerAddresses}
              isDisabled={isDisabled}
            />
          </Grid.Item>
        </Grid>
        <Spacings.Inline scale="m">
          <TabularDetailPage.FormSecondaryButton
            label="Use shipping as billing"
            onClick={() => setBillingAddress({ ...shippingAddress })}
            isDisabled={isDisabled || !hasAddressValues(shippingAddress)}
          />
          <TabularDetailPage.FormPrimaryButton
            label={saving ? 'Saving…' : 'Save addresses'}
            onClick={() => void saveAddresses()}
            isDisabled={isDisabled}
          />
        </Spacings.Inline>
        {error ? (
          <ContentNotification type="error">
            <Text.Body>{getErrorMessage(error)}</Text.Body>
          </ContentNotification>
        ) : null}
      </Spacings.Stack>
    </CollapsiblePanel>
  );
};

const AddLineItems = (props: {
  cart: Cart;
  onSaved: () => Promise<unknown>;
}) => {
  const projectKey = useApplicationContext((context) => context.project?.key);
  const locale = useApplicationContext(
    (context) => context.dataLocale ?? context.project?.languages?.[0] ?? 'en'
  );
  const dispatch = useAsyncDispatch();
  const showNotification = useShowNotification();
  const canManage = useIsAuthorized({
    demandedPermissions: [PERMISSIONS.ManageCarts],
  });
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<ProductVariantSearchRow[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<string>();
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<unknown>();
  const isActive = props.cart.cartState === 'Active';

  const productName = (product: ProductProjection) =>
    product.name[locale] ??
    product.name[locale.split('-')[0]] ??
    Object.values(product.name)[0] ??
    product.key ??
    product.id;

  const findPrice = (variant: ProductProjectionVariant) =>
    variant.prices?.find(
      (price) => price.value.currencyCode === props.cart.totalPrice.currencyCode
    )?.value ?? variant.prices?.[0]?.value;

  const searchProducts = async () => {
    const value = search.trim();
    if (!projectKey || !value) return;
    setSearching(true);
    setHasSearched(true);
    setError(undefined);
    try {
      let result: ProductProjectionSearchResponse;

      try {
        const query = new URLSearchParams({
          staged: 'true',
          limit: '40',
          markMatchingVariants: 'true',
        });
        query.set(`text.${locale}`, value);
        result = (await dispatch(
          actions.get({
            mcApiProxyTarget: MC_API_PROXY_TARGETS.COMMERCETOOLS_PLATFORM,
            uri: `/${projectKey}/product-projections/search?${query.toString()}`,
          })
        )) as ProductProjectionSearchResponse;
      } catch (caught) {
        if (!isProductSearchDeactivatedError(caught)) throw caught;

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
        )) as ProductProjectionSearchResponse;
        result = {
          results: fallbackResult.results
            .filter((product) => productProjectionMatches(product, value))
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
          price: findPrice(variant),
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

  const addLineItem = async (row: ProductVariantSearchRow) => {
    const quantity = Number(quantities[row.id]);
    if (
      !projectKey ||
      !canManage ||
      !isActive ||
      !Number.isInteger(quantity) ||
      quantity < 1
    )
      return;
    setAddingId(row.id);
    setError(undefined);
    try {
      await dispatch(
        actions.post({
          mcApiProxyTarget: MC_API_PROXY_TARGETS.COMMERCETOOLS_PLATFORM,
          uri: `/${projectKey}/carts/${props.cart.id}`,
          payload: {
            version: props.cart.version,
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
      );
      await props.onSaved();
      showNotification({
        domain: NOTIFICATION_DOMAINS.SIDE,
        kind: NOTIFICATION_KINDS_SIDE.success,
        text: `${row.name} added to the cart.`,
      });
    } catch (caught) {
      setError(caught);
    } finally {
      setAddingId(undefined);
    }
  };

  return (
    <CollapsiblePanel header="Add line items" isDefaultClosed={false}>
      <Spacings.Stack scale="l">
        {!isActive ? (
          <ContentNotification type="info">
            <Text.Body>
              Line items can only be added to an active cart.
            </Text.Body>
          </ContentNotification>
        ) : null}
        <Spacings.Inline scale="m" alignItems="flex-end">
          <TextField
            name="product-search"
            title="Search products by name"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Enter a product name"
            horizontalConstraint={10}
            isDisabled={!canManage || !isActive || searching}
          />
          <PrimaryButton
            label={searching ? 'Searching…' : 'Search'}
            onClick={() => void searchProducts()}
            isDisabled={!canManage || !isActive || searching || !search.trim()}
          />
        </Spacings.Inline>
        {hasSearched && !searching && rows.length === 0 && !error ? (
          <ContentNotification type="info">
            <Text.Body>No products matched this search.</Text.Body>
          </ContentNotification>
        ) : null}
        {rows.length > 0 ? (
          <DataTable<ProductVariantSearchRow>
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
                    name={`add-quantity-${item.id}`}
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
                    onClick={() => void addLineItem(item)}
                    isDisabled={
                      Boolean(addingId) ||
                      !Number.isInteger(quantity) ||
                      quantity < 1
                    }
                  />
                );
              }
              return String(
                item[column.key as keyof ProductVariantSearchRow] ?? '—'
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

const CartActions = (props: {
  cart: Cart;
  onSaved: () => Promise<unknown>;
  onOrderCreated: (orderId: string) => void;
}) => {
  const projectKey = useApplicationContext((context) => context.project?.key);
  const dispatch = useAsyncDispatch();
  const showNotification = useShowNotification();
  const canManage = useIsAuthorized({
    demandedPermissions: [PERMISSIONS.ManageCarts],
  });
  const [discountCode, setDiscountCode] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (props.cart.lineItems ?? []).map((item) => [
        item.id,
        String(item.quantity),
      ])
    )
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>();

  const updateCart = async (
    updateActions: Array<Record<string, unknown>>,
    successMessage: string
  ) => {
    if (!projectKey || !canManage || updateActions.length === 0) return;
    setSaving(true);
    setError(undefined);
    try {
      await dispatch(
        actions.post({
          mcApiProxyTarget: MC_API_PROXY_TARGETS.COMMERCETOOLS_PLATFORM,
          uri: `/${projectKey}/carts/${props.cart.id}`,
          payload: { version: props.cart.version, actions: updateActions },
        })
      );
      await props.onSaved();
      showNotification({
        domain: NOTIFICATION_DOMAINS.SIDE,
        kind: NOTIFICATION_KINDS_SIDE.success,
        text: successMessage,
      });
    } catch (caught) {
      setError(caught);
    } finally {
      setSaving(false);
    }
  };

  const saveQuantities = () => {
    const updateActions = (props.cart.lineItems ?? []).flatMap((item) => {
      const quantity = Number(quantities[item.id]);
      return Number.isInteger(quantity) &&
        quantity >= 0 &&
        quantity !== item.quantity
        ? [{ action: 'changeLineItemQuantity', lineItemId: item.id, quantity }]
        : [];
    });
    void updateCart(updateActions, 'Cart quantities updated.');
  };

  const placeOrder = async () => {
    if (!projectKey || !canManage || props.cart.cartState !== 'Active') return;
    setSaving(true);
    setError(undefined);
    try {
      const order = (await dispatch(
        actions.post({
          mcApiProxyTarget: MC_API_PROXY_TARGETS.COMMERCETOOLS_PLATFORM,
          uri: `/${projectKey}/orders`,
          payload: { id: props.cart.id, version: props.cart.version },
        })
      )) as { id: string };
      showNotification({
        domain: NOTIFICATION_DOMAINS.SIDE,
        kind: NOTIFICATION_KINDS_SIDE.success,
        text: 'Order placed from cart.',
      });
      props.onOrderCreated(order.id);
    } catch (caught) {
      setError(caught);
    } finally {
      setSaving(false);
    }
  };

  return (
    <CollapsiblePanel header="Cart operations" isDefaultClosed={false}>
      <Spacings.Stack scale="l">
        {!canManage ? (
          <ContentNotification type="warning">
            <Text.Body>
              You can view this cart, but your CSA role cannot update it.
            </Text.Body>
          </ContentNotification>
        ) : null}
        <Spacings.Inline scale="m" alignItems="flex-end">
          <TextField
            name="discount-code"
            title="Discount code"
            value={discountCode}
            onChange={(event) => setDiscountCode(event.target.value)}
            isDisabled={
              !canManage || saving || props.cart.cartState !== 'Active'
            }
            horizontalConstraint={8}
          />
          <PrimaryButton
            label="Apply code"
            onClick={() => {
              void updateCart(
                [{ action: 'addDiscountCode', code: discountCode.trim() }],
                'Discount code applied.'
              );
              setDiscountCode('');
            }}
            isDisabled={!canManage || saving || !discountCode.trim()}
          />
          <PrimaryButton
            label="Place order"
            onClick={() => void placeOrder()}
            isDisabled={
              !canManage ||
              saving ||
              props.cart.cartState !== 'Active' ||
              (props.cart.lineItems?.length ?? 0) === 0
            }
          />
        </Spacings.Inline>
        {(props.cart.discountCodes ?? []).length > 0 ? (
          <DataTable<
            NonNullable<Cart['discountCodes']>[number] & { id: string }
          >
            columns={[
              { key: 'code', label: 'Discount code' },
              { key: 'state', label: 'State' },
              { key: 'remove', label: '' },
            ]}
            rows={(props.cart.discountCodes ?? []).map((item) => ({
              ...item,
              id: item.discountCode.id,
            }))}
            itemRenderer={(item, column) =>
              column.key === 'code' ? (
                item.discountCode.code ?? item.discountCode.id
              ) : column.key === 'remove' ? (
                <TabularDetailPage.FormSecondaryButton
                  label="Remove"
                  onClick={() =>
                    void updateCart(
                      [
                        {
                          action: 'removeDiscountCode',
                          discountCode: {
                            typeId: 'discount-code',
                            id: item.discountCode.id,
                          },
                        },
                      ],
                      'Discount code removed.'
                    )
                  }
                  isDisabled={!canManage || saving}
                />
              ) : (
                item.state
              )
            }
          />
        ) : null}
        {(props.cart.lineItems ?? []).length > 0 ? (
          <Spacings.Stack scale="m">
            <Grid
              gridGap="16px"
              gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))"
            >
              {(props.cart.lineItems ?? []).map((item) => (
                <Grid.Item key={item.id}>
                  <TextField
                    name={`quantity-${item.id}`}
                    title={
                      item.name ??
                      item.nameAllLocales?.[0]?.value ??
                      'Line item'
                    }
                    value={quantities[item.id] ?? String(item.quantity)}
                    onChange={(event) =>
                      setQuantities((current) => ({
                        ...current,
                        [item.id]: event.target.value,
                      }))
                    }
                    isDisabled={
                      !canManage || saving || props.cart.cartState !== 'Active'
                    }
                    horizontalConstraint="scale"
                  />
                </Grid.Item>
              ))}
            </Grid>
            <TabularDetailPage.FormPrimaryButton
              label={saving ? 'Updating…' : 'Update quantities'}
              onClick={saveQuantities}
              isDisabled={
                !canManage || saving || props.cart.cartState !== 'Active'
              }
            />
          </Spacings.Stack>
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

Carts.displayName = 'Carts';
export default Carts;
