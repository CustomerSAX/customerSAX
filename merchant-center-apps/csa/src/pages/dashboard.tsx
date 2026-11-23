import { useEffect, useMemo, useState } from 'react';
import { useHistory, useRouteMatch } from 'react-router-dom';
import { InfoMainPage } from '@commercetools-frontend/application-components';
import { useMcQuery } from '@commercetools-frontend/application-shell';
import { useApplicationContext } from '@commercetools-frontend/application-shell-connectors';
import { GRAPHQL_TARGETS } from '@commercetools-frontend/constants';
import { actions, useAsyncDispatch } from '@commercetools-frontend/sdk';
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

type DashboardTicket = {
  id: string;
  ticketNumber: string;
  subject: string;
  customerName?: string | null;
  customerEmail?: string | null;
  status: string;
  priority: string;
  assignee?: string | null;
  createdAt?: string | null;
  lastModifiedAt?: string | null;
};

type TicketPage = {
  results: DashboardTicket[];
  total: number;
  count: number;
  offset: number;
};

type TicketState = {
  data?: TicketPage;
  loading: boolean;
  error?: unknown;
};

type TicketEnvironment = { csaTicketApiUrl?: string };

const normalizeTicketValue = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

const isOpenTicket = (ticket: DashboardTicket) =>
  !['resolved', 'closed'].includes(normalizeTicketValue(ticket.status));

const isAtRiskTicket = (ticket: DashboardTicket) =>
  isOpenTicket(ticket) &&
  ['high', 'urgent'].includes(normalizeTicketValue(ticket.priority));

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
  const dispatch = useAsyncDispatch();
  const { projectKey, ticketApiUrl } = useApplicationContext<
    { projectKey?: string; ticketApiUrl: string },
    TicketEnvironment
  >((context) => ({
    projectKey: context.project?.key,
    ticketApiUrl: context.environment.csaTicketApiUrl?.trim() ?? '',
  }));
  const [ticketState, setTicketState] = useState<TicketState>({
    loading: false,
  });
  const { data, loading, error } = useMcQuery<DashboardData>(DASHBOARD_QUERY, {
    variables: { activeCartWhere: 'cartState="Active"' },
    context: { target: GRAPHQL_TARGETS.COMMERCETOOLS_PLATFORM },
    fetchPolicy: 'cache-and-network',
  });

  useEffect(() => {
    if (!ticketApiUrl || !projectKey) {
      setTicketState({ loading: false });
      return;
    }

    let isCurrentRequest = true;
    setTicketState((current) => ({
      ...current,
      loading: true,
      error: undefined,
    }));
    dispatch(
      actions.forwardTo.post({
        uri: ticketApiUrl,
        audiencePolicy: 'forward-url-origin',
        includeUserPermissions: true,
        payload: {
          limit: 100,
          offset: 0,
          sortKey: 'lastModifiedAt',
          sortOrder: 'desc',
        },
      })
    ).then(
      (response) => {
        if (!isCurrentRequest) return;
        setTicketState({ data: response as TicketPage, loading: false });
      },
      (ticketError: unknown) => {
        if (!isCurrentRequest) return;
        setTicketState({ loading: false, error: ticketError });
      }
    );

    return () => {
      isCurrentRequest = false;
    };
  }, [dispatch, projectKey, ticketApiUrl]);

  const ticketSummary = useMemo(() => {
    const tickets = ticketState.data?.results ?? [];
    const openTickets = tickets.filter(isOpenTicket);
    return {
      total: ticketState.data?.total ?? tickets.length,
      open: openTickets.length,
      atRisk: tickets.filter(isAtRiskTicket).length,
      completed: tickets.filter((ticket) =>
        ['resolved', 'closed'].includes(normalizeTicketValue(ticket.status))
      ).length,
      queue: openTickets.slice(0, 6),
      isPartial: (ticketState.data?.total ?? 0) > tickets.length,
    };
  }, [ticketState.data]);

  const applicationBase = match.url.replace(/\/dashboard$/, '');
  const ticketConfigurationError = !ticketApiUrl
    ? new Error(
        'Ticket summary is not configured. Set CSA_MC_TICKET_API_URL and redeploy this application.'
      )
    : !projectKey
    ? new Error('Select a commercetools project to load the ticket summary.')
    : undefined;

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
            <CollapsiblePanel header="Ticket summary" isDefaultClosed={false}>
              <PageState
                loading={ticketState.loading && !ticketState.data}
                error={ticketConfigurationError ?? ticketState.error}
                isEmpty={!ticketState.data}
                emptyTitle="Ticket summary unavailable"
              >
                {ticketState.data ? (
                  <Spacings.Stack scale="l">
                    <Grid
                      gridGap="16px"
                      gridTemplateColumns="repeat(4, minmax(0, 1fr))"
                    >
                      <Metric
                        label="Total tickets"
                        value={ticketSummary.total}
                        hint="Tickets in this project"
                      />
                      <Metric
                        label="Open tickets"
                        value={ticketSummary.open}
                        hint={
                          ticketSummary.isPartial
                            ? 'Active in the latest 100 tickets'
                            : 'Active and unresolved'
                        }
                      />
                      <Metric
                        label="At risk"
                        value={ticketSummary.atRisk}
                        hint={
                          ticketSummary.isPartial
                            ? 'High or urgent in the latest 100 tickets'
                            : 'Unresolved high or urgent priority'
                        }
                      />
                      <Metric
                        label="Completed tickets"
                        value={ticketSummary.completed}
                        hint={
                          ticketSummary.isPartial
                            ? 'Resolved or closed in the latest 100 tickets'
                            : 'Resolved or closed tickets'
                        }
                      />
                    </Grid>
                    <CollapsiblePanel
                      header="Active ticket queue"
                      isDefaultClosed={false}
                    >
                      <PageState
                        isEmpty={ticketSummary.queue.length === 0}
                        emptyTitle="No active tickets"
                        emptyBody="All loaded tickets are resolved or closed."
                      >
                        <DataTable<DashboardTicket>
                          columns={[
                            { key: 'ticketNumber', label: 'Ticket' },
                            { key: 'subject', label: 'Subject' },
                            { key: 'customerEmail', label: 'Customer' },
                            { key: 'status', label: 'Status' },
                            { key: 'priority', label: 'Priority' },
                            { key: 'assignee', label: 'Assignee' },
                            { key: 'lastModifiedAt', label: 'Modified' },
                          ]}
                          rows={ticketSummary.queue}
                          itemRenderer={(item, column) => {
                            if (column.key === 'customerEmail')
                              return (
                                item.customerEmail ?? item.customerName ?? '—'
                              );
                            if (column.key === 'lastModifiedAt')
                              return formatDate(
                                item.lastModifiedAt ?? item.createdAt
                              );
                            return String(
                              item[column.key as keyof DashboardTicket] ?? '—'
                            );
                          }}
                          onRowClick={(row) =>
                            history.push(
                              `${applicationBase}/tickets/${encodeURIComponent(
                                row.id
                              )}/general`,
                              { ticket: row }
                            )
                          }
                        />
                      </PageState>
                    </CollapsiblePanel>
                  </Spacings.Stack>
                ) : null}
              </PageState>
            </CollapsiblePanel>
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
                    history.push(`${applicationBase}/orders/${row.id}`)
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
