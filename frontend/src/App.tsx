import { MockAuthProvider } from './auth/MockAuthProvider';
import { AppRoutes, useRouter } from './routes/AppRoutes';
import { Layout } from './components/layout/Layout';
import { DashboardPage } from './modules/dashboard/DashboardPage';
import { SearchUserPage } from './modules/users/SearchUserPage';
import { UserDetailPage } from './modules/users/UserDetailPage';
import { AuditPage } from './modules/audit/AuditPage';
import { AttributeCatalogPage } from './modules/permissions/AttributeCatalogPage';
import { PermissionsMatrixPage } from './modules/permissions/PermissionsMatrixPage';
import { CreateAccountPage } from './modules/account-creation/CreateAccountPage';
import { AccountTypeConfigPage } from './modules/account-type-config/AccountTypeConfigPage';
import { InitialGroupsPage } from './modules/initial-groups/InitialGroupsPage';

function RouterView() {
  const { currentRoute } = useRouter();

  switch (currentRoute) {
    case 'dashboard':        return <DashboardPage />;
    case 'search':           return <SearchUserPage />;
    case 'user-detail':      return <UserDetailPage />;
    case 'audit':            return <AuditPage />;
    case 'account-creation': return <CreateAccountPage />;
    case 'attribute-catalog':   return <AttributeCatalogPage />;
    case 'permissions-matrix':  return <PermissionsMatrixPage />;
    case 'account-type-config': return <AccountTypeConfigPage />;
    case 'initial-groups':      return <InitialGroupsPage />;
    default:                 return <DashboardPage />;
  }
}

function App() {
  return (
    <MockAuthProvider>
      <AppRoutes>
        <Layout>
          <RouterView />
        </Layout>
      </AppRoutes>
    </MockAuthProvider>
  );
}

export default App;
