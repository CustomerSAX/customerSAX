import { useMemo, useState } from 'react';
import { Switch, useHistory, useParams, useRouteMatch } from 'react-router-dom';
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
import { ContentNotification } from '@commercetools-uikit/notifications';
import { Pagination } from '@commercetools-uikit/pagination';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import TextField from '@commercetools-uikit/text-field';
import { ORDER_DETAIL_QUERY, ORDERS_QUERY } from '../graphql';
import type { Order, QueryPage } from '../types';
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

type OrdersData = { orders: QueryPage<Order> };
type OrderDetailData = { order: Order | null };

const Orders = () => {
  const match = useRouteMatch();
  const history = useHistory();

  return (
    <Switch>
      <SuspendedRoute path={`${match.path}/:id`}>
        <OrderDetail onClose={() => history.push(match.url)} />
      </SuspendedRoute>
      <SuspendedRoute>
        <OrderList baseUrl={match.url} />
      </SuspendedRoute>
    </Switch>
  );
};

const OrderList = (props: { baseUrl: string }) => {
  const history = useHistory();
  const { page, perPage } = usePaginationState();
  const sorting = useDataTableSortingState({ key: 'createdAt', order: 'desc' });
  const [search, setSearch] = useState('');
  const where = useMemo(
    () => exactSearchPredicate(search, ['orderNumber', 'customerEmail', 'id']),
    [search]
  );
  const { data, loading, error } = useMcQuery<OrdersData>(ORDERS_QUERY, {
    variables: {
      limit: perPage.value,
      offset: (page.value - 1) * perPage.value,
      sort: [`${sorting.value.key} ${sorting.value.order}`],
      where,
    },
    context: { target: GRAPHQL_TARGETS.COMMERCETOOLS_PLATFORM },
    fetchPolicy: 'cache-and-network',
  });
  const rows = data?.orders.results ?? [];

  return (
    <ListPage
      title="Orders"
      subtitle="Customer orders, payment state, shipment state, and totals"
    >
      <Spacings.Stack scale="l">
        <TextField
          name="order-search"
          title="Exact order search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Order number, customer email, or ID"
          horizontalConstraint={10}
        />
        <PageState
          loading={loading}
          error={error}
          isEmpty={!loading && rows.length === 0}
          emptyTitle="No orders found"
        >
          <DataTable<Order>
            columns={[
              { key: 'orderNumber', label: 'Order' },
              { key: 'customerEmail', label: 'Customer' },
              { key: 'orderState', label: 'Order state' },
              { key: 'paymentState', label: 'Payment' },
              { key: 'shipmentState', label: 'Shipment' },
              { key: 'totalPrice', label: 'Total' },
              { key: 'createdAt', label: 'Created', isSortable: true },
              { key: 'lastModifiedAt', label: 'Modified', isSortable: true },
            ]}
            rows={rows}
            itemRenderer={(item, column) => {
              if (column.key === 'orderNumber')
                return item.orderNumber ?? item.id;
              if (column.key === 'totalPrice')
                return formatMoney(item.totalPrice);
              if (column.key === 'createdAt' || column.key === 'lastModifiedAt')
                return formatDate(item[column.key]);
              return String(item[column.key as keyof Order] ?? '—');
            }}
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
            totalItems={data?.orders.total ?? 0}
            perPageRange="s"
          />
        </PageState>
      </Spacings.Stack>
    </ListPage>
  );
};

const OrderDetail = (props: { onClose: () => void }) => {
  const { id } = useParams<{ id: string }>();
  const match = useRouteMatch();
  const { data, loading, error } = useMcQuery<OrderDetailData>(
    ORDER_DETAIL_QUERY,
    {
      variables: { id },
      context: { target: GRAPHQL_TARGETS.COMMERCETOOLS_PLATFORM },
    }
  );
  const order = data?.order;
  const base = match.url.replace(
    /\/(general|shipping|returns|payments|comments|custom-attributes)$/,
    ''
  );

  return (
    <TabularDetailPage
      title={order?.orderNumber ?? 'Order'}
      subtitle={order?.customerEmail ?? id}
      previousPathLabel="Go to View orders"
      onPreviousPathClick={props.onClose}
      tabControls={
        <>
          <TabHeader to={`${base}/general`} label="General" />
          <TabHeader to={`${base}/shipping`} label="Shipping & Delivery" />
          <TabHeader to={`${base}/returns`} label="Returns" />
          <TabHeader to={`${base}/payments`} label="Payments" />
          <TabHeader to={`${base}/comments`} label="Comments" />
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
        isEmpty={order === null}
        emptyTitle="Order not found"
      >
        {order ? (
          <Switch>
            <SuspendedRoute path={`${base}/shipping`}>
              <ShippingTab order={order} />
            </SuspendedRoute>
            <SuspendedRoute path={`${base}/returns`}>
              <ReturnsTab order={order} />
            </SuspendedRoute>
            <SuspendedRoute path={`${base}/payments`}>
              <PaymentsTab order={order} />
            </SuspendedRoute>
            <SuspendedRoute path={`${base}/comments`}>
              <ContentNotification type="info">
                <Text.Body>
                  No persisted order-comment model is configured in this
                  commercetools project. CSA does not store browser-only
                  comments.
                </Text.Body>
              </ContentNotification>
            </SuspendedRoute>
            <SuspendedRoute path={`${base}/custom-attributes`}>
              <CustomFieldsTable fields={order.custom?.customFieldsRaw} />
            </SuspendedRoute>
            <SuspendedRoute>
              <OrderGeneral order={order} />
            </SuspendedRoute>
          </Switch>
        ) : null}
      </PageState>
    </TabularDetailPage>
  );
};

const OrderGeneral = ({ order }: { order: Order }) => (
  <Spacings.Stack scale="xl">
    <CollapsiblePanel header="Order summary" isDefaultClosed={false}>
      <Grid gridGap="24px" gridTemplateColumns="repeat(2, minmax(0, 1fr))">
        <Grid.Item>
          <KeyValueGrid
            items={[
              { label: 'Order', value: order.orderNumber ?? order.id },
              { label: 'Order state', value: order.orderState },
              { label: 'Payment state', value: order.paymentState ?? '—' },
              { label: 'Shipment state', value: order.shipmentState ?? '—' },
              {
                label: 'Customer',
                value: order.customerEmail ?? order.customerId ?? '—',
              },
            ]}
          />
        </Grid.Item>
        <Grid.Item>
          <KeyValueGrid
            items={[
              { label: 'Order total', value: formatMoney(order.totalPrice) },
              { label: 'Created', value: formatDate(order.createdAt) },
              { label: 'Modified', value: formatDate(order.lastModifiedAt) },
            ]}
          />
        </Grid.Item>
      </Grid>
    </CollapsiblePanel>
    <CollapsiblePanel header="Order items" isDefaultClosed={false}>
      <PageState
        isEmpty={(order.lineItems ?? []).length === 0}
        emptyTitle="No line items"
      >
        <DataTable
          columns={[
            { key: 'name', label: 'Product' },
            { key: 'sku', label: 'SKU' },
            { key: 'unitPrice', label: 'Unit price' },
            { key: 'quantity', label: 'Qty' },
            { key: 'totalPrice', label: 'Total price' },
          ]}
          rows={order.lineItems ?? []}
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
              {formatAddress(order.shippingAddress)}
            </span>
          </Text.Body>
        </Grid.Item>
        <Grid.Item>
          <Text.Subheadline as="h4">Billing address</Text.Subheadline>
          <Text.Body>
            <span style={{ whiteSpace: 'pre-line' }}>
              {formatAddress(order.billingAddress)}
            </span>
          </Text.Body>
        </Grid.Item>
      </Grid>
    </CollapsiblePanel>
  </Spacings.Stack>
);

const ShippingTab = ({ order }: { order: Order }) => {
  const deliveries = order.shippingInfo?.deliveries ?? [];
  return (
    <Spacings.Stack scale="l">
      <KeyValueGrid
        items={[
          {
            label: 'Shipping method',
            value: order.shippingInfo?.shippingMethodName ?? '—',
          },
          { label: 'Shipment state', value: order.shipmentState ?? '—' },
        ]}
      />
      <PageState isEmpty={deliveries.length === 0} emptyTitle="No deliveries">
        <DataTable
          columns={[
            { key: 'id', label: 'Delivery' },
            { key: 'createdAt', label: 'Created' },
            { key: 'parcels', label: 'Tracking' },
          ]}
          rows={deliveries}
          itemRenderer={(item, column) =>
            column.key === 'createdAt'
              ? formatDate(item.createdAt)
              : column.key === 'parcels'
              ? item.parcels
                  .map((parcel) => parcel.trackingData?.trackingId ?? parcel.id)
                  .join(', ')
              : item.id
          }
        />
      </PageState>
    </Spacings.Stack>
  );
};

const ReturnsTab = ({ order }: { order: Order }) => {
  const returns = order.returnInfo ?? [];
  const rows = returns.map((returnInfo, index) => ({
    ...returnInfo,
    id: returnInfo.returnTrackingId ?? `return-${index}`,
  }));
  return (
    <PageState isEmpty={returns.length === 0} emptyTitle="No returns">
      <DataTable<(typeof rows)[number]>
        columns={[
          { key: 'returnTrackingId', label: 'Tracking ID' },
          { key: 'returnDate', label: 'Return date' },
          { key: 'items', label: 'Items' },
        ]}
        rows={rows}
        itemRenderer={(item, column) =>
          column.key === 'returnDate'
            ? formatDate(item.returnDate)
            : column.key === 'items'
            ? String(item.items.reduce((total, row) => total + row.quantity, 0))
            : item.returnTrackingId ?? '—'
        }
      />
    </PageState>
  );
};

const PaymentsTab = ({ order }: { order: Order }) => {
  const payments = order.paymentInfo?.payments ?? [];
  return (
    <PageState isEmpty={payments.length === 0} emptyTitle="No payments">
      <DataTable
        columns={[
          { key: 'id', label: 'Payment ID' },
          { key: 'amountPlanned', label: 'Amount planned' },
          { key: 'method', label: 'Method' },
          { key: 'transactions', label: 'Transactions' },
        ]}
        rows={payments}
        itemRenderer={(item, column) =>
          column.key === 'amountPlanned'
            ? formatMoney(item.amountPlanned)
            : column.key === 'method'
            ? item.paymentMethodInfo?.name ??
              item.paymentMethodInfo?.method ??
              '—'
            : column.key === 'transactions'
            ? item.transactions
                .map(
                  (transaction) => `${transaction.type}: ${transaction.state}`
                )
                .join(', ') || '—'
            : item.id
        }
      />
    </PageState>
  );
};

Orders.displayName = 'Orders';
export default Orders;
