import { useAudit, PAGE_SIZE } from './useAudit';
import { getFieldDefinitions } from '../../api/adFieldMatrix';
import { ROLES_CONFIG } from '../../config/roles.config';
import { AppButton, AppCard, AppBadge, AppPageHeader, AppInput } from '../../shared/ui';
import type { AuditActionType } from '../../types/audit';
import type { RoleName } from '../../types';

// ── Constants ─────────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<AuditActionType, string> = {
  UpdateField:                   'Actualización',
  EnableAccount:                 'Habilitación',
  DisableAccount:                'Deshabilitación',
  DistributionListMemberAdded:   'Agregado a lista de distribución',
  DistributionListMemberRemoved: 'Removido de lista de distribución',
  CreateAttribute:               'Atributo creado',
  UpdateAttribute:               'Atributo editado',
  ActivateAttribute:             'Atributo activado',
  DeactivateAttribute:           'Atributo inactivado',
  UpdateRolePermission:          'Permiso de rol editado',
};

const ACTION_VARIANT: Record<AuditActionType, 'info' | 'success' | 'warning'> = {
  UpdateField:                   'info',
  EnableAccount:                 'success',
  DisableAccount:                'warning',
  DistributionListMemberAdded:   'success',
  DistributionListMemberRemoved: 'warning',
  CreateAttribute:               'success',
  UpdateAttribute:               'info',
  ActivateAttribute:             'success',
  DeactivateAttribute:           'warning',
  UpdateRolePermission:          'info',
};

const DOMAIN_COLOR: Record<string, string> = {
  'USFQ.EDU.EC': '#3B82F6',
  'ASIG.EDU.EC': '#8B5CF6',
};

const TH_STYLE: React.CSSProperties = {
  padding:       '10px 14px',
  textAlign:     'left',
  fontSize:      '11px',
  fontWeight:    700,
  color:         'var(--ds-neutral-500)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  borderBottom:  '1px solid var(--ds-neutral-200)',
  whiteSpace:    'nowrap',
  background:    'var(--ds-neutral-50)',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-EC', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function fieldDisplayName(fieldKey: string | undefined): string {
  if (!fieldKey) return '—';
  const def = getFieldDefinitions().find(
    f => f.adAttributeName === fieldKey || f.fieldKey === fieldKey,
  );
  return def?.displayName ?? fieldKey;
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AuditPage() {
  const {
    loading, loadError,
    filtered, pageData, page, setPage, totalPages, resetPage,
    filterUser, setFilterUser,
    filterAction, setFilterAction,
    filterRole, setFilterRole,
    filterDateFrom, setFilterDateFrom,
    filterDateTo, setFilterDateTo,
    handleClear, hasFilters,
  } = useAudit();

  return (
    <div>
      <AppPageHeader
        title="Auditoría"
        description="Registro completo de operaciones realizadas sobre cuentas de usuario Active Directory"
      />

      {loadError && <div className="ds-alert ds-alert--error">{loadError}</div>}

      {/* Filters */}
      <AppCard title="Filtros" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>

          <AppInput
            label="Usuario u operador"
            placeholder="Ej: jdoe, Ana García"
            value={filterUser}
            onChange={e => { setFilterUser(e.target.value); resetPage(); }}
            wrapperClassName=""
            style={{ flex: '1 1 160px' } as React.CSSProperties}
          />

          <div className="ds-input" style={{ flex: '1 1 150px' }}>
            <label className="ds-input__label">Acción</label>
            <select
              className="ds-input__field"
              value={filterAction}
              onChange={e => { setFilterAction(e.target.value as AuditActionType | ''); resetPage(); }}
            >
              <option value="">Todas</option>
              {(Object.keys(ACTION_LABELS) as AuditActionType[]).map(action => (
                <option key={action} value={action}>{ACTION_LABELS[action]}</option>
              ))}
            </select>
          </div>

          <div className="ds-input" style={{ flex: '1 1 150px' }}>
            <label className="ds-input__label">Rol del operador</label>
            <select
              className="ds-input__field"
              value={filterRole}
              onChange={e => { setFilterRole(e.target.value as RoleName | ''); resetPage(); }}
            >
              <option value="">Todos</option>
              {ROLES_CONFIG.map(r => (
                <option key={r.name} value={r.name}>{r.displayName}</option>
              ))}
            </select>
          </div>

          <div className="ds-input" style={{ flex: '1 1 140px' }}>
            <label className="ds-input__label">Desde</label>
            <input
              type="date"
              className="ds-input__field"
              value={filterDateFrom}
              onChange={e => { setFilterDateFrom(e.target.value); resetPage(); }}
            />
          </div>

          <div className="ds-input" style={{ flex: '1 1 140px' }}>
            <label className="ds-input__label">Hasta</label>
            <input
              type="date"
              className="ds-input__field"
              value={filterDateTo}
              onChange={e => { setFilterDateTo(e.target.value); resetPage(); }}
            />
          </div>

          {hasFilters && (
            <AppButton variant="secondary" onClick={handleClear}>Limpiar filtros</AppButton>
          )}
        </div>
      </AppCard>

      {/* Results table */}
      <AppCard noPadding>
        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--ds-neutral-100)' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ds-neutral-700)' }}>
            {loading ? 'Cargando...' : `${filtered.length} registro(s)`}
          </span>
          {!loading && filtered.length > PAGE_SIZE && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--ds-neutral-400)' }}>
                Pág. {page + 1} / {totalPages}
              </span>
              <AppButton size="sm" variant="secondary" onClick={() => setPage(p => p - 1)} disabled={page === 0}>
                ‹ Ant.
              </AppButton>
              <AppButton size="sm" variant="secondary" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>
                Sig. ›
              </AppButton>
            </div>
          )}
        </div>

        {/* Body */}
        {loading ? (
          <div className="ds-loading" style={{ padding: '40px', textAlign: 'center' }}>Cargando registros...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ds-neutral-400)', fontSize: '14px' }}>
            No hay registros para los filtros seleccionados
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  {['Fecha', 'Operador', 'Rol', 'Acción', 'Usuario', 'Dominio', 'Campo', 'Cambio', 'Estado'].map(h => (
                    <th key={h} style={TH_STYLE}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageData.map((entry, idx) => {
                  const roleConf    = ROLES_CONFIG.find(r => r.name === entry.roleName);
                  const domainColor = DOMAIN_COLOR[entry.domain] ?? '#64748B';
                  return (
                    <tr key={entry.id} style={{ background: idx % 2 === 0 ? '#fff' : 'var(--ds-neutral-50)' }}>

                      <td style={{ padding: '10px 14px', color: 'var(--ds-neutral-500)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                        {formatDate(entry.timestamp)}
                      </td>

                      <td style={{ padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {entry.performedBy}
                      </td>

                      <td style={{ padding: '10px 14px' }}>
                        <AppBadge
                          variant="info"
                          style={{ background: `${roleConf?.color ?? '#3b82f6'}22`, color: roleConf?.color ?? '#2563eb', whiteSpace: 'nowrap' }}
                        >
                          {roleConf?.displayName ?? entry.roleName}
                        </AppBadge>
                      </td>

                      <td style={{ padding: '10px 14px' }}>
                        <AppBadge variant={ACTION_VARIANT[entry.actionType] ?? 'info'}>
                          {ACTION_LABELS[entry.actionType] ?? entry.actionType}
                        </AppBadge>
                      </td>

                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontFamily: 'var(--ds-font-mono)', fontSize: '12px' }}>{entry.targetUser}</span>
                      </td>

                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          fontFamily:   'var(--ds-font-mono)',
                          fontSize:     '11px',
                          fontWeight:   600,
                          color:        domainColor,
                          background:   `${domainColor}18`,
                          padding:      '2px 6px',
                          borderRadius: 'var(--ds-radius-sm)',
                          whiteSpace:   'nowrap',
                        }}>
                          {entry.domain}
                        </span>
                      </td>

                      <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--ds-neutral-600)', whiteSpace: 'nowrap' }}>
                        {fieldDisplayName(entry.fieldKey)}
                      </td>

                      <td style={{ padding: '10px 14px', fontSize: '12px', maxWidth: '200px' }}>
                        {entry.oldValue !== undefined && entry.newValue !== undefined ? (
                          <span>
                            <span style={{ textDecoration: 'line-through', color: 'var(--ds-neutral-400)', marginRight: '4px' }}>
                              {entry.oldValue || '(vacío)'}
                            </span>
                            {' → '}
                            <span>{entry.newValue || '(vacío)'}</span>
                          </span>
                        ) : (
                          <span style={{ color: 'var(--ds-neutral-300)' }}>—</span>
                        )}
                      </td>

                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <AppBadge variant={entry.success ? 'success' : 'danger'}>
                          {entry.success ? 'OK' : 'Error'}
                        </AppBadge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Bottom pagination */}
        {!loading && filtered.length > PAGE_SIZE && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid var(--ds-neutral-100)' }}>
            <span style={{ fontSize: '12px', color: 'var(--ds-neutral-500)' }}>
              Mostrando {page * PAGE_SIZE + 1}&ndash;{Math.min((page + 1) * PAGE_SIZE, filtered.length)} de {filtered.length}
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <AppButton size="sm" variant="secondary" onClick={() => setPage(0)} disabled={page === 0}>« Primera</AppButton>
              <AppButton size="sm" variant="secondary" onClick={() => setPage(p => p - 1)} disabled={page === 0}>‹ Anterior</AppButton>
              <AppButton size="sm" variant="secondary" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>Siguiente ›</AppButton>
              <AppButton size="sm" variant="secondary" onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}>Última »</AppButton>
            </div>
          </div>
        )}
      </AppCard>
    </div>
  );
}
