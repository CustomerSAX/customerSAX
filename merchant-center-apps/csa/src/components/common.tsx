import type { ReactNode } from 'react';
import { Link as RouterLink, useRouteMatch } from 'react-router-dom';
import {
  TabHeader,
  TabularMainPage,
} from '@commercetools-frontend/application-components';
import DataTable from '@commercetools-uikit/data-table';
import FlatButton from '@commercetools-uikit/flat-button';
import { BackIcon } from '@commercetools-uikit/icons';
import LoadingSpinner from '@commercetools-uikit/loading-spinner';
import { ContentNotification } from '@commercetools-uikit/notifications';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import { formatCustomValue, getErrorMessage } from '../utils';
import type { RawCustomField } from '../types';

export const PageState = (props: {
  loading?: boolean;
  error?: unknown;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyBody?: string;
  children: ReactNode;
}) => {
  if (props.loading) return <LoadingSpinner />;
  if (props.error) {
    return (
      <ContentNotification type="error">
        <Text.Body>{getErrorMessage(props.error)}</Text.Body>
      </ContentNotification>
    );
  }
  if (props.isEmpty) {
    return (
      <ContentNotification type="info">
        <Text.Body>
          <strong>{props.emptyTitle ?? 'No results'}</strong>
        </Text.Body>
        {props.emptyBody ? <Text.Body>{props.emptyBody}</Text.Body> : null}
      </ContentNotification>
    );
  }
  return <>{props.children}</>;
};

export const ListPage = (props: {
  title: string;
  subtitle: string;
  children: ReactNode;
  controls?: ReactNode;
}) => {
  const match = useRouteMatch();
  return (
    <TabularMainPage
      title={props.title}
      subtitle={props.subtitle}
      tabControls={
        <TabHeader to={match.url} label={props.title} exactPathMatch />
      }
      formControls={props.controls}
      hideControls={!props.controls}
    >
      {props.children}
    </TabularMainPage>
  );
};

export const BackLink = (props: { to: string; label: string }) => (
  <FlatButton
    as={RouterLink}
    to={props.to}
    label={props.label}
    icon={<BackIcon />}
  />
);

export const KeyValueGrid = (props: {
  items: Array<{ label: string; value: ReactNode }>;
}) => (
  <Spacings.Stack scale="m">
    {props.items.map((item) => (
      <Spacings.Inline key={item.label} scale="m" alignItems="flex-start">
        <div style={{ minWidth: 180 }}>
          <Text.Detail isBold>{item.label}</Text.Detail>
        </div>
        <Text.Body>{item.value ?? '—'}</Text.Body>
      </Spacings.Inline>
    ))}
  </Spacings.Stack>
);

export const CustomFieldsTable = (props: {
  fields?: RawCustomField[] | null;
}) => {
  const rows = props.fields ?? [];
  const tableRows = rows.map((field) => ({ ...field, id: field.name }));
  return (
    <PageState
      isEmpty={rows.length === 0}
      emptyTitle="No custom attributes"
      emptyBody="This resource has no custom fields."
    >
      <DataTable<RawCustomField & { id: string }>
        columns={[
          { key: 'name', label: 'Field' },
          { key: 'value', label: 'Value' },
        ]}
        rows={tableRows}
        itemRenderer={(item, column) =>
          column.key === 'name' ? item.name : formatCustomValue(item.value)
        }
      />
    </PageState>
  );
};
