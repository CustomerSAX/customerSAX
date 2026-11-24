import { useEffect, useMemo, useState } from 'react';
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
import type { Order, Payment, QueryPage } from '../types';
import {
  paymentMethodLabel,
  paymentProviderLabel,
  paymentsForOrder,
  paymentStatusLabel,
} from '../order-payments';
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
  const parcels = deliveries.flatMap((delivery) =>
    delivery.parcels.map((parcel) => ({
      ...parcel,
      deliveryId: delivery.id,
    }))
  );
  const deliveryQuantity = (delivery: (typeof deliveries)[number]) => {
    const deliveryItems = delivery.items ?? [];
    if (deliveryItems.length > 0) {
      return deliveryItems.reduce((total, item) => total + item.quantity, 0);
    }
    return delivery.parcels.reduce(
      (total, parcel) =>
        total +
        (parcel.items ?? []).reduce(
          (parcelTotal, item) => parcelTotal + item.quantity,
          0
        ),
      0
    );
  };
  const shippedQuantity = deliveries.reduce(
    (total, delivery) => total + deliveryQuantity(delivery),
    0
  );
  const shippingMethod =
    order.shippingInfo?.shippingMethodName ??
    order.shippingInfo?.shippingMethod?.name ??
    '—';
  const carriers = Array.from(
    new Set(
      parcels
        .map((parcel) => parcel.trackingData?.carrier)
        .filter((carrier): carrier is string => Boolean(carrier))
    )
  );
  const shippingTax = order.taxedShippingPrice
    ? {
        ...order.taxedShippingPrice.totalGross,
        centAmount:
          order.taxedShippingPrice.totalGross.centAmount -
          order.taxedShippingPrice.totalNet.centAmount,
      }
    : null;
  const taxRate = order.shippingInfo?.taxRate;
  const taxRateLabel =
    taxRate?.amount == null
      ? taxRate?.name ?? '—'
      : `${new Intl.NumberFormat(undefined, {
          maximumFractionDigits: 3,
        }).format(taxRate.amount * 100)}%${
          taxRate.name ? ` (${taxRate.name})` : ''
        }`;
  const shippingAddress = order.shippingAddress;

  return (
    <Spacings.Stack scale="xl">
      <Grid
        gridGap="16px"
        gridTemplateColumns="repeat(auto-fit, minmax(320px, 1fr))"
      >
        <Grid.Item>
          <CollapsiblePanel header="Shipment status" isDefaultClosed={false}>
            <KeyValueGrid
              items={[
                { label: 'Order placed', value: formatDate(order.createdAt) },
                { label: 'Payment', value: order.paymentState ?? '—' },
                { label: 'Shipment', value: order.shipmentState ?? '—' },
                {
                  label: 'Last updated',
                  value: formatDate(order.lastModifiedAt),
                },
              ]}
            />
          </CollapsiblePanel>
        </Grid.Item>
        <Grid.Item>
          <CollapsiblePanel header="Shipping summary" isDefaultClosed={false}>
            <KeyValueGrid
              items={[
                { label: 'Method', value: shippingMethod },
                {
                  label: 'Method state',
                  value: order.shippingInfo?.shippingMethodState ?? '—',
                },
                {
                  label: 'Shipping cost',
                  value: formatMoney(order.shippingInfo?.price),
                },
                { label: 'Shipping tax', value: formatMoney(shippingTax) },
                { label: 'Tax rate', value: taxRateLabel },
                {
                  label: 'Tax included',
                  value:
                    taxRate?.includedInPrice == null
                      ? '—'
                      : taxRate.includedInPrice
                      ? 'Yes'
                      : 'No',
                },
                {
                  label: 'Carrier',
                  value: carriers.length > 0 ? carriers.join(', ') : '—',
                },
                {
                  label: 'Shipped quantity',
                  value: deliveries.length > 0 ? String(shippedQuantity) : '—',
                },
                { label: 'Deliveries', value: String(deliveries.length) },
                { label: 'Parcels', value: String(parcels.length) },
              ]}
            />
          </CollapsiblePanel>
        </Grid.Item>
      </Grid>

      <CollapsiblePanel header="Shipping address" isDefaultClosed={false}>
        <KeyValueGrid
          items={[
            {
              label: 'Recipient',
              value:
                [shippingAddress?.firstName, shippingAddress?.lastName]
                  .filter(Boolean)
                  .join(' ') || '—',
            },
            { label: 'Company', value: shippingAddress?.company ?? '—' },
            {
              label: 'Street',
              value:
                [shippingAddress?.streetNumber, shippingAddress?.streetName]
                  .filter(Boolean)
                  .join(' ') || '—',
            },
            {
              label: 'Additional street',
              value: shippingAddress?.additionalStreetInfo ?? '—',
            },
            {
              label: 'Apartment / building',
              value:
                [shippingAddress?.apartment, shippingAddress?.building]
                  .filter(Boolean)
                  .join(', ') || '—',
            },
            { label: 'City', value: shippingAddress?.city ?? '—' },
            { label: 'State', value: shippingAddress?.state ?? '—' },
            {
              label: 'Postal code',
              value: shippingAddress?.postalCode ?? '—',
            },
            { label: 'Country', value: shippingAddress?.country ?? '—' },
            { label: 'Email', value: shippingAddress?.email ?? '—' },
            {
              label: 'Phone',
              value: shippingAddress?.phone ?? shippingAddress?.mobile ?? '—',
            },
          ]}
        />
      </CollapsiblePanel>

      <CollapsiblePanel header="Deliveries" isDefaultClosed={false}>
        <PageState
          isEmpty={deliveries.length === 0}
          emptyTitle="No deliveries yet"
          emptyBody="Shipping details are available above. Delivery records will appear after a delivery is created for this order."
        >
          <DataTable
            columns={[
              { key: 'id', label: 'Delivery' },
              { key: 'createdAt', label: 'Created' },
              { key: 'items', label: 'Quantity' },
              { key: 'address', label: 'Delivery address' },
              { key: 'parcels', label: 'Parcels' },
            ]}
            rows={deliveries}
            itemRenderer={(item, column) =>
              column.key === 'createdAt'
                ? formatDate(item.createdAt)
                : column.key === 'items'
                ? String(deliveryQuantity(item))
                : column.key === 'address'
                ? formatAddress(item.address ?? order.shippingAddress)
                : column.key === 'parcels'
                ? String(item.parcels.length)
                : item.id
            }
          />
        </PageState>
      </CollapsiblePanel>

      <CollapsiblePanel header="Parcel tracking" isDefaultClosed={false}>
        <PageState
          isEmpty={parcels.length === 0}
          emptyTitle="No parcel tracking yet"
          emptyBody="Tracking information will appear when parcels are added to a delivery."
        >
          <DataTable
            columns={[
              { key: 'trackingId', label: 'Tracking ID' },
              { key: 'carrier', label: 'Carrier' },
              { key: 'provider', label: 'Provider' },
              { key: 'createdAt', label: 'Created' },
              { key: 'items', label: 'Quantity' },
              { key: 'deliveryId', label: 'Delivery' },
              { key: 'isReturn', label: 'Return parcel' },
            ]}
            rows={parcels}
            itemRenderer={(item, column) => {
              if (column.key === 'trackingId')
                return item.trackingData?.trackingId ?? item.id;
              if (column.key === 'carrier')
                return item.trackingData?.carrier ?? '—';
              if (column.key === 'provider')
                return item.trackingData?.provider ?? '—';
              if (column.key === 'createdAt') return formatDate(item.createdAt);
              if (column.key === 'items')
                return String(
                  (item.items ?? []).reduce(
                    (total, parcelItem) => total + parcelItem.quantity,
                    0
                  )
                );
              if (column.key === 'isReturn')
                return item.trackingData?.isReturn ? 'Yes' : 'No';
              return item.deliveryId;
            }}
          />
        </PageState>
      </CollapsiblePanel>
    </Spacings.Stack>
  );
};

const ReturnsTab = (props: {
  order: Order;
  onSaved: () => Promise<unknown>;
}) => {
  const { order } = props;
  const returns = order.returnInfo ?? [];
  const lineItemsById = new Map(
    (order.lineItems ?? []).map((lineItem) => [lineItem.id, lineItem])
  );
  const returnItems = returns.flatMap((returnInfo) => returnInfo.items);
  const returnedQuantity = returnItems
    .filter((item) => item.shipmentState === 'Returned')
    .reduce((total, item) => total + item.quantity, 0);
  const advisedQuantity = returnItems
    .filter((item) => item.shipmentState === 'Advised')
    .reduce((total, item) => total + item.quantity, 0);

  return (
    <Spacings.Stack scale="xl">
      <ReturnCreator {...props} />
      <PageState isEmpty={returns.length === 0} emptyTitle="No returns yet">
        <Spacings.Stack scale="l">
          <KeyValueGrid
            items={[
              { label: 'Return requests', value: String(returns.length) },
              { label: 'Returned quantity', value: String(returnedQuantity) },
              { label: 'Advised quantity', value: String(advisedQuantity) },
              {
                label: 'Total return quantity',
                value: String(
                  returnItems.reduce(
                    (total, returnItem) => total + returnItem.quantity,
                    0
                  )
                ),
              },
            ]}
          />
          {returns.map((returnInfo, returnIndex) => {
            const rows = returnInfo.items.map((returnItem, itemIndex) => ({
              ...returnItem,
              id: `${returnIndex}-${returnItem.id}-${itemIndex}`,
              lineItemId: returnItem.lineItemId ?? returnItem.id,
              lineItem: lineItemsById.get(
                returnItem.lineItemId ?? returnItem.id
              ),
            }));
            const totalQuantity = returnInfo.items.reduce(
              (total, returnItem) => total + returnItem.quantity,
              0
            );

            return (
              <CollapsiblePanel
                key={`return-${returnIndex}-${
                  returnInfo.returnTrackingId ?? 'untracked'
                }`}
                header={`Return request #${returnIndex + 1}`}
              >
                <Spacings.Stack scale="l">
                  <KeyValueGrid
                    items={[
                      {
                        label: 'Tracking ID',
                        value: returnInfo.returnTrackingId ?? '—',
                      },
                      {
                        label: 'Return date',
                        value: formatDate(returnInfo.returnDate),
                      },
                      {
                        label: 'Items',
                        value: String(returnInfo.items.length),
                      },
                      {
                        label: 'Total quantity',
                        value: String(totalQuantity),
                      },
                    ]}
                  />
                  <DataTable<(typeof rows)[number]>
                    columns={[
                      { key: 'item', label: 'Item' },
                      { key: 'sku', label: 'SKU' },
                      { key: 'quantity', label: 'Quantity' },
                      { key: 'shipmentState', label: 'Shipment state' },
                      { key: 'paymentState', label: 'Payment state' },
                      { key: 'comment', label: 'Comment' },
                    ]}
                    rows={rows}
                    itemRenderer={(item, column) => {
                      if (column.key === 'item')
                        return (
                          item.lineItem?.name ??
                          item.lineItem?.nameAllLocales?.[0]?.value ??
                          item.lineItemId
                        );
                      if (column.key === 'sku')
                        return item.lineItem?.variant?.sku ?? '—';
                      if (column.key === 'quantity')
                        return String(item.quantity);
                      if (column.key === 'shipmentState')
                        return item.shipmentState ?? '—';
                      if (column.key === 'paymentState')
                        return item.paymentState ?? '—';
                      return item.comment ?? '—';
                    }}
                  />
                </Spacings.Stack>
              </CollapsiblePanel>
            );
          })}
        </Spacings.Stack>
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
  const [shipmentState, setShipmentState] = useState('Returned');
  const [trackingId, setTrackingId] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>();
  const returnedQuantities = new Map<string, number>();
  for (const returnInfo of props.order.returnInfo ?? []) {
    for (const returnItem of returnInfo.items) {
      returnedQuantities.set(
        returnItem.lineItemId ?? returnItem.id,
        (returnedQuantities.get(returnItem.lineItemId ?? returnItem.id) ?? 0) +
          returnItem.quantity
      );
    }
  }
  const eligibleLineItems = lineItems
    .map((item) => ({
      ...item,
      remainingQuantity: item.quantity - (returnedQuantities.get(item.id) ?? 0),
    }))
    .filter((item) => item.remainingQuantity > 0);
  const activeLineItemId = eligibleLineItems.some(
    (item) => item.id === lineItemId
  )
    ? lineItemId
    : eligibleLineItems[0]?.id ?? '';
  const selectedItem = eligibleLineItems.find(
    (item) => item.id === activeLineItemId
  );
  const parsedQuantity = Number(quantity);
  const invalidQuantity =
    !Number.isInteger(parsedQuantity) ||
    parsedQuantity < 1 ||
    parsedQuantity > (selectedItem?.remainingQuantity ?? 0);

  const createReturn = async () => {
    if (!projectKey || !canManage || !activeLineItemId || invalidQuantity)
      return;
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
                    lineItemId: activeLineItemId,
                    quantity: parsedQuantity,
                    shipmentState,
                    comment: comment.trim() || undefined,
                  },
                ],
              },
            ],
          },
        })
      );
      await props.onSaved();
      setLineItemId('');
      setQuantity('1');
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
    <CollapsiblePanel header="Create order return" isDefaultClosed>
      <Spacings.Stack scale="l">
        {eligibleLineItems.length === 0 ? (
          <ContentNotification type="info">
            <Text.Body>
              Every line item on this order has already been included in a
              return request.
            </Text.Body>
          </ContentNotification>
        ) : null}
        <Grid gridGap="24px" gridTemplateColumns="repeat(2, minmax(0, 1fr))">
          <Grid.Item>
            <SelectField
              name="return-line-item"
              title="Line item"
              value={activeLineItemId || null}
              options={eligibleLineItems.map((item) => ({
                value: item.id,
                label: `${
                  item.name ?? item.nameAllLocales?.[0]?.value ?? item.id
                } (${item.remainingQuantity} remaining)`,
              }))}
              onChange={(event) => {
                setLineItemId(String(event.target.value));
                setQuantity('1');
              }}
              isDisabled={
                !canManage || saving || eligibleLineItems.length === 0
              }
              horizontalConstraint="scale"
            />
          </Grid.Item>
          <Grid.Item>
            <TextField
              name="return-quantity"
              title="Quantity"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              isDisabled={
                !canManage || saving || eligibleLineItems.length === 0
              }
              errors={{ invalidQuantity }}
              touched={quantity.length > 0}
              renderError={(key) =>
                key === 'invalidQuantity'
                  ? `Enter 1 to ${selectedItem?.remainingQuantity ?? 0}.`
                  : null
              }
              horizontalConstraint="scale"
            />
          </Grid.Item>
          <Grid.Item>
            <SelectField
              name="return-shipment-state"
              title="Shipment state"
              value={shipmentState}
              options={[
                { value: 'Returned', label: 'Returned' },
                { value: 'Advised', label: 'Advised' },
              ]}
              onChange={(event) => setShipmentState(String(event.target.value))}
              isDisabled={
                !canManage || saving || eligibleLineItems.length === 0
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
          label={saving ? 'Creating…' : 'Create return'}
          onClick={() => void createReturn()}
          isDisabled={
            !canManage ||
            saving ||
            !activeLineItemId ||
            invalidQuantity ||
            eligibleLineItems.length === 0
          }
        />
      </Spacings.Stack>
    </CollapsiblePanel>
  );
};

const PaymentsTab = ({ order }: { order: Order }) => {
  const payments = useMemo(() => paymentsForOrder(order), [order]);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(
    payments[0]?.id ?? null
  );
  const selectedPayment =
    payments.find((payment) => payment.id === selectedPaymentId) ?? null;
  const transactionCount = payments.reduce(
    (total, payment) => total + payment.transactions.length,
    0
  );
  const plannedAmount = payments.reduce(
    (total, payment) => total + payment.amountPlanned.centAmount,
    0
  );
  const plannedMoney = payments[0]
    ? { ...payments[0].amountPlanned, centAmount: plannedAmount }
    : order.totalPrice;

  useEffect(() => {
    if (payments.length === 0) {
      setSelectedPaymentId(null);
      return;
    }
    if (!payments.some((payment) => payment.id === selectedPaymentId)) {
      setSelectedPaymentId(payments[0].id);
    }
  }, [payments, selectedPaymentId]);

  return (
    <Spacings.Stack scale="xl">
      <CollapsiblePanel header="Payment summary" isDefaultClosed={false}>
        <Grid gridGap="24px" gridTemplateColumns="repeat(2, minmax(0, 1fr))">
          <Grid.Item>
            <KeyValueGrid
              items={[
                { label: 'Payment state', value: order.paymentState ?? '—' },
                { label: 'Payment records', value: String(payments.length) },
                { label: 'Transactions', value: String(transactionCount) },
              ]}
            />
          </Grid.Item>
          <Grid.Item>
            <KeyValueGrid
              items={[
                { label: 'Order total', value: formatMoney(order.totalPrice) },
                {
                  label: 'Amount planned',
                  value: payments.length > 0 ? formatMoney(plannedMoney) : '—',
                },
                {
                  label: 'Last modified',
                  value: formatDate(order.lastModifiedAt),
                },
              ]}
            />
          </Grid.Item>
        </Grid>
      </CollapsiblePanel>

      <CollapsiblePanel header="Payment transactions" isDefaultClosed={false}>
        <PageState
          isEmpty={payments.length === 0}
          emptyTitle="No payments"
          emptyBody="There are no payment records associated with this order."
        >
          <DataTable<Payment>
            columns={[
              { key: 'id', label: 'Payment ID' },
              { key: 'interfaceId', label: 'Interface ID' },
              { key: 'amountPlanned', label: 'Amount planned' },
              { key: 'paymentMethodInfo', label: 'Payment method info' },
              { key: 'createdAt', label: 'Date' },
              { key: 'lastModifiedAt', label: 'Modified' },
            ]}
            rows={payments}
            onRowClick={(payment) => setSelectedPaymentId(payment.id)}
            itemRenderer={(item, column) => {
              if (column.key === 'amountPlanned')
                return formatMoney(item.amountPlanned);
              if (column.key === 'paymentMethodInfo')
                return `${paymentMethodLabel(item)} · ${paymentProviderLabel(
                  item
                )}`;
              if (column.key === 'createdAt') return formatDate(item.createdAt);
              if (column.key === 'lastModifiedAt')
                return formatDate(item.lastModifiedAt ?? item.createdAt);
              if (column.key === 'interfaceId') return item.interfaceId ?? '—';
              return item.id;
            }}
          />
        </PageState>
      </CollapsiblePanel>

      {selectedPayment ? (
        <CollapsiblePanel
          header={`Payment ID: ${selectedPayment.id}`}
          isDefaultClosed={false}
        >
          <Spacings.Stack scale="xl">
            <Grid
              gridGap="24px"
              gridTemplateColumns="repeat(2, minmax(0, 1fr))"
            >
              <Grid.Item>
                <KeyValueGrid
                  items={[
                    {
                      label: 'Payment method name',
                      value: paymentMethodLabel(selectedPayment),
                    },
                    {
                      label: 'PSP provider',
                      value: paymentProviderLabel(selectedPayment),
                    },
                    {
                      label: 'Interface ID',
                      value: selectedPayment.interfaceId ?? '—',
                    },
                  ]}
                />
              </Grid.Item>
              <Grid.Item>
                <KeyValueGrid
                  items={[
                    {
                      label: 'Amount planned',
                      value: formatMoney(selectedPayment.amountPlanned),
                    },
                    {
                      label: 'PSP payment status',
                      value: paymentStatusLabel(selectedPayment, order),
                    },
                    {
                      label: 'Created',
                      value: formatDate(selectedPayment.createdAt),
                    },
                  ]}
                />
              </Grid.Item>
            </Grid>

            <Text.Subheadline as="h4">Transactions breakdown</Text.Subheadline>
            <PageState
              isEmpty={selectedPayment.transactions.length === 0}
              emptyTitle="No payment transactions"
            >
              <DataTable<(typeof selectedPayment.transactions)[number]>
                columns={[
                  { key: 'timestamp', label: 'Date' },
                  { key: 'type', label: 'Transaction type' },
                  { key: 'state', label: 'Status' },
                  { key: 'amount', label: 'Amount' },
                  { key: 'interactionId', label: 'Interaction ID' },
                  { key: 'id', label: 'Transaction ID' },
                ]}
                rows={selectedPayment.transactions}
                itemRenderer={(item, column) => {
                  if (column.key === 'timestamp')
                    return formatDate(item.timestamp);
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
      ) : null}
    </Spacings.Stack>
  );
};

Orders.displayName = 'Orders';
export default Orders;
