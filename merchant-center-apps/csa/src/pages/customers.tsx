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
import SelectField from '@commercetools-uikit/select-field';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import TextField from '@commercetools-uikit/text-field';
import { CUSTOMER_DETAIL_QUERY, CUSTOMERS_QUERY } from '../graphql';
import { PERMISSIONS } from '../constants';
import {
  buildCustomerProfileUpdateActions,
  customerToProfileValues,
  validateCustomerProfile,
  type CustomerProfileValues,
} from '../customer-profile';
import type { Cart, Customer, CustomerGroup, Order, QueryPage } from '../types';
import {
  displayName,
  formatAddress,
  formatDate,
  formatMoney,
  getErrorMessage,
  idInPredicate,
} from '../utils';
import { KeyValueGrid, ListPage, PageState } from '../components/common';
import {
  CustomerAddresses,
  CustomerCustomAttributes,
  CustomerPassword,
  CustomerPayments,
  CustomerPromotions,
  CustomerWishlists,
  PasswordInput,
} from './customer-b2c-tabs';

type CustomersData = { customers: QueryPage<Customer> };
type CustomerSearchResponse = {
  total: number;
  results: Array<{ id: string; relevance: number }>;
};
type CustomerSearchState = {
  query: string;
  ids: string[];
  total: number;
  loading: boolean;
  error?: unknown;
};
type CustomerDetailData = {
  customer: Customer | null;
  customerGroups: QueryPage<CustomerGroup>;
  orders: QueryPage<Order>;
  carts: QueryPage<Cart>;
};

const Customers = () => {
  const match = useRouteMatch();
  const history = useHistory();

  return (
    <Switch>
      <SuspendedRoute exact path={`${match.path}/new`}>
        <CustomerCreate onClose={() => history.push(match.url)} />
      </SuspendedRoute>
      <SuspendedRoute path={`${match.path}/:id`}>
        <CustomerDetail onClose={() => history.push(match.url)} />
      </SuspendedRoute>
      <SuspendedRoute>
        <CustomerList baseUrl={match.url} />
      </SuspendedRoute>
    </Switch>
  );
};

const CustomerList = (props: { baseUrl: string }) => {
  const history = useHistory();
  const { page, perPage } = usePaginationState();
  const projectKey = useApplicationContext((context) => context.project?.key);
  const dispatch = useAsyncDispatch();
  const sorting = useDataTableSortingState({
    key: 'lastModifiedAt',
    order: 'desc',
  });
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState<CustomerSearchState>({
    query: '',
    ids: [],
    total: 0,
    loading: false,
  });
  const searchTerm = search.trim();
  const isSearching = searchTerm.length > 0;

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedSearch(searchTerm),
      300
    );
    return () => window.clearTimeout(timeout);
  }, [searchTerm]);

  useEffect(() => {
    if (!debouncedSearch || !projectKey) {
      setCustomerSearch({
        query: debouncedSearch,
        ids: [],
        total: 0,
        loading: false,
      });
      return;
    }

    let isCurrentRequest = true;
    setCustomerSearch({
      query: debouncedSearch,
      ids: [],
      total: 0,
      loading: true,
    });

    dispatch(
      actions.post({
        mcApiProxyTarget: MC_API_PROXY_TARGETS.COMMERCETOOLS_PLATFORM,
        uri: `/${projectKey}/customers/search`,
        payload: {
          query: {
            prefix: {
              field: 'all',
              value: debouncedSearch,
            },
          },
          limit: perPage.value,
          offset: (page.value - 1) * perPage.value,
        },
      })
    ).then(
      (response) => {
        if (!isCurrentRequest) return;
        const result = response as CustomerSearchResponse;
        setCustomerSearch({
          query: debouncedSearch,
          ids: result.results.map((item) => item.id),
          total: result.total,
          loading: false,
        });
      },
      (error: unknown) => {
        if (!isCurrentRequest) return;
        setCustomerSearch({
          query: debouncedSearch,
          ids: [],
          total: 0,
          loading: false,
          error,
        });
      }
    );

    return () => {
      isCurrentRequest = false;
    };
  }, [debouncedSearch, dispatch, page.value, perPage.value, projectKey]);

  const hasCurrentSearchResult = customerSearch.query === searchTerm;
  const searchResultIds = useMemo(
    () => (hasCurrentSearchResult ? customerSearch.ids : []),
    [customerSearch.ids, hasCurrentSearchResult]
  );
  const where = useMemo(
    () => (isSearching ? idInPredicate(searchResultIds) : undefined),
    [isSearching, searchResultIds]
  );
  const { data, loading, error } = useMcQuery<CustomersData>(CUSTOMERS_QUERY, {
    variables: {
      limit: isSearching ? Math.max(searchResultIds.length, 1) : perPage.value,
      offset: isSearching ? 0 : (page.value - 1) * perPage.value,
      sort: [`${sorting.value.key} ${sorting.value.order}`],
      where,
    },
    context: { target: GRAPHQL_TARGETS.COMMERCETOOLS_PLATFORM },
    fetchPolicy: 'cache-and-network',
    skip:
      isSearching &&
      (!hasCurrentSearchResult ||
        customerSearch.loading ||
        Boolean(customerSearch.error) ||
        searchResultIds.length === 0),
  });
  const rows = useMemo(() => {
    const results: Customer[] = data?.customers.results ?? [];
    if (!isSearching) return results;
    const byId = new Map(results.map((customer) => [customer.id, customer]));
    return searchResultIds
      .map((id) => byId.get(id))
      .filter((customer): customer is Customer => Boolean(customer));
  }, [data?.customers.results, isSearching, searchResultIds]);
  const pageLoading =
    loading ||
    (isSearching && (!hasCurrentSearchResult || customerSearch.loading));
  const pageError = customerSearch.error ?? error;
  const totalItems = isSearching
    ? customerSearch.total
    : data?.customers.total ?? 0;

  return (
    <ListPage
      title="Customers"
      subtitle="Registered B2C customers in the selected commercetools project"
      controls={
        <PrimaryButton
          label="Add customer"
          onClick={() => history.push(`${props.baseUrl}/new`)}
        />
      }
    >
      <Spacings.Stack scale="l">
        <TextField
          name="customer-search"
          title="Search customers"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            page.onChange(1);
          }}
          placeholder="Name, email, customer number, key, or ID"
          horizontalConstraint={10}
        />
        <PageState
          loading={pageLoading}
          error={pageError}
          isEmpty={!pageLoading && !pageError && rows.length === 0}
          emptyTitle="No customers found"
          emptyBody="Try a different search value."
        >
          <DataTable<Customer>
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'email', label: 'Email' },
              { key: 'customerNumber', label: 'Customer number' },
              { key: 'companyName', label: 'Company' },
              { key: 'customerGroup', label: 'Customer group' },
              { key: 'isEmailVerified', label: 'Email verified' },
              { key: 'createdAt', label: 'Created', isSortable: true },
              { key: 'lastModifiedAt', label: 'Modified', isSortable: true },
            ]}
            rows={rows}
            itemRenderer={(item, column) => {
              if (column.key === 'name')
                return displayName(item.firstName, item.lastName);
              if (column.key === 'customerGroup')
                return item.customerGroup?.name ?? '—';
              if (column.key === 'isEmailVerified')
                return item.isEmailVerified ? 'Yes' : 'No';
              if (column.key === 'createdAt' || column.key === 'lastModifiedAt')
                return formatDate(item[column.key]);
              return String(item[column.key as keyof Customer] ?? '—');
            }}
            sortedBy={sorting.value.key}
            sortDirection={sorting.value.order}
            onSortChange={sorting.onChange}
            onRowClick={(row) =>
              history.push(`${props.baseUrl}/${row.id}/summary`)
            }
          />
          <Pagination
            page={page.value}
            onPageChange={page.onChange}
            perPage={perPage.value}
            onPerPageChange={perPage.onChange}
            totalItems={totalItems}
            perPageRange="s"
          />
        </PageState>
      </Spacings.Stack>
    </ListPage>
  );
};

type CustomerDraft = {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  companyName: string;
};

const CustomerCreate = (props: { onClose: () => void }) => {
  const projectKey = useApplicationContext((context) => context.project?.key);
  const history = useHistory();
  const match = useRouteMatch();
  const dispatch = useAsyncDispatch();
  const showNotification = useShowNotification();
  const canManage = useIsAuthorized({
    demandedPermissions: [PERMISSIONS.ManageCustomers],
  });
  const [draft, setDraft] = useState<CustomerDraft>({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    companyName: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>();
  const passwordTooShort =
    draft.password.length > 0 && draft.password.length < 8;
  const passwordMismatch =
    draft.confirmPassword.length > 0 &&
    draft.password !== draft.confirmPassword;
  const emailInvalid =
    draft.email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email);

  const update = (name: keyof CustomerDraft, value: string) =>
    setDraft((current) => ({ ...current, [name]: value }));

  const save = async () => {
    if (
      !projectKey ||
      !canManage ||
      !draft.email ||
      !draft.password ||
      passwordTooShort ||
      passwordMismatch ||
      emailInvalid
    )
      return;
    setSaving(true);
    setError(undefined);
    try {
      const created = (await dispatch(
        actions.post({
          mcApiProxyTarget: MC_API_PROXY_TARGETS.COMMERCETOOLS_PLATFORM,
          uri: `/${projectKey}/customers`,
          payload: {
            email: draft.email.trim(),
            password: draft.password,
            firstName: draft.firstName.trim() || undefined,
            lastName: draft.lastName.trim() || undefined,
            companyName: draft.companyName.trim() || undefined,
          },
        })
      )) as Customer;
      showNotification({
        domain: NOTIFICATION_DOMAINS.SIDE,
        kind: NOTIFICATION_KINDS_SIDE.success,
        text: 'B2C customer created.',
      });
      history.replace(
        `${match.url.replace(/\/new$/, '')}/${created.id}/summary`
      );
    } catch (caught) {
      setError(caught);
    } finally {
      setSaving(false);
    }
  };

  return (
    <TabularDetailPage
      title="Add B2C customer"
      subtitle="Create a customer account in the selected commercetools project"
      previousPathLabel="Go to View Customers"
      onPreviousPathClick={props.onClose}
      tabControls={<TabHeader to={match.url} label="Customer" />}
      hideControls
    >
      <Spacings.Stack scale="l">
        {!canManage ? (
          <ContentNotification type="warning">
            <Text.Body>
              Manage-customer permission is required to create a customer.
            </Text.Body>
          </ContentNotification>
        ) : null}
        <Grid gridGap="24px" gridTemplateColumns="repeat(2, minmax(0, 1fr))">
          <Grid.Item>
            <TextField
              name="firstName"
              title="First name"
              value={draft.firstName}
              onChange={(event) => update('firstName', event.target.value)}
              isDisabled={!canManage || saving}
              horizontalConstraint="scale"
            />
          </Grid.Item>
          <Grid.Item>
            <TextField
              name="lastName"
              title="Last name"
              value={draft.lastName}
              onChange={(event) => update('lastName', event.target.value)}
              isDisabled={!canManage || saving}
              horizontalConstraint="scale"
            />
          </Grid.Item>
          <Grid.Item>
            <TextField
              name="email"
              title="Email"
              value={draft.email}
              onChange={(event) => update('email', event.target.value)}
              isRequired
              isDisabled={!canManage || saving}
              errors={{ invalidEmail: emailInvalid }}
              touched={draft.email.length > 0}
              renderError={(key) =>
                key === 'invalidEmail' ? 'Enter a valid email address.' : null
              }
              horizontalConstraint="scale"
            />
          </Grid.Item>
          <Grid.Item>
            <TextField
              name="companyName"
              title="Company name"
              value={draft.companyName}
              onChange={(event) => update('companyName', event.target.value)}
              isDisabled={!canManage || saving}
              horizontalConstraint="scale"
            />
          </Grid.Item>
          <Grid.Item>
            <PasswordInput
              name="password"
              title="Password"
              value={draft.password}
              onChange={(value) => update('password', value)}
              isDisabled={!canManage || saving}
              error={
                passwordTooShort ? 'Use at least 8 characters.' : undefined
              }
            />
          </Grid.Item>
          <Grid.Item>
            <PasswordInput
              name="confirmPassword"
              title="Confirm password"
              value={draft.confirmPassword}
              onChange={(value) => update('confirmPassword', value)}
              isDisabled={!canManage || saving}
              error={passwordMismatch ? 'Passwords must match.' : undefined}
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
            label={saving ? 'Creating…' : 'Create customer'}
            onClick={() => void save()}
            isDisabled={
              !canManage ||
              saving ||
              !draft.email ||
              !draft.password ||
              !draft.confirmPassword ||
              passwordTooShort ||
              passwordMismatch ||
              emailInvalid
            }
          />
        </Spacings.Inline>
      </Spacings.Stack>
    </TabularDetailPage>
  );
};

const CustomerDetail = (props: { onClose: () => void }) => {
  const { id } = useParams<{ id: string }>();
  const match = useRouteMatch();
  const history = useHistory();
  const customerWhere = `customerId="${id
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')}"`;
  const { data, loading, error, refetch } = useMcQuery<CustomerDetailData>(
    CUSTOMER_DETAIL_QUERY,
    {
      variables: { id, customerWhere },
      context: { target: GRAPHQL_TARGETS.COMMERCETOOLS_PLATFORM },
    }
  );
  const customer = data?.customer;
  const base = match.url;
  const applicationBase = base.replace(/\/customers\/[^/]+$/, '');
  const customerName = customer
    ? displayName(customer.firstName, customer.lastName)
    : 'Customer';

  return (
    <TabularDetailPage
      customTitleRow={
        <CustomerIdentityHeader
          name={customerName}
          email={customer?.email ?? id}
          firstName={customer?.firstName}
          lastName={customer?.lastName}
        />
      }
      previousPathLabel="Go to View Customers"
      onPreviousPathClick={props.onClose}
      tabControls={
        <>
          <TabHeader to={`${base}/summary`} label="Summary" />
          <TabHeader to={`${base}/profile`} label="Profile" />
          <TabHeader to={`${base}/carts`} label="Carts" />
          <TabHeader to={`${base}/orders`} label="Orders" />
          <TabHeader to={`${base}/returns`} label="Returns" />
          <TabHeader to={`${base}/payments`} label="Payments" />
          <TabHeader to={`${base}/addresses`} label="Addresses" />
          <TabHeader to={`${base}/tickets`} label="Tickets" />
          <TabHeader to={`${base}/password`} label="Password" />
          <TabHeader to={`${base}/wishlists`} label="Wishlists" />
          <TabHeader to={`${base}/promotions`} label="Promotions" />
          <TabHeader
            to={`${base}/custom-attributes`}
            label="Custom Attributes"
          />
        </>
      }
      hideControls
    >
      <PageState
        loading={loading}
        error={error}
        isEmpty={customer === null}
        emptyTitle="Customer not found"
      >
        {customer ? (
          <Switch>
            <Route exact path={base}>
              <Redirect to={`${base}/summary`} />
            </Route>
            <SuspendedRoute path={`${base}/summary`}>
              <CustomerSummary
                customer={customer}
                orders={data?.orders}
                carts={data?.carts}
              />
            </SuspendedRoute>
            <SuspendedRoute path={`${base}/profile`}>
              <CustomerProfile
                customer={customer}
                customerGroups={data?.customerGroups.results ?? []}
                onSaved={() => refetch()}
              />
            </SuspendedRoute>
            <SuspendedRoute path={`${base}/carts`}>
              <CustomerCarts
                customer={customer}
                rows={data?.carts.results ?? []}
                onRowClick={(cartId) =>
                  history.push(`${applicationBase}/carts/${cartId}/general`)
                }
                onCreated={async (cartId) => {
                  await refetch();
                  history.push(`${applicationBase}/carts/${cartId}/general`);
                }}
              />
            </SuspendedRoute>
            <SuspendedRoute path={`${base}/orders`}>
              <OrderTable
                rows={data?.orders.results ?? []}
                onRowClick={(orderId) =>
                  history.push(`${applicationBase}/orders/${orderId}/general`)
                }
              />
            </SuspendedRoute>
            <SuspendedRoute path={`${base}/returns`}>
              <CustomerReturns rows={data?.orders.results ?? []} />
            </SuspendedRoute>
            <SuspendedRoute path={`${base}/payments`}>
              <CustomerPayments
                customerId={customer.id}
                baseUrl={`${base}/payments`}
              />
            </SuspendedRoute>
            <SuspendedRoute path={`${base}/addresses`}>
              <CustomerAddresses
                customer={customer}
                onSaved={() => refetch()}
              />
            </SuspendedRoute>
            <SuspendedRoute path={`${base}/tickets`}>
              <CustomerTickets />
            </SuspendedRoute>
            <SuspendedRoute path={`${base}/password`}>
              <CustomerPassword customer={customer} />
            </SuspendedRoute>
            <SuspendedRoute path={`${base}/wishlists`}>
              <CustomerWishlists customerId={customer.id} />
            </SuspendedRoute>
            <SuspendedRoute path={`${base}/promotions`}>
              <CustomerPromotions customer={customer} onSaved={refetch} />
            </SuspendedRoute>
            <SuspendedRoute path={`${base}/custom-attributes`}>
              <CustomerCustomAttributes customer={customer} onSaved={refetch} />
            </SuspendedRoute>
            <Redirect to={`${base}/summary`} />
          </Switch>
        ) : null}
      </PageState>
    </TabularDetailPage>
  );
};

const CustomerIdentityHeader = (props: {
  name: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}) => {
  const initials =
    [props.firstName, props.lastName]
      .filter(Boolean)
      .map((part) => part?.trim().charAt(0))
      .join('')
      .toUpperCase() || props.email.charAt(0).toUpperCase();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        minHeight: '120px',
        width: '100%',
      }}
    >
      <div
        aria-label={`${props.name} initials`}
        style={{
          alignItems: 'center',
          backgroundColor: 'var(--color-info-90)',
          borderRadius: '50%',
          color: 'var(--color-info-40)',
          display: 'flex',
          flex: '0 0 104px',
          fontSize: 'var(--font-size-80)',
          fontWeight: 600,
          height: '104px',
          justifyContent: 'center',
          width: '104px',
        }}
      >
        {initials}
      </div>
      <Spacings.Stack scale="xs">
        <Text.Headline as="h1">{props.name} 360° view</Text.Headline>
        <Text.Subheadline as="h4">{props.email}</Text.Subheadline>
      </Spacings.Stack>
    </div>
  );
};

const CustomerMetric = (props: {
  label: string;
  value: string;
  hint: string;
}) => (
  <Grid.Item>
    <CollapsiblePanel header={props.label} isDefaultClosed={false}>
      <Spacings.Stack scale="xs">
        <Text.Headline as="h2">{props.value}</Text.Headline>
        <Text.Detail tone="secondary">{props.hint}</Text.Detail>
      </Spacings.Stack>
    </CollapsiblePanel>
  </Grid.Item>
);

const CustomerSummary = (props: {
  customer: Customer;
  orders?: QueryPage<Order>;
  carts?: QueryPage<Cart>;
}) => (
  <Spacings.Stack scale="xl">
    <Grid
      gridGap="16px"
      gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))"
    >
      <CustomerMetric
        label="Orders"
        value={String(props.orders?.total ?? 0)}
        hint="Orders linked to this customer"
      />
      <CustomerMetric
        label="Carts"
        value={String(props.carts?.total ?? 0)}
        hint="Active and historical carts"
      />
      <CustomerMetric
        label="Addresses"
        value={String(props.customer.addresses?.length ?? 0)}
        hint="Saved customer addresses"
      />
      <CustomerMetric
        label="Email status"
        value={props.customer.isEmailVerified ? 'Verified' : 'Unverified'}
        hint={props.customer.email}
      />
    </Grid>
    <CollapsiblePanel header="Customer summary" isDefaultClosed={false}>
      <KeyValueGrid
        items={[
          {
            label: 'Name',
            value: displayName(
              props.customer.firstName,
              props.customer.lastName
            ),
          },
          { label: 'Email', value: props.customer.email },
          {
            label: 'Customer number',
            value: props.customer.customerNumber ?? '—',
          },
          {
            label: 'Customer group',
            value: props.customer.customerGroup?.name ?? '—',
          },
          { label: 'Company', value: props.customer.companyName ?? '—' },
          { label: 'Created', value: formatDate(props.customer.createdAt) },
          {
            label: 'Last modified',
            value: formatDate(props.customer.lastModifiedAt),
          },
        ]}
      />
    </CollapsiblePanel>
  </Spacings.Stack>
);

const CustomerProfile = (props: {
  customer: Customer;
  customerGroups: CustomerGroup[];
  onSaved: () => Promise<unknown>;
}) => {
  const dispatch = useAsyncDispatch();
  const showNotification = useShowNotification();
  const canManage = useIsAuthorized({
    demandedPermissions: [PERMISSIONS.ManageCustomers],
  });
  const project = useApplicationContext((context) => context.project);
  const [values, setValues] = useState<CustomerProfileValues>(() =>
    customerToProfileValues(props.customer)
  );
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<unknown>();

  useEffect(() => {
    setValues(customerToProfileValues(props.customer));
    setAttemptedSubmit(false);
    setSaveError(undefined);
  }, [props.customer]);

  const updateValue = (name: keyof CustomerProfileValues, value: string) =>
    setValues((current) => ({ ...current, [name]: value }));
  const actionsToSave = useMemo(
    () => buildCustomerProfileUpdateActions(props.customer, values),
    [props.customer, values]
  );
  const validation = validateCustomerProfile(values);
  const hasValidationErrors = Object.values(validation).some(Boolean);
  const languageOptions = useMemo(() => {
    const languages = new Set(project?.languages ?? []);
    if (values.locale) languages.add(values.locale);
    return [...languages].sort().map((language) => ({
      value: language,
      label: language,
    }));
  }, [project?.languages, values.locale]);
  const customerGroupOptions = props.customerGroups.map((group) => ({
    value: group.id,
    label: group.name ?? group.key ?? group.id,
  }));
  const addresses = props.customer.addresses ?? [];
  const defaultShippingAddress = addresses.find(
    (address) => address.id === props.customer.defaultShippingAddressId
  );
  const defaultBillingAddress = addresses.find(
    (address) => address.id === props.customer.defaultBillingAddressId
  );
  const primaryPhone =
    defaultShippingAddress?.phone ??
    defaultBillingAddress?.phone ??
    addresses.find((address) => address.phone)?.phone ??
    '';

  const reset = () => {
    setValues(customerToProfileValues(props.customer));
    setAttemptedSubmit(false);
    setSaveError(undefined);
  };

  const save = async () => {
    setAttemptedSubmit(true);
    setSaveError(undefined);
    if (
      !canManage ||
      !project?.key ||
      hasValidationErrors ||
      actionsToSave.length === 0
    )
      return;

    setSaving(true);
    try {
      await dispatch(
        actions.post({
          mcApiProxyTarget: MC_API_PROXY_TARGETS.COMMERCETOOLS_PLATFORM,
          uri: `/${project.key}/customers/${encodeURIComponent(
            props.customer.id
          )}`,
          payload: {
            version: props.customer.version,
            actions: actionsToSave,
          },
        })
      );
      await props.onSaved();
      showNotification({
        domain: NOTIFICATION_DOMAINS.SIDE,
        kind: NOTIFICATION_KINDS_SIDE.success,
        text: 'Customer profile updated.',
      });
    } catch (error) {
      setSaveError(error);
    } finally {
      setSaving(false);
    }
  };

  const fieldsDisabled = !canManage || saving;

  return (
    <Spacings.Stack scale="l">
      {!canManage ? (
        <ContentNotification type="warning">
          <Text.Body>
            You can view this profile, but your CSA permissions do not allow
            customer updates.
          </Text.Body>
        </ContentNotification>
      ) : null}
      <CollapsiblePanel header="Profile information" isDefaultClosed={false}>
        <Grid gridGap="24px" gridTemplateColumns="repeat(2, minmax(0, 1fr))">
          <Grid.Item>
            <TextField
              name="title"
              title="Title"
              value={values.title}
              onChange={(event) => updateValue('title', event.target.value)}
              isDisabled={fieldsDisabled}
              horizontalConstraint="scale"
            />
          </Grid.Item>
          <Grid.Item>
            <TextField
              name="salutation"
              title="Salutation"
              value={values.salutation}
              onChange={(event) =>
                updateValue('salutation', event.target.value)
              }
              isDisabled={fieldsDisabled}
              horizontalConstraint="scale"
            />
          </Grid.Item>
          <Grid.Item>
            <TextField
              name="firstName"
              title="First name"
              value={values.firstName}
              onChange={(event) => updateValue('firstName', event.target.value)}
              isDisabled={fieldsDisabled}
              horizontalConstraint="scale"
            />
          </Grid.Item>
          <Grid.Item>
            <TextField
              name="middleName"
              title="Middle name"
              value={values.middleName}
              onChange={(event) =>
                updateValue('middleName', event.target.value)
              }
              isDisabled={fieldsDisabled}
              horizontalConstraint="scale"
            />
          </Grid.Item>
          <Grid.Item>
            <TextField
              name="lastName"
              title="Last name"
              value={values.lastName}
              onChange={(event) => updateValue('lastName', event.target.value)}
              isDisabled={fieldsDisabled}
              horizontalConstraint="scale"
            />
          </Grid.Item>
          <Grid.Item>
            <TextField
              name="dateOfBirth"
              title="Date of birth"
              value={values.dateOfBirth}
              placeholder="YYYY-MM-DD"
              onChange={(event) =>
                updateValue('dateOfBirth', event.target.value)
              }
              isDisabled={fieldsDisabled}
              touched={attemptedSubmit}
              errors={{ invalidDate: validation.dateInvalid }}
              renderError={(key) =>
                key === 'invalidDate'
                  ? 'Use a valid date in YYYY-MM-DD format.'
                  : null
              }
              horizontalConstraint="scale"
            />
          </Grid.Item>
          <Grid.Item>
            <TextField
              name="email"
              title="Email"
              hint="Changing the email marks it as unverified."
              value={values.email}
              onChange={(event) => updateValue('email', event.target.value)}
              isRequired
              isDisabled={fieldsDisabled}
              touched={attemptedSubmit}
              errors={{
                missing: validation.emailMissing,
                invalidEmail: validation.emailInvalid,
              }}
              renderError={(key) =>
                key === 'invalidEmail' ? 'Enter a valid email address.' : null
              }
              horizontalConstraint="scale"
            />
          </Grid.Item>
          <Grid.Item>
            <TextField
              name="phone"
              title="Phone number"
              value={primaryPhone}
              isReadOnly
              hint="Phone numbers are managed on customer addresses."
              horizontalConstraint="scale"
            />
          </Grid.Item>
          <Grid.Item>
            <TextField
              name="companyName"
              title="Company name"
              value={values.companyName}
              onChange={(event) =>
                updateValue('companyName', event.target.value)
              }
              isDisabled={fieldsDisabled}
              horizontalConstraint="scale"
            />
          </Grid.Item>
          <Grid.Item>
            <TextField
              name="vatId"
              title="VAT ID"
              value={values.vatId}
              onChange={(event) => updateValue('vatId', event.target.value)}
              isDisabled={fieldsDisabled}
              horizontalConstraint="scale"
            />
          </Grid.Item>
          <Grid.Item>
            <SelectField
              name="locale"
              title="Preferred language"
              value={values.locale || null}
              options={languageOptions}
              onChange={(event) =>
                updateValue('locale', String(event.target.value ?? ''))
              }
              isClearable
              isDisabled={fieldsDisabled}
              horizontalConstraint="scale"
            />
          </Grid.Item>
          <Grid.Item>
            <SelectField
              name="customerGroupId"
              title="Customer group"
              value={values.customerGroupId || null}
              options={customerGroupOptions}
              onChange={(event) =>
                updateValue('customerGroupId', String(event.target.value ?? ''))
              }
              isClearable
              isDisabled={fieldsDisabled}
              horizontalConstraint="scale"
            />
          </Grid.Item>
          <Grid.Item>
            <TextField
              name="customerNumber"
              title="Customer number"
              value={props.customer.customerNumber ?? ''}
              isReadOnly
              hint="Customer numbers cannot be changed after they are assigned."
              horizontalConstraint="scale"
            />
          </Grid.Item>
          <Grid.Item>
            <TextField
              name="key"
              title="Customer key"
              value={props.customer.key ?? ''}
              isReadOnly
              horizontalConstraint="scale"
            />
          </Grid.Item>
        </Grid>
      </CollapsiblePanel>
      {saveError ? (
        <ContentNotification type="error">
          <Text.Body>{getErrorMessage(saveError)}</Text.Body>
        </ContentNotification>
      ) : null}
      <Spacings.Inline scale="m">
        <TabularDetailPage.FormSecondaryButton
          label="Cancel"
          onClick={() => reset()}
          isDisabled={saving || actionsToSave.length === 0}
        />
        <TabularDetailPage.FormPrimaryButton
          label={saving ? 'Saving…' : 'Submit'}
          onClick={() => void save()}
          isDisabled={
            !canManage ||
            saving ||
            actionsToSave.length === 0 ||
            (attemptedSubmit && hasValidationErrors)
          }
        />
      </Spacings.Inline>
      <CollapsiblePanel
        header="Customer identifiers and status"
        isDefaultClosed={false}
      >
        <KeyValueGrid
          items={[
            { label: 'Customer ID', value: props.customer.id },
            { label: 'Customer key', value: props.customer.key ?? '—' },
            {
              label: 'Customer number',
              value: props.customer.customerNumber ?? '—',
            },
            {
              label: 'Email status',
              value: props.customer.isEmailVerified ? 'Verified' : 'Unverified',
            },
            {
              label: 'Authentication mode',
              value: props.customer.authenticationMode ?? 'Password',
            },
            {
              label: 'Stores',
              value:
                props.customer.stores?.map((store) => store.key).join(', ') ||
                'All project stores',
            },
            {
              label: 'Default shipping',
              value: defaultShippingAddress
                ? formatAddress(defaultShippingAddress)
                : '—',
            },
            {
              label: 'Default billing',
              value: defaultBillingAddress
                ? formatAddress(defaultBillingAddress)
                : '—',
            },
            { label: 'Created', value: formatDate(props.customer.createdAt) },
            {
              label: 'Last modified',
              value: formatDate(props.customer.lastModifiedAt),
            },
            { label: 'Resource version', value: props.customer.version },
          ]}
        />
      </CollapsiblePanel>
      <CollapsiblePanel header="Saved addresses" isDefaultClosed={false}>
        <CustomerAddresses customer={props.customer} onSaved={props.onSaved} />
      </CollapsiblePanel>
    </Spacings.Stack>
  );
};

type CustomerReturnRow = {
  id: string;
  order: string;
  tracking: string;
  quantity: number;
  returnDate?: string | null;
  shipmentState: string;
  paymentState: string;
};

const CustomerReturns = ({ rows }: { rows: Order[] }) => {
  const returns: CustomerReturnRow[] = rows.flatMap((order) =>
    (order.returnInfo ?? []).flatMap((returnInfo, returnIndex) =>
      returnInfo.items.map((item) => ({
        id: `${order.id}-${returnIndex}-${item.id}`,
        order: order.orderNumber ?? order.id,
        tracking: returnInfo.returnTrackingId ?? '—',
        quantity: item.quantity,
        returnDate: returnInfo.returnDate,
        shipmentState: item.shipmentState,
        paymentState: item.paymentState,
      }))
    )
  );

  return (
    <PageState
      isEmpty={returns.length === 0}
      emptyTitle="No returns for this customer"
    >
      <DataTable<CustomerReturnRow>
        columns={[
          { key: 'order', label: 'Order' },
          { key: 'tracking', label: 'Return tracking' },
          { key: 'quantity', label: 'Quantity' },
          { key: 'shipmentState', label: 'Shipment state' },
          { key: 'paymentState', label: 'Payment state' },
          { key: 'returnDate', label: 'Return date' },
        ]}
        rows={returns}
        itemRenderer={(item, column) =>
          column.key === 'returnDate'
            ? formatDate(item.returnDate)
            : String(item[column.key as keyof CustomerReturnRow] ?? '—')
        }
      />
    </PageState>
  );
};

const CustomerTickets = () => (
  <ContentNotification type="info">
    <Text.Body>
      Ticket data is unavailable until the standalone CSA ticket adapter is
      configured. No ticket data is inferred from commercetools customers.
    </Text.Body>
  </ContentNotification>
);

const OrderTable = ({
  rows,
  onRowClick,
}: {
  rows: Order[];
  onRowClick: (id: string) => void;
}) => (
  <PageState
    isEmpty={rows.length === 0}
    emptyTitle="No orders for this customer"
  >
    <DataTable
      columns={[
        { key: 'orderNumber', label: 'Order' },
        { key: 'orderState', label: 'State' },
        { key: 'totalPrice', label: 'Total' },
        { key: 'createdAt', label: 'Created' },
      ]}
      rows={rows}
      itemRenderer={(item, column) =>
        column.key === 'orderNumber'
          ? item.orderNumber ?? item.id
          : column.key === 'totalPrice'
          ? formatMoney(item.totalPrice)
          : column.key === 'createdAt'
          ? formatDate(item.createdAt)
          : String(item.orderState)
      }
      onRowClick={(row) => onRowClick(row.id)}
    />
  </PageState>
);

const CartTable = ({
  rows,
  onRowClick,
}: {
  rows: Cart[];
  onRowClick: (id: string) => void;
}) => (
  <PageState
    isEmpty={rows.length === 0}
    emptyTitle="No carts for this customer"
  >
    <DataTable
      columns={[
        { key: 'key', label: 'Cart' },
        { key: 'cartState', label: 'State' },
        { key: 'totalLineItemQuantity', label: 'Items' },
        { key: 'totalPrice', label: 'Total' },
        { key: 'lastModifiedAt', label: 'Modified' },
      ]}
      rows={rows}
      itemRenderer={(item, column) =>
        column.key === 'key'
          ? item.key ?? item.id
          : column.key === 'totalPrice'
          ? formatMoney(item.totalPrice)
          : column.key === 'lastModifiedAt'
          ? formatDate(item.lastModifiedAt)
          : String(
              item[column.key as 'cartState' | 'totalLineItemQuantity'] ?? '—'
            )
      }
      onRowClick={(row) => onRowClick(row.id)}
    />
  </PageState>
);

const CustomerCarts = (props: {
  customer: Customer;
  rows: Cart[];
  onRowClick: (id: string) => void;
  onCreated: (id: string) => Promise<unknown>;
}) => {
  const project = useApplicationContext((context) => context.project);
  const dispatch = useAsyncDispatch();
  const showNotification = useShowNotification();
  const canManage = useIsAuthorized({
    demandedPermissions: [PERMISSIONS.ManageCarts],
  });
  const availableCurrencies = useMemo(() => {
    const currencies = new Set(project?.currencies ?? []);
    props.rows.forEach((cart) => currencies.add(cart.totalPrice.currencyCode));
    if (currencies.size === 0) currencies.add('USD');
    return [...currencies].sort();
  }, [project?.currencies, props.rows]);
  const suggestedCurrency =
    props.rows.find((cart) => cart.cartState === 'Active')?.totalPrice
      .currencyCode ??
    props.rows[0]?.totalPrice.currencyCode ??
    availableCurrencies[0];
  const [currency, setCurrency] = useState(suggestedCurrency);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<unknown>();

  useEffect(() => {
    if (!availableCurrencies.includes(currency)) setCurrency(suggestedCurrency);
  }, [availableCurrencies, currency, suggestedCurrency]);

  const addresses = props.customer.addresses ?? [];
  const preferredCountry =
    addresses.find(
      (address) => address.id === props.customer.defaultShippingAddressId
    )?.country ??
    addresses.find(
      (address) => address.id === props.customer.defaultBillingAddressId
    )?.country ??
    addresses.find((address) => address.country)?.country;
  const country =
    preferredCountry &&
    (!project?.countries?.length ||
      project.countries.includes(preferredCountry))
      ? preferredCountry
      : undefined;

  const createCart = async () => {
    if (!canManage || !project?.key || !currency) return;
    setCreating(true);
    setCreateError(undefined);
    try {
      const cart = (await dispatch(
        actions.post({
          mcApiProxyTarget: MC_API_PROXY_TARGETS.COMMERCETOOLS_PLATFORM,
          uri: `/${project.key}/carts`,
          payload: {
            currency,
            country,
            customerId: props.customer.id,
            customerEmail: props.customer.email,
          },
        })
      )) as Pick<Cart, 'id'>;
      showNotification({
        domain: NOTIFICATION_DOMAINS.SIDE,
        kind: NOTIFICATION_KINDS_SIDE.success,
        text: 'Customer cart created.',
      });
      await props.onCreated(cart.id);
    } catch (error) {
      setCreateError(error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Spacings.Stack scale="l">
      {!canManage ? (
        <ContentNotification type="warning">
          <Text.Body>
            You can view carts, but your CSA permissions do not allow cart
            creation.
          </Text.Body>
        </ContentNotification>
      ) : null}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Spacings.Inline alignItems="flex-end">
          <SelectField
            name="new-cart-currency"
            title="Currency"
            value={currency}
            options={availableCurrencies.map((value) => ({
              value,
              label: value,
            }))}
            onChange={(event) => setCurrency(String(event.target.value))}
            isDisabled={!canManage || creating}
            horizontalConstraint={4}
          />
          <PrimaryButton
            label={creating ? 'Creating…' : 'Create cart'}
            onClick={() => void createCart()}
            isDisabled={!canManage || creating || !project?.key || !currency}
          />
        </Spacings.Inline>
      </div>
      {createError ? (
        <ContentNotification type="error">
          <Text.Body>{getErrorMessage(createError)}</Text.Body>
        </ContentNotification>
      ) : null}
      <CartTable rows={props.rows} onRowClick={props.onRowClick} />
    </Spacings.Stack>
  );
};

Customers.displayName = 'Customers';
export default Customers;
