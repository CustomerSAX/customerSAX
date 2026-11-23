import { useMemo, useState } from 'react';
import { Switch, useHistory, useParams, useRouteMatch } from 'react-router-dom';
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
import { ContentNotification } from '@commercetools-uikit/notifications';
import { Pagination } from '@commercetools-uikit/pagination';
import SelectField from '@commercetools-uikit/select-field';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import TextField from '@commercetools-uikit/text-field';
import { ORDER_DETAIL_QUERY, ORDERS_QUERY } from '../graphql';
import { PERMISSIONS } from '../constants';
import type { Order, QueryPage } from '../types';
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
  const { data, loading, error, refetch } = useMcQuery<OrderDetailData>(
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
              <ReturnsTab order={order} onSaved={() => refetch()} />
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
              <OrderGeneral order={order} onSaved={() => refetch()} />
            </SuspendedRoute>
          </Switch>
        ) : null}
      </PageState>
    </TabularDetailPage>
  );
};

const OrderGeneral = (props: {
  order: Order;
  onSaved: () => Promise<unknown>;
}) => (
  <Spacings.Stack scale="xl">
    <OrderStateEditor {...props} />
    <CollapsiblePanel header="Order summary" isDefaultClosed={false}>
      <Grid gridGap="24px" gridTemplateColumns="repeat(2, minmax(0, 1fr))">
        <Grid.Item>
          <KeyValueGrid
            items={[
              {
                label: 'Order',
                value: props.order.orderNumber ?? props.order.id,
              },
              { label: 'Order state', value: props.order.orderState },
              {
                label: 'Payment state',
                value: props.order.paymentState ?? '—',
              },
              {
                label: 'Shipment state',
                value: props.order.shipmentState ?? '—',
              },
              {
                label: 'Customer',
                value:
                  props.order.customerEmail ?? props.order.customerId ?? '—',
              },
            ]}
          />
        </Grid.Item>
        <Grid.Item>
          <KeyValueGrid
            items={[
              {
                label: 'Order total',
                value: formatMoney(props.order.totalPrice),
              },
              { label: 'Created', value: formatDate(props.order.createdAt) },
              {
                label: 'Modified',
                value: formatDate(props.order.lastModifiedAt),
              },
            ]}
          />
        </Grid.Item>
      </Grid>
    </CollapsiblePanel>
    <CollapsiblePanel header="Order items" isDefaultClosed={false}>
      <PageState
        isEmpty={(props.order.lineItems ?? []).length === 0}
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
          rows={props.order.lineItems ?? []}
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
              {formatAddress(props.order.shippingAddress)}
            </span>
          </Text.Body>
        </Grid.Item>
        <Grid.Item>
          <Text.Subheadline as="h4">Billing address</Text.Subheadline>
          <Text.Body>
            <span style={{ whiteSpace: 'pre-line' }}>
              {formatAddress(props.order.billingAddress)}
            </span>
          </Text.Body>
        </Grid.Item>
      </Grid>
    </CollapsiblePanel>
  </Spacings.Stack>
);

const orderStateOptions = ['Open', 'Confirmed', 'Complete', 'Cancelled'].map(
  (value) => ({ value, label: value })
);
const paymentStateOptions = [
  'BalanceDue',
  'Pending',
  'Failed',
  'Paid',
  'CreditOwed',
].map((value) => ({ value, label: value }));
const shipmentStateOptions = [
  'Pending',
  'Ready',
  'Shipped',
  'Delayed',
  'Partial',
  'Backorder',
].map((value) => ({ value, label: value }));

const OrderStateEditor = (props: {
  order: Order;
  onSaved: () => Promise<unknown>;
}) => {
  const projectKey = useApplicationContext((context) => context.project?.key);
  const dispatch = useAsyncDispatch();
  const showNotification = useShowNotification();
  const canManage = useIsAuthorized({
    demandedPermissions: [PERMISSIONS.ManageOrders],
  });
  const [orderState, setOrderState] = useState(props.order.orderState);
  const [paymentState, setPaymentState] = useState(
    props.order.paymentState ?? ''
  );
  const [shipmentState, setShipmentState] = useState(
    props.order.shipmentState ?? ''
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>();

  const save = async () => {
    if (!projectKey || !canManage) return;
    const updateActions: Array<Record<string, string>> = [];
    if (orderState !== props.order.orderState)
      updateActions.push({ action: 'changeOrderState', orderState });
    if (paymentState !== (props.order.paymentState ?? ''))
      updateActions.push({ action: 'changePaymentState', paymentState });
    if (shipmentState !== (props.order.shipmentState ?? ''))
      updateActions.push({ action: 'changeShipmentState', shipmentState });
    if (updateActions.length === 0) return;
    setSaving(true);
    setError(undefined);
    try {
      await dispatch(
        actions.post({
          mcApiProxyTarget: MC_API_PROXY_TARGETS.COMMERCETOOLS_PLATFORM,
          uri: `/${projectKey}/orders/${props.order.id}`,
          payload: { version: props.order.version, actions: updateActions },
        })
      );
      await props.onSaved();
      showNotification({
        domain: NOTIFICATION_DOMAINS.SIDE,
        kind: NOTIFICATION_KINDS_SIDE.success,
        text: 'Order states updated.',
      });
    } catch (caught) {
      setError(caught);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
    orderState !== props.order.orderState ||
    paymentState !== (props.order.paymentState ?? '') ||
    shipmentState !== (props.order.shipmentState ?? '');

  return (
    <CollapsiblePanel header="Order operations" isDefaultClosed={false}>
      <Spacings.Stack scale="l">
        {!canManage ? (
          <ContentNotification type="warning">
            <Text.Body>
              You can view this order, but your CSA role cannot update it.
            </Text.Body>
          </ContentNotification>
        ) : null}
        <Grid gridGap="24px" gridTemplateColumns="repeat(3, minmax(0, 1fr))">
          <Grid.Item>
            <SelectField
              name="orderState"
              title="Order state"
              value={orderState}
              options={orderStateOptions}
              onChange={(event) => setOrderState(String(event.target.value))}
              isDisabled={!canManage || saving}
              horizontalConstraint="scale"
            />
          </Grid.Item>
          <Grid.Item>
            <SelectField
              name="paymentState"
              title="Payment state"
              value={paymentState || null}
              options={paymentStateOptions}
              onChange={(event) => setPaymentState(String(event.target.value))}
              isDisabled={!canManage || saving}
              horizontalConstraint="scale"
            />
          </Grid.Item>
          <Grid.Item>
            <SelectField
              name="shipmentState"
              title="Shipment state"
              value={shipmentState || null}
              options={shipmentStateOptions}
              onChange={(event) => setShipmentState(String(event.target.value))}
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
        <TabularDetailPage.FormPrimaryButton
          label={saving ? 'Saving…' : 'Save states'}
          onClick={() => void save()}
          isDisabled={!canManage || saving || !hasChanges}
        />
      </Spacings.Stack>
    </CollapsiblePanel>
  );
};

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

const ReturnsTab = (props: {
  order: Order;
  onSaved: () => Promise<unknown>;
}) => {
  const { order } = props;
  const returns = order.returnInfo ?? [];
  const rows = returns.map((returnInfo, index) => ({
    ...returnInfo,
    id: returnInfo.returnTrackingId ?? `return-${index}`,
  }));
  return (
    <Spacings.Stack scale="xl">
      <ReturnCreator {...props} />
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
              ? String(
                  item.items.reduce((total, row) => total + row.quantity, 0)
                )
              : item.returnTrackingId ?? '—'
          }
        />
      </PageState>
    </Spacings.Stack>
  );
};

const ReturnCreator = (props: {
  order: Order;
  onSaved: () => Promise<unknown>;
}) => {
  const projectKey = useApplicationContext((context) => context.project?.key);
  const dispatch = useAsyncDispatch();
  const showNotification = useShowNotification();
  const canManage = useIsAuthorized({
    demandedPermissions: [PERMISSIONS.ManageOrders],
  });
  const lineItems = props.order.lineItems ?? [];
  const [lineItemId, setLineItemId] = useState(lineItems[0]?.id ?? '');
  const [quantity, setQuantity] = useState('1');
  const [trackingId, setTrackingId] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>();
  const selectedItem = lineItems.find((item) => item.id === lineItemId);
  const parsedQuantity = Number(quantity);
  const invalidQuantity =
    !Number.isInteger(parsedQuantity) ||
    parsedQuantity < 1 ||
    parsedQuantity > (selectedItem?.quantity ?? 0);

  const createReturn = async () => {
    if (!projectKey || !canManage || !lineItemId || invalidQuantity) return;
    setSaving(true);
    setError(undefined);
    try {
      await dispatch(
        actions.post({
          mcApiProxyTarget: MC_API_PROXY_TARGETS.COMMERCETOOLS_PLATFORM,
          uri: `/${projectKey}/orders/${props.order.id}`,
          payload: {
            version: props.order.version,
            actions: [
              {
                action: 'addReturnInfo',
                returnTrackingId: trackingId.trim() || undefined,
                returnDate: new Date().toISOString(),
                items: [
                  {
                    lineItemId,
                    quantity: parsedQuantity,
                    shipmentState: 'Returned',
                    comment: comment.trim() || undefined,
                  },
                ],
              },
            ],
          },
        })
      );
      await props.onSaved();
      setTrackingId('');
      setComment('');
      showNotification({
        domain: NOTIFICATION_DOMAINS.SIDE,
        kind: NOTIFICATION_KINDS_SIDE.success,
        text: 'Return added to order.',
      });
    } catch (caught) {
      setError(caught);
    } finally {
      setSaving(false);
    }
  };

  return (
    <CollapsiblePanel header="Create return" isDefaultClosed>
      <Spacings.Stack scale="l">
        <Grid gridGap="24px" gridTemplateColumns="repeat(2, minmax(0, 1fr))">
          <Grid.Item>
            <SelectField
              name="return-line-item"
              title="Line item"
              value={lineItemId || null}
              options={lineItems.map((item) => ({
                value: item.id,
                label: item.name ?? item.nameAllLocales?.[0]?.value ?? item.id,
              }))}
              onChange={(event) => setLineItemId(String(event.target.value))}
              isDisabled={!canManage || saving}
              horizontalConstraint="scale"
            />
          </Grid.Item>
          <Grid.Item>
            <TextField
              name="return-quantity"
              title="Quantity"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              isDisabled={!canManage || saving}
              errors={{ invalidQuantity }}
              touched={quantity.length > 0}
              renderError={(key) =>
                key === 'invalidQuantity'
                  ? `Enter 1 to ${selectedItem?.quantity ?? 0}.`
                  : null
              }
              horizontalConstraint="scale"
            />
          </Grid.Item>
          <Grid.Item>
            <TextField
              name="return-tracking"
              title="Return tracking ID"
              value={trackingId}
              onChange={(event) => setTrackingId(event.target.value)}
              isDisabled={!canManage || saving}
              horizontalConstraint="scale"
            />
          </Grid.Item>
          <Grid.Item>
            <TextField
              name="return-comment"
              title="Comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
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
        <TabularDetailPage.FormPrimaryButton
          label={saving ? 'Adding…' : 'Add return'}
          onClick={() => void createReturn()}
          isDisabled={!canManage || saving || !lineItemId || invalidQuantity}
        />
      </Spacings.Stack>
    </CollapsiblePanel>
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
            ? typeof item.paymentMethodInfo?.name === 'string'
              ? item.paymentMethodInfo.name
              : item.paymentMethodInfo?.name
              ? Object.values(item.paymentMethodInfo.name)[0] ?? '—'
              : item.paymentMethodInfo?.method ?? '—'
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
