import { useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { userSearchAgent } from '../../agents/UserSearchAgent';
import { AppCard, AppButton, AppInput, AppTable, AppBadge, AppPageHeader } from '../../shared/ui';
import type { Column } from '../../shared/ui';
import type { User } from '../../types';
import { useDistributionLists } from './useDistributionLists';
import type { DistributionListSummary, DistributionListMember } from './types';

const WRITE_ROLES = ['SystemAdmin', 'Seguridades'];

// ── Add member sub-flow: search existing AD users, pick one, confirm ────────────
function AddMemberPanel({
  onAdd, onCancel, adding, addError,
}: {
  onAdd:    (samAccountName: string) => Promise<boolean>;
  onCancel: () => void;
  adding:   boolean;
  addError: string | null;
}) {
  const { user: operator } = useAuth();
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [picked, setPicked]       = useState<User | null>(null);

  const handleSearch = async () => {
    if (!operator || query.trim().length < 3) {
      setSearchErr('Ingresa al menos 3 caracteres para buscar.');
      return;
    }
    setSearchErr(null);
    setSearching(true);
    setPicked(null);
    const result = await userSearchAgent.execute(query.trim(), operator.role);
    setResults(result.success ? (result.data ?? []) : []);
    if (!result.success) setSearchErr(result.error ?? 'Error al buscar usuarios.');
    setSearching(false);
  };

  const handleConfirm = async () => {
    if (!picked) return;
    const ok = await onAdd(picked.id);
    if (ok) { setPicked(null); setResults([]); setQuery(''); }
  };

  return (
    <div style={{
      padding: '14px', border: '2px solid var(--ds-success-border)',
      borderRadius: 'var(--ds-radius-lg)', background: 'var(--ds-success-light)',
      display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '12px',
    }}>
      <div style={{ fontWeight: 600, fontSize: 'var(--ds-text-sm)', color: 'var(--ds-success-dark)' }}>
        Agregar miembro existente
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <AppInput
            label="Buscar usuario en AD"
            placeholder="Código Banner, correo institucional o usuario AD"
            value={query}
            onChange={e => { setQuery(e.target.value); setSearchErr(null); }}
            onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
            autoFocus
          />
        </div>
        <AppButton variant="secondary" size="sm" onClick={handleSearch} loading={searching}>
          Buscar
        </AppButton>
      </div>

      {searchErr && <div className="ds-alert ds-alert--danger">{searchErr}</div>}

      {results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '220px', overflowY: 'auto' }}>
          {results.map(u => (
            <button
              key={u.id}
              onClick={() => setPicked(u)}
              style={{
                textAlign: 'left', padding: '8px 10px', borderRadius: 'var(--ds-radius-md)',
                border: picked?.id === u.id ? '1px solid var(--ds-brand-500)' : '1px solid var(--ds-neutral-200)',
                background: picked?.id === u.id ? 'var(--ds-brand-50)' : 'var(--ds-neutral-0)',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 'var(--ds-text-sm)' }}>{u.displayName}</div>
              <div style={{ fontSize: 'var(--ds-text-xs)', color: 'var(--ds-neutral-500)' }}>
                {u.email} — {u.username}
              </div>
            </button>
          ))}
        </div>
      )}

      {addError && <div className="ds-alert ds-alert--danger">{addError}</div>}

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <AppButton variant="secondary" size="sm" onClick={onCancel} disabled={adding}>Cancelar</AppButton>
        <AppButton variant="primary" size="sm" onClick={handleConfirm} loading={adding} disabled={!picked}>
          Agregar a la lista
        </AppButton>
      </div>
    </div>
  );
}

export function DistributionListsPage() {
  const { user } = useAuth();
  const canWrite = user?.roles.some(r => WRITE_ROLES.includes(r)) ?? false;

  const {
    query, setQuery, results, searching, searched, searchError, search,
    selectedDn, selectList,
    detail, detailLoading, detailError,
    members, membersLoading, membersError,
    addingMember, addError, addMember,
    removingDn, removeError, removeMember,
  } = useDistributionLists();

  const [showAddForm, setShowAddForm] = useState(false);

  const listColumns: Column<DistributionListSummary>[] = [
    { key: 'name', header: 'Nombre', render: l => <span style={{ fontWeight: 600 }}>{l.name}</span> },
    { key: 'mail', header: 'Correo', render: l => l.mail ?? <em style={{ color: 'var(--ds-neutral-400)' }}>Sin correo</em> },
    {
      key: 'actions', header: '', align: 'right', width: '110px',
      render: l => <AppButton size="sm" variant="secondary" onClick={() => selectList(l.dn)}>Ver detalle</AppButton>,
    },
  ];

  const memberColumns: Column<DistributionListMember>[] = [
    { key: 'displayName', header: 'Nombre' },
    { key: 'mail', header: 'Correo', render: m => m.mail ?? <em style={{ color: 'var(--ds-neutral-400)' }}>Sin correo</em> },
    {
      key: 'samAccountName', header: 'Cuenta',
      render: m => <span style={{ fontFamily: 'var(--ds-font-mono)', fontSize: 'var(--ds-text-xs)' }}>{m.samAccountName}</span>,
    },
    ...(canWrite ? [{
      key: 'actions', header: '', align: 'right' as const, width: '100px',
      render: (m: DistributionListMember) => (
        <AppButton
          size="sm" variant="ghost"
          style={{ color: 'var(--ds-danger-main)' }}
          loading={removingDn === m.dn}
          onClick={() => removeMember(m.dn)}
        >
          Eliminar
        </AppButton>
      ),
    }] : []),
  ];

  return (
    <div>
      <AppPageHeader
        title="Listas de Distribución"
        description="Busca listas de distribución de Active Directory y administra sus miembros"
      />

      <AppCard style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <AppInput
            placeholder="Nombre o correo de la lista de distribución"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') search(); }}
            autoFocus
            style={{ flex: 1 }}
          />
          <AppButton variant="primary" onClick={search} loading={searching}>Buscar</AppButton>
        </div>
      </AppCard>

      {searchError && <div className="ds-alert ds-alert--danger" style={{ marginBottom: '16px' }}>{searchError}</div>}

      {!searching && !searchError && searched && results.length === 0 && (
        <div className="ds-alert ds-alert--info" style={{ marginBottom: '16px' }}>
          No se encontraron listas de distribución para &ldquo;{query}&rdquo;
        </div>
      )}

      {(results.length > 0 || (searching && searched)) && (
        <AppCard title={searching ? 'Buscando...' : `${results.length} resultado(s)`} noPadding style={{ marginBottom: '16px' }}>
          <AppTable
            columns={listColumns}
            data={results}
            loading={searching}
            keyExtractor={l => l.dn}
            emptyMessage="Sin resultados"
            onRowClick={l => selectList(l.dn)}
          />
        </AppCard>
      )}

      {selectedDn && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '16px', alignItems: 'start' }}>
          <AppCard title="Detalle">
            {detailLoading ? (
              <div className="ds-loading">Cargando detalle...</div>
            ) : detailError ? (
              <div className="ds-alert ds-alert--danger">{detailError}</div>
            ) : detail ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { label: 'Nombre', value: detail.name },
                  { label: 'Correo', value: detail.mail ?? '—' },
                  { label: 'Descripción', value: detail.description ?? '—' },
                  { label: 'Manager', value: detail.managerDisplayName ?? '—' },
                ].map(f => (
                  <div key={f.label}>
                    <div style={{ fontSize: 'var(--ds-text-xs)', fontWeight: 700, color: 'var(--ds-neutral-500)', textTransform: 'uppercase' }}>
                      {f.label}
                    </div>
                    <div style={{ fontSize: 'var(--ds-text-sm)', color: 'var(--ds-neutral-800)' }}>{f.value}</div>
                  </div>
                ))}
                <div>
                  <div style={{ fontSize: 'var(--ds-text-xs)', fontWeight: 700, color: 'var(--ds-neutral-500)', textTransform: 'uppercase' }}>
                    Miembros
                  </div>
                  <AppBadge variant="brand">{detail.memberCount}</AppBadge>
                </div>
              </div>
            ) : null}
          </AppCard>

          <AppCard
            title="Miembros"
            action={canWrite && !showAddForm && (
              <AppButton variant="secondary" size="sm" onClick={() => setShowAddForm(true)}>
                + Agregar miembro
              </AppButton>
            )}
          >
            {showAddForm && (
              <AddMemberPanel
                adding={addingMember}
                addError={addError}
                onCancel={() => setShowAddForm(false)}
                onAdd={async account => {
                  const ok = await addMember(account);
                  if (ok) setShowAddForm(false);
                  return ok;
                }}
              />
            )}

            {removeError && <div className="ds-alert ds-alert--danger" style={{ marginBottom: '12px' }}>{removeError}</div>}
            {membersError && <div className="ds-alert ds-alert--danger">{membersError}</div>}

            <AppTable
              columns={memberColumns}
              data={members}
              loading={membersLoading}
              keyExtractor={m => m.dn}
              emptyMessage="Esta lista no tiene miembros."
            />
          </AppCard>
        </div>
      )}
    </div>
  );
}
