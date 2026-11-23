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
import { useApplicationContext } from '@commercetools-frontend/application-shell-connectors';
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
import { ListPage, PageState, KeyValueGrid } from '../components/common';
import { PRODUCT_DETAIL_QUERY, PRODUCTS_QUERY } from '../graphql';
import type {
  LocalizedValue,
  Product,
  ProductVariant,
  QueryPage,
} from '../types';
import { formatCustomValue, formatDate, formatMoney } from '../utils';

type ProductsData = { products: QueryPage<Product> };
type ProductDetailData = { product: Product | null };
type ProductVariantRow = Omit<ProductVariant, 'id'> & {
  id: string;
  variantId: number;
};

const localizedText = (values: LocalizedValue[] | undefined, locale: string) =>
  values?.find((item) => item.locale === locale)?.value ??
  values?.find((item) => item.locale === locale.split('-')[0])?.value ??
  values?.[0]?.value ??
  '—';

const productName = (product: Product, locale: string) =>
  localizedText(product.masterData.current.nameAllLocales, locale);

const variantPrice = (variant?: Pick<ProductVariant, 'prices'>) =>
  variant?.prices?.[0]?.value ? formatMoney(variant.prices[0].value) : '—';

const Products = () => {
  const match = useRouteMatch();
  const history = useHistory();
  return (
    <Switch>
      <SuspendedRoute path={`${match.path}/:id`}>
        <ProductDetail onClose={() => history.push(match.url)} />
      </SuspendedRoute>
      <SuspendedRoute>
        <ProductList baseUrl={match.url} />
      </SuspendedRoute>
    </Switch>
  );
};

const ProductList = (props: { baseUrl: string }) => {
  const history = useHistory();
  const locale = useApplicationContext(
    (context) => context.dataLocale ?? context.project?.languages?.[0] ?? 'en'
  );
  const { page, perPage } = usePaginationState();
  const sorting = useDataTableSortingState({
    key: 'lastModifiedAt',
    order: 'desc',
  });
  const [search, setSearch] = useState('');
  const { data, loading, error } = useMcQuery<ProductsData>(PRODUCTS_QUERY, {
    variables: {
      limit: perPage.value,
      offset: (page.value - 1) * perPage.value,
      sort: [`${sorting.value.key} ${sorting.value.order}`],
    },
    context: { target: GRAPHQL_TARGETS.COMMERCETOOLS_PLATFORM },
    fetchPolicy: 'cache-and-network',
  });
  const rows = useMemo<Product[]>(() => {
    const value = search.trim().toLocaleLowerCase();
    const products: Product[] = data?.products.results ?? [];
    if (!value) return products;
    return products.filter((product) => {
      const current = product.masterData.current;
      return [
        product.id,
        product.key,
        product.productType.name,
        ...current.nameAllLocales.map((item) => item.value),
        ...(current.descriptionAllLocales ?? []).map((item) => item.value),
        ...current.allVariants.flatMap((variant) => [variant.sku, variant.key]),
      ].some((candidate) =>
        String(candidate ?? '')
          .toLocaleLowerCase()
          .includes(value)
      );
    });
  }, [data?.products.results, search]);

  return (
    <ListPage
      title="Products"
      subtitle="B2C product catalogue and variant availability"
    >
      <Spacings.Stack scale="l">
        <TextField
          name="product-search"
          title="Search products on this page"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Name, description, product key, SKU, or ID"
          horizontalConstraint={10}
        />
        <PageState
          loading={loading}
          error={error}
          isEmpty={!loading && rows.length === 0}
          emptyTitle="No products found"
        >
          <DataTable<Product>
            columns={[
              { key: 'name', label: 'Product' },
              { key: 'productType', label: 'Product type' },
              { key: 'key', label: 'Key' },
              { key: 'sku', label: 'Master SKU' },
              { key: 'price', label: 'Price' },
              { key: 'published', label: 'Status' },
              {
                key: 'lastModifiedAt',
                label: 'Modified',
                isSortable: true,
              },
            ]}
            rows={rows}
            itemRenderer={(item, column) => {
              const master = item.masterData.current.masterVariant;
              if (column.key === 'name') return productName(item, locale);
              if (column.key === 'productType') return item.productType.name;
              if (column.key === 'sku') return master?.sku ?? '—';
              if (column.key === 'price') return variantPrice(master);
              if (column.key === 'published')
                return item.masterData.published ? 'Published' : 'Unpublished';
              if (column.key === 'lastModifiedAt')
                return formatDate(item.lastModifiedAt);
              return item.key ?? '—';
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
            totalItems={data?.products.total ?? 0}
            perPageRange="s"
          />
        </PageState>
      </Spacings.Stack>
    </ListPage>
  );
};

const ProductDetail = (props: { onClose: () => void }) => {
  const { id } = useParams<{ id: string }>();
  const match = useRouteMatch();
  const locale = useApplicationContext(
    (context) => context.dataLocale ?? context.project?.languages?.[0] ?? 'en'
  );
  const { data, loading, error } = useMcQuery<ProductDetailData>(
    PRODUCT_DETAIL_QUERY,
    {
      variables: { id },
      context: { target: GRAPHQL_TARGETS.COMMERCETOOLS_PLATFORM },
      fetchPolicy: 'cache-and-network',
    }
  );
  const product = data?.product;
  const base = match.url.replace(/\/(general|variants)$/, '');
  return (
    <TabularDetailPage
      title={product ? productName(product, locale) : 'Product'}
      subtitle={product?.key ?? id}
      previousPathLabel="Go to View products"
      onPreviousPathClick={props.onClose}
      tabControls={
        <>
          <TabHeader to={`${base}/general`} label="General" />
          <TabHeader to={`${base}/variants`} label="Variants" />
        </>
      }
      hideControls
    >
      <PageState
        loading={loading}
        error={error}
        isEmpty={product === null}
        emptyTitle="Product not found"
      >
        {product ? (
          <Switch>
            <Route exact path={base}>
              <Redirect to={`${base}/general`} />
            </Route>
            <SuspendedRoute path={`${base}/general`}>
              <ProductGeneral product={product} locale={locale} />
            </SuspendedRoute>
            <SuspendedRoute path={`${base}/variants`}>
              <ProductVariants product={product} />
            </SuspendedRoute>
            <Redirect to={`${base}/general`} />
          </Switch>
        ) : null}
      </PageState>
    </TabularDetailPage>
  );
};

const ProductGeneral = (props: { product: Product; locale: string }) => {
  const current = props.product.masterData.current;
  return (
    <Spacings.Stack scale="xl">
      <CollapsiblePanel header="General information" isDefaultClosed={false}>
        <Grid gridGap="24px" gridTemplateColumns="repeat(2, minmax(0, 1fr))">
          <Grid.Item>
            <KeyValueGrid
              items={[
                {
                  label: 'Product name',
                  value: localizedText(current.nameAllLocales, props.locale),
                },
                { label: 'Product key', value: props.product.key ?? '—' },
                {
                  label: 'Product type',
                  value: props.product.productType.name,
                },
                {
                  label: 'Status',
                  value: props.product.masterData.published
                    ? 'Published'
                    : 'Unpublished',
                },
              ]}
            />
          </Grid.Item>
          <Grid.Item>
            <KeyValueGrid
              items={[
                { label: 'Price mode', value: props.product.priceMode ?? '—' },
                {
                  label: 'Tax category',
                  value: props.product.taxCategory?.name ?? '—',
                },
                {
                  label: 'Created',
                  value: formatDate(props.product.createdAt),
                },
                {
                  label: 'Modified',
                  value: formatDate(props.product.lastModifiedAt),
                },
              ]}
            />
          </Grid.Item>
        </Grid>
      </CollapsiblePanel>
      <CollapsiblePanel header="Description" isDefaultClosed={false}>
        <Text.Body>
          {localizedText(current.descriptionAllLocales, props.locale)}
        </Text.Body>
      </CollapsiblePanel>
      <CollapsiblePanel header="Categories" isDefaultClosed>
        <Text.Body>
          {current.categories
            ?.map((category) => category.name ?? category.id)
            .join(', ') || '—'}
        </Text.Body>
      </CollapsiblePanel>
    </Spacings.Stack>
  );
};

const ProductVariants = (props: { product: Product }) => (
  <PageState
    isEmpty={props.product.masterData.current.allVariants.length === 0}
    emptyTitle="No variants"
  >
    <DataTable<ProductVariantRow>
      columns={[
        { key: 'id', label: 'Variant ID' },
        { key: 'sku', label: 'SKU' },
        { key: 'key', label: 'Key' },
        { key: 'price', label: 'Price' },
        { key: 'stock', label: 'Inventory' },
        { key: 'attributes', label: 'Attributes' },
      ]}
      rows={props.product.masterData.current.allVariants.map((variant) => ({
        ...variant,
        id: String(variant.id),
        variantId: variant.id,
      }))}
      itemRenderer={(item, column) => {
        if (column.key === 'price') return variantPrice(item);
        if (column.key === 'stock') {
          const availability = item.availability?.noChannel;
          if (availability?.availableQuantity != null)
            return String(availability.availableQuantity);
          if (availability?.isOnStock != null)
            return availability.isOnStock ? 'In stock' : 'Out of stock';
          return '—';
        }
        if (column.key === 'attributes')
          return (
            item.attributesRaw
              ?.map(
                (attribute) =>
                  `${attribute.name}: ${formatCustomValue(attribute.value)}`
              )
              .join('; ') || '—'
          );
        if (column.key === 'id') return String(item.variantId);
        return String(item[column.key as 'sku' | 'key'] ?? '—');
      }}
    />
  </PageState>
);

Products.displayName = 'Products';
export default Products;
