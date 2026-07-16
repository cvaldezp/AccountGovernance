import { useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { useMatrixEditor } from './useMatrixEditor';
import { accessFromCell } from './types';
import { AppCard, AppPageHeader } from '../../shared/ui';
import type { CellAccess, MatrixRow, PermissionsMatrix } from './types';

// ── Role display metadata (cosmético únicamente — colores para pintar la UI,
//    no forma parte del modelo de datos, que viene 100% de gov.SystemRoles) ────

const ROLE_COLORS: Record<string, string> = {
  SystemAdmin: '#B91B1B',
  Seguridades: '#8B5CF6',
  RRHH:        '#22C55E',
  Registro:    '#3B82F6',
  DragonHelp:  '#F59E0B',
};
const DEFAULT_ROLE_COLOR = '#64748B';

function roleColor(roleKey: string): string {
  return ROLE_COLORS[roleKey] ?? DEFAULT_ROLE_COLOR;
}

// ── Cell widget ────────────────────────────────────────────────────────────────

function PermCell({
  access, editable, saving, error, onClick,
}: {
  access: CellAccess;
  editable: boolean;
  saving: boolean;
  error?: string;
  onClick?: () => void;
}) {
  const styleByAccess: Record<CellAccess, React.CSSProperties> = {
    Edit: { background: 'var(--ds-success-light)', color: 'var(--ds-success-dark)', border: '1px solid var(--ds-success-border)' },
    View: { background: 'var(--ds-info-light)',    color: 'var(--ds-info-dark)',    border: '1px solid var(--ds-info-border)' },
    None: { background: 'var(--ds-neutral-100)',    color: 'var(--ds-neutral-400)',  border: '1px solid transparent' },
  };
  const label: Record<CellAccess, string> = { Edit: '✎ Editar', View: '◉ Ver', None: '— Sin acceso' };

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
      <button
        type="button"
        onClick={onClick}
        disabled={!editable || saving}
        title={editable ? 'Click para cambiar (Sin acceso → Ver → Editar)' : undefined}
        style={{
          display:      'inline-flex',
          alignItems:   'center',
          gap:          '4px',
          padding:      '3px 10px',
          borderRadius: 'var(--ds-radius-full)',
          fontSize:     '12px',
          fontWeight:   600,
          whiteSpace:   'nowrap',
          cursor:       editable && !saving ? 'pointer' : 'default',
          opacity:      saving ? 0.5 : 1,
          ...styleByAccess[access],
        }}
      >
        {saving ? '…' : label[access]}
      </button>
      {error && (
        <span style={{ fontSize: '10px', color: 'var(--ds-danger-dark)', maxWidth: '120px', textAlign: 'center' }}>
          {error}
        </span>
      )}
    </div>
  );
}

function SummaryCard({ value, label, color, bg }: { value: number; label: string; color: string; bg: string }) {
  return (
    <div style={{ flex: 1, background: bg, border: `1px solid ${color}33`, borderRadius: 'var(--ds-radius-xl)', padding: '16px 18px', textAlign: 'center' }}>
      <div style={{ fontSize: '32px', fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '12px', color: 'var(--ds-neutral-600)', marginTop: '4px', fontWeight: 500 }}>{label}</div>
    </div>
  );
}

function rowSummary(row: MatrixRow, roles: string[]) {
  const accesses = roles.map(r => accessFromCell(row.byRole[r]));
  return {
    visible:    accesses.filter(a => a !== 'None').length,
    editable:   accesses.filter(a => a === 'Edit').length,
    restricted: accesses.filter(a => a === 'None').length,
  };
}

function roleSummary(matrix: PermissionsMatrix, roleKey: string) {
  const accesses = matrix.fields.map(f => accessFromCell(f.byRole[roleKey]));
  return {
    visible:    accesses.filter(a => a !== 'None').length,
    editable:   accesses.filter(a => a === 'Edit').length,
    restricted: accesses.filter(a => a === 'None').length,
  };
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function PermissionsMatrixPage() {
  const { user } = useAuth();
  const isSystemAdmin = user?.roles.includes('SystemAdmin') ?? false;

  const { matrix, loading, loadError, cycleCell, isSaving, cellError } = useMatrixEditor();
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const activeRole = selectedRole && matrix?.roles.includes(selectedRole) ? selectedRole : matrix?.roles[0] ?? null;
  const summary = matrix && activeRole ? roleSummary(matrix, activeRole) : null;

  return (
    <div>
      <AppPageHeader
        title="Matriz de Permisos"
        description={isSystemAdmin
          ? 'Click en una celda para cambiar su acceso: Sin acceso → Ver → Editar → Sin acceso.'
          : 'Permisos por campo y rol para los atributos AD gestionados por el portal (solo lectura).'}
      />

      {loadError && <div className="ds-alert ds-alert--error">{loadError}</div>}

      {loading || !matrix ? (
        <AppCard><div className="ds-loading">Cargando...</div></AppCard>
      ) : (
        <>
          {activeRole && summary && (
            <AppCard style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ds-neutral-500)', marginRight: '4px' }}>
                  Resumen para rol:
                </span>
                {matrix.roles.map(roleKey => {
                  const active = activeRole === roleKey;
                  const color = roleColor(roleKey);
                  return (
                    <button
                      key={roleKey}
                      onClick={() => setSelectedRole(roleKey)}
                      style={{
                        padding: '6px 16px', borderRadius: 'var(--ds-radius-full)',
                        border: active ? `2px solid ${color}` : '2px solid var(--ds-neutral-200)',
                        background: active ? `${color}18` : 'transparent',
                        color: active ? color : 'var(--ds-neutral-500)',
                        fontWeight: active ? 700 : 500, fontSize: '13px', cursor: 'pointer',
                        transition: 'all 0.15s', whiteSpace: 'nowrap',
                      }}
                    >
                      {roleKey}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <SummaryCard value={summary.visible} label="Campos visibles" color={roleColor(activeRole)} bg={`${roleColor(activeRole)}11`} />
                <SummaryCard value={summary.editable} label="Campos editables" color="var(--ds-success-dark)" bg="var(--ds-success-light)" />
                <SummaryCard value={summary.restricted} label="Sin acceso" color="var(--ds-neutral-500)" bg="var(--ds-neutral-100)" />
              </div>
            </AppCard>
          )}

          <AppCard noPadding>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--ds-neutral-100)' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ds-neutral-700)' }}>
              Matriz completa · {matrix.fields.length} campos × {matrix.roles.length} roles
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--ds-neutral-50)' }}>
                  <th style={{
                    padding: '12px 20px', textAlign: 'left', fontSize: '11px', fontWeight: 700,
                    color: 'var(--ds-neutral-500)', textTransform: 'uppercase', letterSpacing: '0.06em',
                    borderBottom: '1px solid var(--ds-neutral-200)', minWidth: '200px',
                  }}>
                    Campo AD
                  </th>

                  {matrix.roles.map(roleKey => (
                    <th
                      key={roleKey}
                      style={{
                        padding: '12px 20px', textAlign: 'center', fontSize: '12px', fontWeight: 700,
                        color: roleColor(roleKey), letterSpacing: '0.02em',
                        borderBottom: '1px solid var(--ds-neutral-200)', minWidth: '150px',
                        borderLeft: '1px solid var(--ds-neutral-100)', background: 'var(--ds-neutral-50)',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <span style={{
                          width: '28px', height: '28px', borderRadius: 'var(--ds-radius-full)',
                          background: `${roleColor(roleKey)}22`, border: `2px solid ${roleColor(roleKey)}44`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '10px', fontWeight: 900, color: roleColor(roleKey),
                        }}>
                          {roleKey.slice(0, 2).toUpperCase()}
                        </span>
                        {roleKey}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {matrix.fields.map((row, idx) => {
                  const rowStats = rowSummary(row, matrix.roles);
                  return (
                    <tr key={row.fieldKey} style={{ background: idx % 2 === 0 ? '#fff' : 'var(--ds-neutral-50)' }}>
                      <td style={{ padding: '14px 20px', borderBottom: '1px solid var(--ds-neutral-100)' }}>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ds-neutral-900)' }}>
                          {row.displayName}
                          {row.isSensitive && (
                            <span style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--ds-warning-dark)', background: 'var(--ds-warning-light)', padding: '1px 5px', borderRadius: 'var(--ds-radius-sm)', fontWeight: 600, border: '1px solid var(--ds-warning-border)' }}>
                              sensible
                            </span>
                          )}
                        </div>
                        <div style={{ fontFamily: 'var(--ds-font-mono)', fontSize: '11px', color: 'var(--ds-neutral-400)', marginTop: '2px' }}>
                          {row.adAttributeName}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--ds-neutral-400)', marginTop: '4px' }}>
                          {rowStats.visible} visible · {rowStats.editable} editable · {rowStats.restricted} sin acceso
                        </div>
                      </td>

                      {matrix.roles.map(roleKey => {
                        const access = accessFromCell(row.byRole[roleKey]);
                        const editable = isSystemAdmin && roleKey.toLowerCase() !== 'systemadmin';
                        return (
                          <td
                            key={roleKey}
                            style={{ padding: '14px 20px', textAlign: 'center', borderLeft: '1px solid var(--ds-neutral-100)', borderBottom: '1px solid var(--ds-neutral-100)' }}
                          >
                            <PermCell
                              access={access}
                              editable={editable}
                              saving={isSaving(roleKey, row.fieldKey)}
                              error={cellError(roleKey, row.fieldKey)}
                              onClick={editable ? () => void cycleCell(roleKey, row.fieldKey) : undefined}
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

          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--ds-neutral-100)', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', color: 'var(--ds-neutral-400)', fontWeight: 600, marginRight: '4px' }}>Leyenda:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <PermCell access="Edit" editable={false} saving={false} />
              <span style={{ fontSize: '11px', color: 'var(--ds-neutral-500)' }}>— puede ver y modificar el campo</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <PermCell access="View" editable={false} saving={false} />
              <span style={{ fontSize: '11px', color: 'var(--ds-neutral-500)' }}>— solo lectura, no puede editar</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <PermCell access="None" editable={false} saving={false} />
              <span style={{ fontSize: '11px', color: 'var(--ds-neutral-500)' }}>— campo oculto para este rol</span>
            </div>
            {isSystemAdmin && (
              <span style={{ fontSize: '11px', color: 'var(--ds-neutral-400)' }}>
                SystemAdmin siempre tiene acceso total y no es editable.
              </span>
            )}
          </div>
          </AppCard>
        </>
      )}
    </div>
  );
}
