import { useHistory, useRouteMatch } from 'react-router-dom';
import { useMcQuery } from '@commercetools-frontend/application-shell';
import { GRAPHQL_TARGETS } from '@commercetools-frontend/constants';
import DataTable from '@commercetools-uikit/data-table';
import {
  useDataTableSortingState,
  usePaginationState,
} from '@commercetools-uikit/hooks';
import { Pagination } from '@commercetools-uikit/pagination';
import Spacings from '@commercetools-uikit/spacings';
import { RETURNS_QUERY } from '../graphql';
import type { Order, QueryPage } from '../types';
import { formatDate } from '../utils';
import { ListPage, PageState } from '../components/common';

type ReturnsData = { orders: QueryPage<Order> };

const Returns = () => {
  const match = useRouteMatch();
  const history = useHistory();
  const { page, perPage } = usePaginationState();
  const sorting = useDataTableSortingState({
    key: 'lastModifiedAt',
    order: 'desc',
  });
  const { data, loading, error } = useMcQuery<ReturnsData>(RETURNS_QUERY, {
    variables: {
      limit: perPage.value,
      offset: (page.value - 1) * perPage.value,
      sort: [`${sorting.value.key} ${sorting.value.order}`],
    },
    context: { target: GRAPHQL_TARGETS.COMMERCETOOLS_PLATFORM },
    fetchPolicy: 'cache-and-network',
  });
  const rows = data?.orders.results ?? [];
  return (
    <ListPage
      title="Returns"
      subtitle="Orders containing commercetools return information"
    >
      <Spacings.Stack scale="l">
        <PageState
          loading={loading}
          error={error}
          isEmpty={!loading && rows.length === 0}
          emptyTitle="No returns found"
        >
          <DataTable<Order>
            columns={[
              { key: 'orderNumber', label: 'Order' },
              { key: 'customerEmail', label: 'Customer' },
              { key: 'tracking', label: 'Return tracking' },
              { key: 'items', label: 'Quantity' },
              { key: 'returnDate', label: 'Return date' },
              { key: 'lastModifiedAt', label: 'Modified', isSortable: true },
            ]}
            rows={rows}
            itemRenderer={(item, column) => {
              if (column.key === 'orderNumber')
                return item.orderNumber ?? item.id;
              if (column.key === 'tracking')
                return (
                  item.returnInfo
                    ?.map((info) => info.returnTrackingId)
                    .filter(Boolean)
                    .join(', ') || '—'
                );
              if (column.key === 'items')
                return String(
                  item.returnInfo
                    ?.flatMap((info) => info.items)
                    .reduce((total, row) => total + row.quantity, 0) ?? 0
                );
              if (column.key === 'returnDate')
                return formatDate(item.returnInfo?.[0]?.returnDate);
              if (column.key === 'lastModifiedAt')
                return formatDate(item.lastModifiedAt);
              return item.customerEmail ?? '—';
            }}
            sortedBy={sorting.value.key}
            sortDirection={sorting.value.order}
            onSortChange={sorting.onChange}
            onRowClick={(row) =>
              history.push(
                `${match.url.replace(/\/returns$/, '')}/orders/${
                  row.id
                }/returns`
              )
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

Returns.displayName = 'Returns';
export default Returns;
