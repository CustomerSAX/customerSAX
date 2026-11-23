import { lazy, type ReactNode } from 'react';
import { Redirect, Route, Switch, useRouteMatch } from 'react-router-dom';
import { PageUnauthorized } from '@commercetools-frontend/application-components';
import { SuspendedRoute } from '@commercetools-frontend/application-shell';
import { useIsAuthorized } from '@commercetools-frontend/permissions';
import Spacings from '@commercetools-uikit/spacings';
import { PERMISSIONS } from './constants';

const Dashboard = lazy(() => import('./pages/dashboard'));
const Customers = lazy(() => import('./pages/customers'));
const Carts = lazy(() => import('./pages/carts'));
const Orders = lazy(() => import('./pages/orders'));
const Returns = lazy(() => import('./pages/returns'));
const Products = lazy(() => import('./pages/products'));
const Tickets = lazy(() => import('./pages/tickets'));
const KnowledgeBase = lazy(() => import('./pages/knowledge-base'));
const CustomAttributes = lazy(() => import('./pages/custom-attributes'));
const ImportPage = lazy(() =>
  import('./pages/data-management').then((module) => ({
    default: module.ImportPage,
  }))
);
const ExportPage = lazy(() =>
  import('./pages/data-management').then((module) => ({
    default: module.ExportPage,
  }))
);

const Authorized = (props: { permission: string; children: ReactNode }) => {
  const isAuthorized = useIsAuthorized({
    demandedPermissions: [props.permission],
  });
  return isAuthorized ? <>{props.children}</> : <PageUnauthorized />;
};

const ApplicationRoutes = () => {
  const match = useRouteMatch();
  return (
    <Spacings.Inset scale="l">
      <Switch>
        <Route exact path={match.path}>
          <Redirect to={`${match.url}/dashboard`} />
        </Route>
        <SuspendedRoute path={`${match.path}/dashboard`}>
          <Authorized permission={PERMISSIONS.View}>
            <Dashboard />
          </Authorized>
        </SuspendedRoute>
        <SuspendedRoute path={`${match.path}/customers`}>
          <Authorized permission={PERMISSIONS.ViewCustomers}>
            <Customers />
          </Authorized>
        </SuspendedRoute>
        <SuspendedRoute path={`${match.path}/carts`}>
          <Authorized permission={PERMISSIONS.ViewCarts}>
            <Carts />
          </Authorized>
        </SuspendedRoute>
        <SuspendedRoute path={`${match.path}/orders`}>
          <Authorized permission={PERMISSIONS.ViewOrders}>
            <Orders />
          </Authorized>
        </SuspendedRoute>
        <SuspendedRoute path={`${match.path}/returns`}>
          <Authorized permission={PERMISSIONS.ViewOrders}>
            <Returns />
          </Authorized>
        </SuspendedRoute>
        <SuspendedRoute path={`${match.path}/products`}>
          <Authorized permission={PERMISSIONS.ViewProducts}>
            <Products />
          </Authorized>
        </SuspendedRoute>
        <SuspendedRoute path={`${match.path}/tickets`}>
          <Authorized permission={PERMISSIONS.View}>
            <Tickets />
          </Authorized>
        </SuspendedRoute>
        <SuspendedRoute path={`${match.path}/import`}>
          <Authorized permission={PERMISSIONS.ViewImportExport}>
            <ImportPage />
          </Authorized>
        </SuspendedRoute>
        <SuspendedRoute path={`${match.path}/export`}>
          <Authorized permission={PERMISSIONS.ViewImportExport}>
            <ExportPage />
          </Authorized>
        </SuspendedRoute>
        <SuspendedRoute path={`${match.path}/custom-attributes`}>
          <Authorized permission={PERMISSIONS.ViewCustomAttributes}>
            <CustomAttributes />
          </Authorized>
        </SuspendedRoute>
        <SuspendedRoute path={`${match.path}/knowledge-base`}>
          <Authorized permission={PERMISSIONS.View}>
            <KnowledgeBase />
          </Authorized>
        </SuspendedRoute>
        <Route>
          <Redirect to={`${match.url}/dashboard`} />
        </Route>
      </Switch>
    </Spacings.Inset>
  );
};

ApplicationRoutes.displayName = 'ApplicationRoutes';
export default ApplicationRoutes;
