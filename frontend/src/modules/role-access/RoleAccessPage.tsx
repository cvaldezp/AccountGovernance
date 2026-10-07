import { AppCard, AppPageHeader } from '../../shared/ui';
import { useRoleAccess } from './useRoleAccess';
import type { RoleAccessResource, RoleAccessRole } from './roleAccessApi';

type CellState = 'granted' | 'denied' | 'inert' | 'always' | 'locked' | 'needs-module';

const CELL_STYLE: Record<CellState, React.CSSProperties> = {
  granted:        { background: 'var(--ds-success-light)', color: 'var(--ds-success-dark)', border: '1px solid var(--ds-success-border)' },
  denied:         { background: 'var(--ds-neutral-100)',   color: 'var(--ds-neutral-400)',  border: '1px solid transparent' },
  inert:          { background: 'var(--ds-warning-light)', color: 'var(--ds-warning-dark)', border: '1px solid var(--ds-warning-border)' },
  always:         { background: 'var(--ds-info-light)',    color: 'var(--ds-info-dark)',    border: '1px solid var(--ds-info-border)' },
  locked:         { background: 'transparent',             color: 'var(--ds-neutral-300)',  border: '1px dashed var(--ds-neutral-200)' },
  'needs-module': { background: 'transparent',             color: 'var(--ds-neutral-300)',  border: '1px dashed var(--ds-neutral-200)' },
};

const CELL_LABEL: Record<CellState, string> = {
  granted:        '✓ Acceso',
  denied:         '— Sin acceso',
  inert:          '✓ Sin módulo',
  always:         '✓ Siempre',
  locked:         'Solo SystemAdmin',
  'needs-module': '— Sin acceso',
};

const CELL_TITLE: Record<CellState, string> = {
  granted:        'Click para quitar el acceso',
  denied:         'Click para otorgar el acceso',
  inert:          'Otorgada, pero sin efecto: el rol no tiene el módulo. Click para quitarla.',
  always:         'SystemAdmin tiene acceso a todo siempre.',
  locked:         'Define la autorización de otros roles — no se puede delegar.',
  'needs-module': 'Primero otorga el módulo a este rol.',
};

const LEGEND: [CellState, string][] = [
  ['granted', 'el rol tiene el acceso'],
  ['denied',  'sin acceso'],
  ['inert',   'acción otorgada pero sin efecto: falta el módulo'],
  ['always',  'SystemAdmin, siempre'],
  ['locked',  'no delegable'],
];

function AccessCell({ state, saving, error, onClick }: {
  state: CellState; saving: boolean; error?: string; onClick?: () => void;
}) {
  const clickable = !!onClick && !saving;
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
      <button
        type="button"
        onClick={onClick}
        disabled={!clickable}
        title={CELL_TITLE[state]}
        style={{
          padding: '3px 10px', borderRadius: 'var(--ds-radius-full)', fontSize: '12px', fontWeight: 600,
          whiteSpace: 'nowrap', cursor: clickable ? 'pointer' : 'default', opacity: saving ? 0.5 : 1,
          ...CELL_STYLE[state],
        }}
      >
        {saving ? '…' : CELL_LABEL[state]}
      </button>
      {error && (
        <span style={{ fontSize: '10px', color: 'var(--ds-danger-dark)', maxWidth: '140px', textAlign: 'center' }}>
          {error}
        </span>
      )}
    </div>
  );
}

/** Módulos en su SortOrder, cada uno seguido de sus acciones/pestañas. */
function orderedRows(resources: RoleAccessResource[]): RoleAccessResource[] {
  const modules  = resources.filter(r => r.parentKey === null);
  const children = resources.filter(r => r.parentKey !== null);
  return modules.flatMap(m => [m, ...children.filter(c => c.parentKey === m.resourceKey)]);
}

export function RoleAccessPage() {
  const { matrix, loading, loadError, isGranted, toggle, isSaving, cellError } = useRoleAccess();

  function stateFor(role: RoleAccessRole, res: RoleAccessResource): CellState {
    if (role.isSystemAdmin) return 'always';
    if (res.systemAdminOnly) return 'locked';
    const granted = isGranted(role.roleKey, res.resourceKey);
    if (res.parentKey === null) return granted ? 'granted' : 'denied';
    const hasModule = isGranted(role.roleKey, res.parentKey);
    if (granted) return hasModule ? 'granted' : 'inert';
    return hasModule ? 'denied' : 'needs-module';
  }

  const editable = (state: CellState) => state === 'granted' || state === 'denied' || state === 'inert';

  return (
    <div>
      <AppPageHeader
        title="Accesos por Rol"
        description="Qué módulos y acciones del portal puede usar cada rol. Click en una celda para otorgar o quitar el acceso."
      />

      <div className="ds-alert ds-alert--info" style={{ marginBottom: '16px' }}>
        Los cambios se aplican cuando el usuario recarga el portal o vuelve a iniciar sesión.
        Por ahora controlan el menú, las pantallas y los botones; la validación en la API se activa
        en la siguiente fase.
      </div>

      {loadError && <div className="ds-alert ds-alert--error">{loadError}</div>}

      {loading || !matrix ? (
        <AppCard><div className="ds-loading">Cargando...</div></AppCard>
      ) : (
        <AppCard noPadding>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--ds-neutral-50)' }}>
                  <th style={{
                    padding: '12px 20px', textAlign: 'left', fontSize: '11px', fontWeight: 700,
                    color: 'var(--ds-neutral-500)', textTransform: 'uppercase', letterSpacing: '0.06em',
                    borderBottom: '1px solid var(--ds-neutral-200)', minWidth: '240px',
                  }}>
                    Módulo / acción
                  </th>
                  {matrix.roles.map(role => (
                    <th key={role.roleKey} style={{
                      padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 700,
                      color: 'var(--ds-neutral-700)', borderBottom: '1px solid var(--ds-neutral-200)',
                      borderLeft: '1px solid var(--ds-neutral-100)', minWidth: '130px',
                    }}>
                      {role.roleKey}
                      <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--ds-neutral-400)' }}>{role.displayName}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orderedRows(matrix.resources).map((res, idx) => {
                  const isChild = res.parentKey !== null;
                  return (
                    <tr key={res.resourceKey} style={{ background: idx % 2 === 0 ? '#fff' : 'var(--ds-neutral-50)' }}>
                      <td style={{
                        padding: '12px 20px', paddingLeft: isChild ? '44px' : '20px',
                        borderBottom: '1px solid var(--ds-neutral-100)',
                      }}>
                        <div style={{ fontWeight: isChild ? 500 : 600, color: 'var(--ds-neutral-900)' }}>
                          {isChild && <span style={{ color: 'var(--ds-neutral-300)', marginRight: '6px' }}>↳</span>}
                          {res.displayName}
                        </div>
                        {res.description && (
                          <div style={{ fontSize: '11px', color: 'var(--ds-neutral-400)', marginTop: '2px' }}>{res.description}</div>
                        )}
                      </td>
                      {matrix.roles.map(role => {
                        const state = stateFor(role, res);
                        return (
                          <td key={role.roleKey} style={{
                            padding: '12px 16px', textAlign: 'center',
                            borderLeft: '1px solid var(--ds-neutral-100)', borderBottom: '1px solid var(--ds-neutral-100)',
                          }}>
                            <AccessCell
                              state={state}
                              saving={isSaving(role.roleKey, res.resourceKey)}
                              error={cellError(role.roleKey, res.resourceKey)}
                              onClick={editable(state) ? () => void toggle(role.roleKey, res.resourceKey) : undefined}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--ds-neutral-100)', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--ds-neutral-400)', fontWeight: 600 }}>Leyenda:</span>
            {LEGEND.map(([state, text]) => (
              <div key={state} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AccessCell state={state} saving={false} />
                <span style={{ fontSize: '11px', color: 'var(--ds-neutral-500)' }}>— {text}</span>
              </div>
            ))}
          </div>
        </AppCard>
      )}
    </div>
  );
}
