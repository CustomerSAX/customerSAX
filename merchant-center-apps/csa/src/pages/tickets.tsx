import { useEffect, useMemo, useState } from 'react';
import { useApplicationContext } from '@commercetools-frontend/application-shell-connectors';
import { actions, useAsyncDispatch } from '@commercetools-frontend/sdk';
import DataTable from '@commercetools-uikit/data-table';
import {
  useDataTableSortingState,
  usePaginationState,
} from '@commercetools-uikit/hooks';
import { Pagination } from '@commercetools-uikit/pagination';
import Spacings from '@commercetools-uikit/spacings';
import TextField from '@commercetools-uikit/text-field';
import { ListPage, PageState } from '../components/common';
import { formatDate } from '../utils';

type Ticket = {
  id: string;
  ticketNumber: string;
  projectKey: string;
  customerName?: string | null;
  customerEmail?: string | null;
  source?: string | null;
  status: string;
  priority: string;
  category?: string | null;
  subject: string;
  assignee?: string | null;
  createdAt?: string | null;
  lastModifiedAt?: string | null;
};

type TicketPage = {
  results: Ticket[];
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

const Tickets = () => {
  const dispatch = useAsyncDispatch();
  const { projectKey, ticketApiUrl } = useApplicationContext<
    { projectKey?: string; ticketApiUrl: string },
    TicketEnvironment
  >((context) => ({
    projectKey: context.project?.key,
    ticketApiUrl: context.environment.csaTicketApiUrl?.trim() ?? '',
  }));
  const { page, perPage } = usePaginationState();
  const sorting = useDataTableSortingState({
    key: 'lastModifiedAt',
    order: 'desc',
  });
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [state, setState] = useState<TicketState>({ loading: false });

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
  const configurationError = !ticketApiUrl
    ? new Error(
        'Ticket integration is not configured. Set CSA_MC_TICKET_API_URL and redeploy this application.'
      )
    : !projectKey
      ? new Error('Select a commercetools project to load tickets.')
      : undefined;

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
          emptyBody="No MongoDB tickets match this project and search value."
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

Tickets.displayName = 'Tickets';
export default Tickets;
