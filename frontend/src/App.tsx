import { MsalAuthProvider } from './auth/MsalAuthProvider';
import { LoginPage } from './auth/LoginPage';
import { useAuth } from './auth/useAuth';
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

function AuthenticatedApp() {
  const { isAuthenticated, isLoading, meError, logout } = useAuth();

  if (isLoading) {
    return (
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        minHeight:      '100vh',
        background:     'var(--ds-neutral-50)',
        color:          'var(--ds-neutral-400)',
        fontSize:       'var(--ds-text-sm)',
      }}>
        Verificando sesión…
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <AppRoutes>
        <LoginPage />
      </AppRoutes>
    );
  }

  if (meError) {
    return (
      <div style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            '16px',
        minHeight:      '100vh',
        background:     'var(--ds-neutral-50)',
        color:          'var(--ds-neutral-700)',
        fontSize:       'var(--ds-text-sm)',
        textAlign:      'center',
        padding:        '32px',
      }}>
        <strong style={{ fontSize: 'var(--ds-text-base)', color: 'var(--ds-error-600)' }}>
          No se pudo verificar los permisos
        </strong>
        <span style={{ color: 'var(--ds-neutral-500)', maxWidth: '420px' }}>{meError}</span>
        <button
          onClick={logout}
          style={{
            marginTop:    '8px',
            padding:      '8px 20px',
            border:       '1px solid var(--ds-neutral-300)',
            borderRadius: '6px',
            background:   'white',
            cursor:       'pointer',
            fontSize:     'var(--ds-text-sm)',
          }}
        >
          Cerrar sesión
        </button>
      </div>
    );
  }

  return (
    <AppRoutes>
      <Layout>
        <RouterView />
      </Layout>
    </AppRoutes>
  );
}

function App() {
  return (
    <MsalAuthProvider>
      <AuthenticatedApp />
    </MsalAuthProvider>
  );
}

export default App;
