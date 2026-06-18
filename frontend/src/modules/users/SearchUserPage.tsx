import { useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { useRouter } from '../../routes/AppRoutes';
import { userSearchAgent } from '../../agents/UserSearchAgent';
import { AppButton, AppCard, AppInput, AppTable, AppBadge, AppPageHeader } from '../../shared/ui';
import type { Column } from '../../shared/ui';
import type { User } from '../../types';

const MIN_QUERY_LENGTH = 3;

export function SearchUserPage() {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const handleSearch = async () => {
    if (!user) return;
    const q = query.trim();

    if (q.length < MIN_QUERY_LENGTH) {
      setError(`Ingresa al menos ${MIN_QUERY_LENGTH} caracteres para buscar.`);
      return;
    }

    setError(null);
    setLoading(true);
    setSearched(true);
    setResults([]);

    const result = await userSearchAgent.execute(q, user.role);

    if (!result.success) {
      setError(
        result.errorCode === 'TOO_MANY_RESULTS'
          ? 'La búsqueda devuelve demasiados resultados. Ingresa el Código Banner, correo completo o usuario AD exacto.'
          : (result.error ?? 'Error al realizar la búsqueda. Intenta de nuevo.'),
      );
    } else {
      setResults(result.data ?? []);
    }

    setLoading(false);
  };

  const columns: Column<User>[] = [
    {
      key: 'username',
      header: 'Usuario',
      width: '140px',
      render: u => (
        <span style={{ fontFamily: 'var(--ds-font-mono)', fontSize: '13px' }}>{u.username}</span>
      ),
    },
    {
      key: 'displayName',
      header: 'Nombre',
      render: u => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="user-avatar" style={{ width: '32px', height: '32px', fontSize: '13px', flexShrink: 0 }}>
            {u.displayName.split(' ').map(w => w[0]).slice(0, 2).join('')}
          </div>
          <div>
            <div style={{ fontWeight: 500 }}>{u.displayName}</div>
            <div style={{ fontSize: '12px', color: 'var(--ds-neutral-500)' }}>{u.email}</div>
          </div>
        </div>
      ),
    },
    { key: 'department', header: 'Departamento' },
    {
      key: 'jobTitle',
      header: 'Cargo',
      render: u => (
        <span style={{ color: 'var(--ds-neutral-500)', fontSize: '13px' }}>{u.jobTitle}</span>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      align: 'center',
      render: u => (
        <AppBadge variant={u.attributes.AccountStatus === 'Enabled' ? 'success' : 'danger'}>
          {u.attributes.AccountStatus === 'Enabled' ? 'Activo' : 'Inactivo'}
        </AppBadge>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '110px',
      render: u => (
        <AppButton
          size="sm"
          variant="secondary"
          onClick={e => {
              e.stopPropagation();
              console.debug(`[AccountGovernance] Navigating to user detail with samAccountName: ${u.id}`);
              navigate('user-detail', { userId: u.id });
            }}
        >
          Ver detalle
        </AppButton>
      ),
    },
  ];

  return (
    <div>
      <AppPageHeader
        title="Buscar Usuario"
        description="Busca por Código Banner, correo institucional o usuario AD"
      />

      <AppCard style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <AppInput
            placeholder="Código Banner, correo institucional o usuario AD"
            value={query}
            onChange={e => { setQuery(e.target.value); if (error) setError(null); }}
            onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
            autoFocus
            wrapperClassName="search-input-wrapper"
            style={{ flex: 1 }}
          />
          <AppButton variant="primary" onClick={handleSearch} loading={loading}>
            Buscar
          </AppButton>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--ds-neutral-400)' }}>
          Puedes buscar por Código Banner, correo institucional completo o usuario AD.
        </p>
      </AppCard>

      {error && (
        <div className={`ds-alert ds-alert--${error.includes('demasiados') ? 'warning' : 'danger'}`}
          style={{ marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {!loading && !error && searched && results.length === 0 && (
        <div className="ds-alert ds-alert--info">
          No se encontraron usuarios para &ldquo;{query}&rdquo;
        </div>
      )}

      {(results.length > 0 || (loading && searched)) && (
        <AppCard
          title={loading ? 'Buscando...' : `${results.length} resultado(s)`}
          noPadding
        >
          <AppTable
            columns={columns}
            data={results}
            loading={loading}
            keyExtractor={u => u.id}
            emptyMessage="Sin resultados"
            onRowClick={u => {
              console.debug(`[AccountGovernance] Navigating to user detail with samAccountName: ${u.id}`);
              navigate('user-detail', { userId: u.id });
            }}
          />
        </AppCard>
      )}
    </div>
  );
}
