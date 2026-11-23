import { useEffect, useMemo, useState } from 'react';
import {
  Switch,
  useHistory,
  useLocation,
  useParams,
  useRouteMatch,
} from 'react-router-dom';
import { SuspendedRoute } from '@commercetools-frontend/application-shell';
import { useApplicationContext } from '@commercetools-frontend/application-shell-connectors';
import {
  TabHeader,
  TabularDetailPage,
} from '@commercetools-frontend/application-components';
import { actions, useAsyncDispatch } from '@commercetools-frontend/sdk';
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
import { KeyValueGrid, ListPage, PageState } from '../components/common';
import { ticketFromDetailResponse } from '../ticket-response';
import { formatDate } from '../utils';

type WorklogComment = {
  id: string;
  comment: string;
  createdAt: string;
  status: string;
  author?: string | null;
};

type TicketAttachment = {
  name: string;
  url: string;
  size?: string | null;
};

type TicketHistoryEntry = {
  id: string;
  ticketNumber: string;
  operationDate: string;
  reason: string;
  solution?: string | null;
  status: string;
  priority: string;
  assignedTo: string;
  worklog?: string | null;
  timeSpent?: string | null;
};

type Ticket = {
  id: string;
  ticketNumber: string;
  projectKey: string;
  customerName?: string | null;
  customerEmail?: string | null;
  customerId?: string | null;
  source?: string | null;
  status: string;
  priority: string;
  category?: string | null;
  subject: string;
  assignee?: string | null;
  createdAt?: string | null;
  lastModifiedAt?: string | null;
  resolutionDate?: string | null;
  contactType?: string | null;
  orderNumber?: string | null;
  createdBy?: string | null;
  message?: string | null;
  solution?: string | null;
  timeSpentOnTicket?: string | null;
  comments?: WorklogComment[];
  attachments?: TicketAttachment[];
  history?: TicketHistoryEntry[];
};

type TicketPage = {
  results: Ticket[];
  total: number;
  count: number;
  offset: number;
};

type AsyncState<T> = {
  data?: T;
  loading: boolean;
  error?: unknown;
};

type TicketEnvironment = { csaTicketApiUrl?: string };

const useTicketEnvironment = () =>
  useApplicationContext<
    { projectKey?: string; ticketApiUrl: string },
    TicketEnvironment
  >((context) => ({
    projectKey: context.project?.key,
    ticketApiUrl: context.environment.csaTicketApiUrl?.trim() ?? '',
  }));

const getConfigurationError = (ticketApiUrl: string, projectKey?: string) => {
  if (!ticketApiUrl) {
    return new Error(
      'Ticket integration is not configured. Set CSA_MC_TICKET_API_URL and redeploy this application.'
    );
  }

  if (!projectKey) {
    return new Error('Select a commercetools project to load tickets.');
  }

  return undefined;
};

const Tickets = () => {
  const match = useRouteMatch();
  const history = useHistory();

  return (
    <Switch>
      <SuspendedRoute path={`${match.path}/:ticketId`}>
        <TicketDetail onClose={() => history.push(match.url)} />
      </SuspendedRoute>
      <SuspendedRoute>
        <TicketList baseUrl={match.url} />
      </SuspendedRoute>
    </Switch>
  );
};

const TicketList = (props: { baseUrl: string }) => {
  const dispatch = useAsyncDispatch();
  const history = useHistory();
  const { projectKey, ticketApiUrl } = useTicketEnvironment();
  const { page, perPage } = usePaginationState();
  const sorting = useDataTableSortingState({
    key: 'lastModifiedAt',
    order: 'desc',
  });
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [state, setState] = useState<AsyncState<TicketPage>>({
    loading: false,
  });

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      300
    );
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (!ticketApiUrl || !projectKey) {
      setState({ loading: false });
      return;
    }

    let isCurrentRequest = true;
    setState((current) => ({ ...current, loading: true, error: undefined }));
    dispatch(
      actions.forwardTo.post({
        uri: ticketApiUrl,
        audiencePolicy: 'forward-url-origin',
        includeUserPermissions: true,
        payload: {
          search: debouncedSearch || undefined,
          limit: perPage.value,
          offset: (page.value - 1) * perPage.value,
          sortKey: sorting.value.key,
          sortOrder: sorting.value.order,
        },
      })
    ).then(
      (response) => {
        if (!isCurrentRequest) return;
        setState({ data: response as TicketPage, loading: false });
      },
      (error: unknown) => {
        if (!isCurrentRequest) return;
        setState({ loading: false, error });
      }
    );

    return () => {
      isCurrentRequest = false;
    };
  }, [
    debouncedSearch,
    dispatch,
    page.value,
    perPage.value,
    projectKey,
    sorting.value.key,
    sorting.value.order,
    ticketApiUrl,
  ]);

  const rows = useMemo(() => state.data?.results ?? [], [state.data?.results]);
  const configurationError = getConfigurationError(ticketApiUrl, projectKey);

  return (
    <ListPage
      title="Tickets"
      subtitle="Customer-service tickets stored by the CSA ticketing service"
    >
      <Spacings.Stack scale="l">
        <TextField
          name="ticket-search"
          title="Search tickets"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            page.onChange(1);
          }}
          placeholder="Ticket number, subject, customer, email, order, or assignee"
          horizontalConstraint={10}
        />
        <PageState
          loading={state.loading}
          error={configurationError ?? state.error}
          isEmpty={!state.loading && !state.error && rows.length === 0}
          emptyTitle="No tickets found"
          emptyBody="No tickets match this project and search value."
        >
          <DataTable<Ticket>
            columns={[
              { key: 'ticketNumber', label: 'Ticket', isSortable: true },
              { key: 'subject', label: 'Subject', isSortable: true },
              { key: 'customer', label: 'Customer' },
              { key: 'status', label: 'Status', isSortable: true },
              { key: 'priority', label: 'Priority', isSortable: true },
              { key: 'category', label: 'Category', isSortable: true },
              { key: 'assignee', label: 'Assignee', isSortable: true },
              {
                key: 'lastModifiedAt',
                label: 'Modified',
                isSortable: true,
              },
            ]}
            rows={rows}
            itemRenderer={(item, column) => {
              if (column.key === 'customer')
                return item.customerName ?? item.customerEmail ?? '—';
              if (column.key === 'lastModifiedAt')
                return formatDate(item.lastModifiedAt);
              return String(item[column.key as keyof Ticket] ?? '—');
            }}
            sortedBy={sorting.value.key}
            sortDirection={sorting.value.order}
            onSortChange={sorting.onChange}
            onRowClick={(row) =>
              history.push(
                `${props.baseUrl}/${encodeURIComponent(row.id)}/general`,
                { ticket: row }
              )
            }
          />
          <Pagination
            page={page.value}
            onPageChange={page.onChange}
            perPage={perPage.value}
            onPerPageChange={perPage.onChange}
            totalItems={state.data?.total ?? 0}
            perPageRange="s"
          />
        </PageState>
      </Spacings.Stack>
    </ListPage>
  );
};

const TicketDetail = (props: { onClose: () => void }) => {
  const dispatch = useAsyncDispatch();
  const { ticketId } = useParams<{ ticketId: string }>();
  const location = useLocation<{ ticket?: Ticket }>();
  const match = useRouteMatch();
  const { projectKey, ticketApiUrl } = useTicketEnvironment();
  const routeTicket =
    location.state?.ticket?.id === ticketId ? location.state.ticket : undefined;
  const [state, setState] = useState<AsyncState<Ticket>>({
    data: routeTicket,
    loading: false,
  });
  const base = match.url.replace(
    /\/(general|conversation|attachments|history)$/,
    ''
  );

  useEffect(() => {
    if (!ticketApiUrl || !projectKey || !ticketId) {
      setState({ loading: false });
      return;
    }

    let isCurrentRequest = true;
    setState((current) => ({ ...current, loading: true, error: undefined }));
    dispatch(
      actions.forwardTo.post({
        uri: ticketApiUrl,
        audiencePolicy: 'forward-url-origin',
        includeUserPermissions: true,
        payload: { ticketId },
      })
    ).then(
      (response) => {
        if (!isCurrentRequest) return;
        const ticket = ticketFromDetailResponse(response, ticketId) as
          | Ticket
          | undefined;
        if (ticket) {
          setState({ data: ticket, loading: false });
          return;
        }

        if (routeTicket) {
          setState({ data: routeTicket, loading: false });
          return;
        }

        setState({
          loading: false,
          error: new Error(
            'The ticket detail API is not available in the deployed BFF. Deploy or restart the BFF containing the single-ticket endpoint.'
          ),
        });
      },
      (error: unknown) => {
        if (!isCurrentRequest) return;
        setState({ loading: false, error });
      }
    );

    return () => {
      isCurrentRequest = false;
    };
  }, [dispatch, projectKey, routeTicket, ticketApiUrl, ticketId]);

  const ticket = state.data;
  const configurationError = getConfigurationError(ticketApiUrl, projectKey);

  return (
    <TabularDetailPage
      title={ticket?.ticketNumber ?? 'Ticket'}
      subtitle={ticket?.subject ?? ticketId}
      previousPathLabel="Go to View tickets"
      onPreviousPathClick={props.onClose}
      tabControls={
        <>
          <TabHeader to={`${base}/general`} label="General" />
          <TabHeader to={`${base}/conversation`} label="Conversation" />
          <TabHeader to={`${base}/attachments`} label="Attachments" />
          <TabHeader to={`${base}/history`} label="History" />
        </>
      }
      hideControls
    >
      <PageState
        loading={state.loading}
        error={configurationError ?? state.error}
        isEmpty={!state.loading && !state.error && !ticket}
        emptyTitle="Ticket not found"
      >
        {ticket ? (
          <Switch>
            <SuspendedRoute path={`${base}/conversation`}>
              <TicketConversation ticket={ticket} />
            </SuspendedRoute>
            <SuspendedRoute path={`${base}/attachments`}>
              <TicketAttachments ticket={ticket} />
            </SuspendedRoute>
            <SuspendedRoute path={`${base}/history`}>
              <TicketHistory ticket={ticket} />
            </SuspendedRoute>
            <SuspendedRoute>
              <TicketGeneral ticket={ticket} />
            </SuspendedRoute>
          </Switch>
        ) : null}
      </PageState>
    </TabularDetailPage>
  );
};

const TicketGeneral = (props: { ticket: Ticket }) => (
  <Spacings.Stack scale="xl">
    <CollapsiblePanel header="Ticket summary" isDefaultClosed={false}>
      <Grid gridGap="24px" gridTemplateColumns="repeat(2, minmax(0, 1fr))">
        <Grid.Item>
          <KeyValueGrid
            items={[
              { label: 'Ticket number', value: props.ticket.ticketNumber },
              { label: 'Subject', value: props.ticket.subject },
              { label: 'Status', value: props.ticket.status },
              { label: 'Priority', value: props.ticket.priority },
              { label: 'Category', value: props.ticket.category ?? '—' },
              { label: 'Source', value: props.ticket.source ?? '—' },
              { label: 'Contact type', value: props.ticket.contactType ?? '—' },
            ]}
          />
        </Grid.Item>
        <Grid.Item>
          <KeyValueGrid
            items={[
              { label: 'Assignee', value: props.ticket.assignee ?? '—' },
              { label: 'Created by', value: props.ticket.createdBy ?? '—' },
              { label: 'Created', value: formatDate(props.ticket.createdAt) },
              {
                label: 'Modified',
                value: formatDate(props.ticket.lastModifiedAt),
              },
              {
                label: 'Resolved',
                value: formatDate(props.ticket.resolutionDate),
              },
              {
                label: 'Time spent',
                value: props.ticket.timeSpentOnTicket ?? '—',
              },
              { label: 'Ticket ID', value: props.ticket.id },
            ]}
          />
        </Grid.Item>
      </Grid>
    </CollapsiblePanel>

    <CollapsiblePanel header="Customer context" isDefaultClosed={false}>
      <Grid gridGap="24px" gridTemplateColumns="repeat(2, minmax(0, 1fr))">
        <Grid.Item>
          <KeyValueGrid
            items={[
              { label: 'Customer', value: props.ticket.customerName ?? '—' },
              { label: 'Email', value: props.ticket.customerEmail ?? '—' },
            ]}
          />
        </Grid.Item>
        <Grid.Item>
          <KeyValueGrid
            items={[
              { label: 'Customer ID', value: props.ticket.customerId ?? '—' },
              { label: 'Order number', value: props.ticket.orderNumber ?? '—' },
            ]}
          />
        </Grid.Item>
      </Grid>
    </CollapsiblePanel>

    <TicketTextSection title="Customer message" value={props.ticket.message} />
    <TicketTextSection title="Resolution" value={props.ticket.solution} />
  </Spacings.Stack>
);

const TicketTextSection = (props: { title: string; value?: string | null }) => (
  <CollapsiblePanel header={props.title} isDefaultClosed={false}>
    <Text.Body>
      <span style={{ whiteSpace: 'pre-wrap' }}>{props.value || '—'}</span>
    </Text.Body>
  </CollapsiblePanel>
);

const TicketConversation = (props: { ticket: Ticket }) => {
  const comments = props.ticket.comments ?? [];
  return (
    <PageState
      isEmpty={comments.length === 0}
      emptyTitle="No conversation entries"
      emptyBody="No worklog comments have been recorded for this ticket."
    >
      <DataTable<WorklogComment>
        columns={[
          { key: 'createdAt', label: 'Date' },
          { key: 'author', label: 'Author' },
          { key: 'status', label: 'Status' },
          { key: 'comment', label: 'Comment' },
        ]}
        rows={comments}
        itemRenderer={(item, column) => {
          if (column.key === 'createdAt') return formatDate(item.createdAt);
          return String(item[column.key as keyof WorklogComment] ?? '—');
        }}
      />
    </PageState>
  );
};

const TicketAttachments = (props: { ticket: Ticket }) => {
  const attachments = (props.ticket.attachments ?? []).map(
    (attachment, index) => ({
      ...attachment,
      id: `${index}-${attachment.url}`,
    })
  );
  return (
    <PageState
      isEmpty={attachments.length === 0}
      emptyTitle="No attachments"
      emptyBody="No files are attached to this ticket."
    >
      <DataTable<TicketAttachment & { id: string }>
        columns={[
          { key: 'name', label: 'File' },
          { key: 'size', label: 'Size' },
          { key: 'url', label: 'Link' },
        ]}
        rows={attachments}
        itemRenderer={(item, column) => {
          if (column.key === 'url')
            return (
              <a href={item.url} target="_blank" rel="noreferrer">
                Open attachment
              </a>
            );
          return String(item[column.key as keyof TicketAttachment] ?? '—');
        }}
      />
    </PageState>
  );
};

const TicketHistory = (props: { ticket: Ticket }) => {
  const history = props.ticket.history ?? [];
  return (
    <PageState
      isEmpty={history.length === 0}
      emptyTitle="No ticket history"
      emptyBody="No historical changes have been recorded for this ticket."
    >
      <DataTable<TicketHistoryEntry>
        columns={[
          { key: 'operationDate', label: 'Date' },
          { key: 'reason', label: 'Reason' },
          { key: 'status', label: 'Status' },
          { key: 'priority', label: 'Priority' },
          { key: 'assignedTo', label: 'Assigned to' },
          { key: 'worklog', label: 'Worklog' },
          { key: 'timeSpent', label: 'Time spent' },
        ]}
        rows={history}
        itemRenderer={(item, column) => {
          if (column.key === 'operationDate')
            return formatDate(item.operationDate);
          return String(item[column.key as keyof TicketHistoryEntry] ?? '—');
        }}
      />
    </PageState>
  );
};

Tickets.displayName = 'Tickets';
export default Tickets;
