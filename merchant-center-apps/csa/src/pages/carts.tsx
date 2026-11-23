import { useMemo, useState } from 'react';
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
import {
  TabHeader,
  TabularDetailPage,
} from '@commercetools-frontend/application-components';
import { GRAPHQL_TARGETS } from '@commercetools-frontend/constants';
import CollapsiblePanel from '@commercetools-uikit/collapsible-panel';
import DataTable from '@commercetools-uikit/data-table';
import Grid from '@commercetools-uikit/grid';
import {
  useDataTableSortingState,
  usePaginationState,
} from '@commercetools-uikit/hooks';
import { Pagination } from '@commercetools-uikit/pagination';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import TextField from '@commercetools-uikit/text-field';
import { CART_DETAIL_QUERY, CARTS_QUERY } from '../graphql';
import type { Cart, QueryPage } from '../types';
import {
  exactSearchPredicate,
  formatAddress,
  formatDate,
  formatMoney,
} from '../utils';
import {
  CustomFieldsTable,
  KeyValueGrid,
  ListPage,
  PageState,
} from '../components/common';

type CartsData = { carts: QueryPage<Cart> };
type CartDetailData = { cart: Cart | null };

const Carts = () => {
  const match = useRouteMatch();
  const history = useHistory();

  return (
    <Switch>
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
    <ListPage title="Carts" subtitle="Active and historical B2C shopping carts">
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

const CartDetail = (props: { onClose: () => void }) => {
  const { id } = useParams<{ id: string }>();
  const match = useRouteMatch();
  const { data, loading, error } = useMcQuery<CartDetailData>(
    CART_DETAIL_QUERY,
    {
      variables: { id },
      context: { target: GRAPHQL_TARGETS.COMMERCETOOLS_PLATFORM },
    }
  );
  const cart = data?.cart;
  const base = match.url.replace(/\/general$/, '');
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
              <CartGeneral cart={cart} />
            </SuspendedRoute>
            <Redirect to={`${base}/general`} />
          </Switch>
        ) : null}
      </PageState>
    </TabularDetailPage>
  );
};

const CartGeneral = ({ cart }: { cart: Cart }) => (
  <Spacings.Stack scale="xl">
    <CollapsiblePanel header="Cart summary" isDefaultClosed={false}>
      <Grid gridGap="24px" gridTemplateColumns="repeat(2, minmax(0, 1fr))">
        <Grid.Item>
          <KeyValueGrid
            items={[
              { label: 'Cart', value: cart.key ?? cart.id },
              { label: 'Cart status', value: cart.cartState },
              {
                label: 'Customer',
                value: cart.customerEmail ?? cart.customerId ?? '—',
              },
              {
                label: 'Items',
                value: String(cart.totalLineItemQuantity ?? 0),
              },
            ]}
          />
        </Grid.Item>
        <Grid.Item>
          <KeyValueGrid
            items={[
              { label: 'Total', value: formatMoney(cart.totalPrice) },
              { label: 'Created', value: formatDate(cart.createdAt) },
              { label: 'Modified', value: formatDate(cart.lastModifiedAt) },
            ]}
          />
        </Grid.Item>
      </Grid>
    </CollapsiblePanel>
    <CollapsiblePanel header="Cart items" isDefaultClosed={false}>
      <PageState
        isEmpty={(cart.lineItems ?? []).length === 0}
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
          rows={cart.lineItems ?? []}
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
    <CollapsiblePanel header="Addresses" isDefaultClosed={false}>
      <Grid gridGap="24px" gridTemplateColumns="repeat(2, minmax(0, 1fr))">
        <Grid.Item>
          <Text.Subheadline as="h4">Shipping address</Text.Subheadline>
          <Text.Body>
            <span style={{ whiteSpace: 'pre-line' }}>
              {formatAddress(cart.shippingAddress)}
            </span>
          </Text.Body>
        </Grid.Item>
        <Grid.Item>
          <Text.Subheadline as="h4">Billing address</Text.Subheadline>
          <Text.Body>
            <span style={{ whiteSpace: 'pre-line' }}>
              {formatAddress(cart.billingAddress)}
            </span>
          </Text.Body>
        </Grid.Item>
      </Grid>
    </CollapsiblePanel>
    <CollapsiblePanel header="Custom attributes" isDefaultClosed>
      <CustomFieldsTable fields={cart.custom?.customFieldsRaw} />
    </CollapsiblePanel>
  </Spacings.Stack>
);

Carts.displayName = 'Carts';
export default Carts;
