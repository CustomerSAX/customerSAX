import { useState } from 'react';
import { InfoMainPage } from '@commercetools-frontend/application-components';
import { useMcLazyQuery } from '@commercetools-frontend/application-shell';
import { GRAPHQL_TARGETS } from '@commercetools-frontend/constants';
import { useIsAuthorized } from '@commercetools-frontend/permissions';
import DataTable from '@commercetools-uikit/data-table';
import { ContentNotification } from '@commercetools-uikit/notifications';
import PrimaryButton from '@commercetools-uikit/primary-button';
import SelectField from '@commercetools-uikit/select-field';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import { CARTS_QUERY, CUSTOMERS_QUERY, ORDERS_QUERY } from '../graphql';
import { PERMISSIONS } from '../constants';
import type { Cart, Customer, Order, QueryPage } from '../types';
import {
  downloadCsv,
  parseCsvPreview,
  rowsToCsv,
  type CsvPreview,
} from '../utils';

type Resource = 'customers' | 'orders' | 'carts';
const resourceOptions = [
  { value: 'customers', label: 'Customers' },
  { value: 'orders', label: 'Orders' },
  { value: 'carts', label: 'Carts' },
];

export const ExportPage = () => {
  const [resource, setResource] = useState<Resource>('customers');
  const [fetchCustomers, customersState] = useMcLazyQuery<{
    customers: QueryPage<Customer>;
  }>(CUSTOMERS_QUERY);
  const [fetchOrders, ordersState] = useMcLazyQuery<{
    orders: QueryPage<Order>;
  }>(ORDERS_QUERY);
  const [fetchCarts, cartsState] = useMcLazyQuery<{ carts: QueryPage<Cart> }>(
    CARTS_QUERY
  );
  const loading =
    customersState.loading || ordersState.loading || cartsState.loading;

  const exportData = async () => {
    const common = {
      variables: {
        limit: 500,
        offset: 0,
        sort: ['createdAt desc'],
        where: undefined,
      },
      context: { target: GRAPHQL_TARGETS.COMMERCETOOLS_PLATFORM },
      fetchPolicy: 'network-only' as const,
    };
    if (resource === 'customers') {
      const result = await fetchCustomers(common);
      const headers = [
        'id',
        'customerNumber',
        'email',
        'firstName',
        'lastName',
        'companyName',
        'isEmailVerified',
        'createdAt',
        'lastModifiedAt',
      ];
      downloadCsv(
        'csa-customers.csv',
        rowsToCsv(headers, result.data?.customers.results ?? [])
      );
    } else if (resource === 'orders') {
      const result = await fetchOrders(common);
      const headers = [
        'id',
        'orderNumber',
        'customerId',
        'customerEmail',
        'orderState',
        'paymentState',
        'shipmentState',
        'createdAt',
        'lastModifiedAt',
      ];
      downloadCsv(
        'csa-orders.csv',
        rowsToCsv(headers, result.data?.orders.results ?? [])
      );
    } else {
      const result = await fetchCarts({
        ...common,
        variables: { ...common.variables, sort: ['lastModifiedAt desc'] },
      });
      const headers = [
        'id',
        'key',
        'customerId',
        'customerEmail',
        'cartState',
        'totalLineItemQuantity',
        'createdAt',
        'lastModifiedAt',
      ];
      downloadCsv(
        'csa-carts.csv',
        rowsToCsv(headers, result.data?.carts.results ?? [])
      );
    }
  };

  return (
    <InfoMainPage
      title="Export"
      subtitle="Download UTF-8 CSV data using the logged-in Merchant Center session"
    >
      <Spacings.Stack scale="l">
        <ContentNotification type="info">
          <Text.Body>
            Exports are capped at 500 records per download. Apply project-side
            segmentation for larger operational exports.
          </Text.Body>
        </ContentNotification>
        <SelectField
          name="resource"
          title="Resource"
          value={resource}
          options={resourceOptions}
          onChange={(event) => setResource(event.target.value as Resource)}
          horizontalConstraint={8}
        />
        <PrimaryButton
          label={loading ? 'Generating…' : 'Generate CSV'}
          onClick={() => void exportData()}
          isDisabled={loading}
        />
      </Spacings.Stack>
    </InfoMainPage>
  );
};

export const ImportPage = () => {
  const [resource, setResource] = useState<Resource>('customers');
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [fileName, setFileName] = useState('');
  const canManage = useIsAuthorized({
    demandedPermissions: [PERMISSIONS.ManageImportExport],
  });
  const requiredHeaders: Record<Resource, string[]> = {
    customers: ['email', 'firstName', 'lastName'],
    orders: ['orderNumber'],
    carts: ['customerEmail', 'currency'],
  };

  const loadFile = async (file?: File) => {
    if (!file) return;
    setFileName(file.name);
    const parsed = parseCsvPreview(await file.text());
    const missing = requiredHeaders[resource].filter(
      (header) => !parsed.headers.includes(header)
    );
    setPreview({
      ...parsed,
      errors: [
        ...parsed.errors,
        ...missing.map((header) => `Missing required header: ${header}.`),
      ],
    });
  };

  const downloadTemplate = () => {
    const headers = requiredHeaders[resource];
    downloadCsv(`csa-${resource}-import-template.csv`, rowsToCsv(headers, []));
  };

  return (
    <InfoMainPage
      title="Import"
      subtitle="Validate and preview CSV files before any data-changing operation"
    >
      <Spacings.Stack scale="l">
        <ContentNotification type="warning">
          <Text.Body>
            CSV execution is intentionally disabled until the standalone CSA
            import backend is deployed and configured for Merchant Center
            exchange-token validation. No browser-side client secret or unsafe
            bulk mutation is used.
          </Text.Body>
        </ContentNotification>
        <SelectField
          name="resource"
          title="Resource"
          value={resource}
          options={resourceOptions}
          onChange={(event) => {
            setResource(event.target.value as Resource);
            setPreview(null);
          }}
          horizontalConstraint={8}
        />
        <Spacings.Inline scale="m">
          <PrimaryButton label="Download template" onClick={downloadTemplate} />
          <label>
            <Text.Body>Choose UTF-8 CSV</Text.Body>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => void loadFile(event.target.files?.[0])}
            />
          </label>
        </Spacings.Inline>
        {preview ? (
          <Spacings.Stack scale="m">
            <Text.Subheadline as="h4">Preview: {fileName}</Text.Subheadline>
            {preview.errors.length > 0 ? (
              <ContentNotification type="error">
                <Text.Body>{preview.errors.join(' ')}</Text.Body>
              </ContentNotification>
            ) : (
              <ContentNotification type="success">
                <Text.Body>
                  {preview.rows.length} data rows passed structural validation.
                </Text.Body>
              </ContentNotification>
            )}
            <DataTable
              columns={preview.headers.map((header, index) => ({
                key: String(index),
                label: header,
              }))}
              rows={preview.rows
                .slice(0, 20)
                .map((values, index) => ({ id: String(index), values }))}
              itemRenderer={(item, column) =>
                item.values[Number(column.key)] ?? ''
              }
            />
            <PrimaryButton
              label="Execute import"
              onClick={() => undefined}
              isDisabled
            />
            {!canManage ? (
              <Text.Detail tone="secondary">
                Manage Import/Export permission is required.
              </Text.Detail>
            ) : (
              <Text.Detail tone="secondary">
                Execution becomes available when CSA_MC_IMPORT_API_URL is
                configured with the secured import service.
              </Text.Detail>
            )}
          </Spacings.Stack>
        ) : null}
      </Spacings.Stack>
    </InfoMainPage>
  );
};
