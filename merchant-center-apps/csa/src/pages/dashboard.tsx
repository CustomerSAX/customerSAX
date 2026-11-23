import { useHistory, useRouteMatch } from 'react-router-dom';
import { InfoMainPage } from '@commercetools-frontend/application-components';
import { useMcQuery } from '@commercetools-frontend/application-shell';
import { useApplicationContext } from '@commercetools-frontend/application-shell-connectors';
import { GRAPHQL_TARGETS } from '@commercetools-frontend/constants';
import CollapsiblePanel from '@commercetools-uikit/collapsible-panel';
import DataTable from '@commercetools-uikit/data-table';
import Grid from '@commercetools-uikit/grid';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import { DASHBOARD_QUERY } from '../graphql';
import type { Order } from '../types';
import { formatDate, formatMoney } from '../utils';
import { PageState } from '../components/common';

type DashboardData = {
  customers: { total: number };
  carts: { total: number };
  orders: { total: number };
  recentOrders: { results: Order[] };
};

const Metric = (props: { label: string; value: number; hint: string }) => (
  <Grid.Item>
    <CollapsiblePanel header={props.label} isDefaultClosed={false}>
      <Spacings.Stack scale="xs">
        <Text.Headline as="h2">{String(props.value)}</Text.Headline>
        <Text.Detail tone="secondary">{props.hint}</Text.Detail>
      </Spacings.Stack>
    </CollapsiblePanel>
  </Grid.Item>
);

const Dashboard = () => {
  const match = useRouteMatch();
  const history = useHistory();
  const projectKey = useApplicationContext((context) => context.project?.key);
  const { data, loading, error } = useMcQuery<DashboardData>(DASHBOARD_QUERY, {
    variables: { activeCartWhere: 'cartState="Active"' },
    context: { target: GRAPHQL_TARGETS.COMMERCETOOLS_PLATFORM },
    fetchPolicy: 'cache-and-network',
  });

  return (
    <InfoMainPage
      title="CSA Dashboard"
      subtitle={`Live B2C operations for ${
        projectKey ?? 'the selected project'
      }`}
    >
      <PageState
        loading={loading}
        error={error}
        isEmpty={!data}
        emptyTitle="Dashboard unavailable"
      >
        {data ? (
          <Spacings.Stack scale="xl">
            <Grid
              gridGap="16px"
              gridTemplateColumns="repeat(3, minmax(0, 1fr))"
            >
              <Metric
                label="Customers"
                value={data.customers.total}
                hint="Registered customers"
              />
              <Metric
                label="Active carts"
                value={data.carts.total}
                hint="Carts currently active"
              />
              <Metric
                label="Orders"
                value={data.orders.total}
                hint="All project orders"
              />
            </Grid>
            <CollapsiblePanel header="Recent orders" isDefaultClosed={false}>
              <PageState
                isEmpty={data.recentOrders.results.length === 0}
                emptyTitle="No recent orders"
              >
                <DataTable<Order>
                  columns={[
                    { key: 'orderNumber', label: 'Order' },
                    { key: 'customerEmail', label: 'Customer' },
                    { key: 'orderState', label: 'Order state' },
                    { key: 'paymentState', label: 'Payment' },
                    { key: 'totalPrice', label: 'Total' },
                    { key: 'createdAt', label: 'Created' },
                  ]}
                  rows={data.recentOrders.results}
                  itemRenderer={(item, column) => {
                    if (column.key === 'orderNumber')
                      return item.orderNumber ?? item.id;
                    if (column.key === 'totalPrice')
                      return formatMoney(item.totalPrice);
                    if (column.key === 'createdAt')
                      return formatDate(item.createdAt);
                    return String(item[column.key as keyof Order] ?? '—');
                  }}
                  onRowClick={(row) =>
                    history.push(
                      `${match.url.replace(/\/dashboard$/, '')}/orders/${
                        row.id
                      }`
                    )
                  }
                />
              </PageState>
            </CollapsiblePanel>
          </Spacings.Stack>
        ) : null}
      </PageState>
    </InfoMainPage>
  );
};

Dashboard.displayName = 'Dashboard';
export default Dashboard;
