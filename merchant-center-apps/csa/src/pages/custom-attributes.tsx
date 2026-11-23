import { useMcQuery } from '@commercetools-frontend/application-shell';
import { GRAPHQL_TARGETS } from '@commercetools-frontend/constants';
import DataTable from '@commercetools-uikit/data-table';
import {
  useDataTableSortingState,
  usePaginationState,
} from '@commercetools-uikit/hooks';
import { Pagination } from '@commercetools-uikit/pagination';
import Spacings from '@commercetools-uikit/spacings';
import { TYPES_QUERY } from '../graphql';
import type { QueryPage, TypeDefinition } from '../types';
import { formatDate } from '../utils';
import { ListPage, PageState } from '../components/common';

type TypesData = { typeDefinitions: QueryPage<TypeDefinition> };

const CustomAttributes = () => {
  const { page, perPage } = usePaginationState();
  const sorting = useDataTableSortingState({
    key: 'lastModifiedAt',
    order: 'desc',
  });
  const { data, loading, error } = useMcQuery<TypesData>(TYPES_QUERY, {
    variables: {
      limit: perPage.value,
      offset: (page.value - 1) * perPage.value,
      sort: [`${sorting.value.key} ${sorting.value.order}`],
    },
    context: { target: GRAPHQL_TARGETS.COMMERCETOOLS_PLATFORM },
    fetchPolicy: 'cache-and-network',
  });
  const rows = data?.typeDefinitions.results ?? [];
  return (
    <ListPage
      title="Custom Attributes"
      subtitle="Read-only browser for commercetools Types and field definitions"
    >
      <Spacings.Stack scale="l">
        <PageState
          loading={loading}
          error={error}
          isEmpty={!loading && rows.length === 0}
          emptyTitle="No Types configured"
        >
          <DataTable<TypeDefinition>
            columns={[
              { key: 'name', label: 'Type name' },
              { key: 'key', label: 'Key' },
              { key: 'resourceTypeIds', label: 'Resources' },
              { key: 'fieldDefinitions', label: 'Field definitions' },
              { key: 'createdAt', label: 'Created', isSortable: true },
              { key: 'lastModifiedAt', label: 'Modified', isSortable: true },
            ]}
            rows={rows}
            itemRenderer={(item, column) => {
              if (column.key === 'resourceTypeIds')
                return item.resourceTypeIds.join(', ');
              if (column.key === 'fieldDefinitions')
                return (
                  item.fieldDefinitions
                    .map(
                      (field) =>
                        `${field.label ?? field.name} (${field.type.name}${
                          field.required ? ', required' : ''
                        })`
                    )
                    .join('; ') || '—'
                );
              if (column.key === 'createdAt' || column.key === 'lastModifiedAt')
                return formatDate(item[column.key]);
              return String(item[column.key as 'name' | 'key'] ?? '—');
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
            totalItems={data?.typeDefinitions.total ?? 0}
            perPageRange="s"
          />
        </PageState>
      </Spacings.Stack>
    </ListPage>
  );
};

CustomAttributes.displayName = 'CustomAttributes';
export default CustomAttributes;
