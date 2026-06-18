import { useState } from 'react';
import { AD_FIELD_DEFINITIONS } from '../../config/adFieldDefinitions';
import { ROLE_AD_FIELD_PERMISSIONS } from '../../config/roleFieldPermissions';
import { ROLES_CONFIG } from '../../config/roles.config';
import { AppCard, AppBadge, AppPageHeader } from '../../shared/ui';
import type { RoleName } from '../../types';

// ── Permission cell logic ─────────────────────────────────────────────────────

type CellState = 'edit' | 'view' | 'none';

function cellState(fieldKey: string, roleName: RoleName): CellState {
  const perm = ROLE_AD_FIELD_PERMISSIONS.find(
    p => p.roleName === roleName && p.fieldKey === fieldKey,
  );
  if (!perm || !perm.isActive || !perm.canView) return 'none';
  return perm.canEdit ? 'edit' : 'view';
}

// ── Summary stats for a role ──────────────────────────────────────────────────

function roleSummary(role: RoleName) {
  const perms = AD_FIELD_DEFINITIONS.map(f => cellState(f.fieldKey, role));
  return {
    visible:     perms.filter(s => s !== 'none').length,
    editable:    perms.filter(s => s === 'edit').length,
    restricted:  perms.filter(s => s === 'none').length,
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PermCell({ state }: { state: CellState }) {
  if (state === 'edit') {
    return (
      <span style={{
        display:      'inline-flex',
        alignItems:   'center',
        gap:          '4px',
        padding:      '3px 10px',
        borderRadius: 'var(--ds-radius-full)',
        background:   'var(--ds-success-light)',
        color:        'var(--ds-success-dark)',
        border:       '1px solid var(--ds-success-border)',
        fontSize:     '12px',
        fontWeight:   600,
        whiteSpace:   'nowrap',
      }}>
        <span style={{ fontSize: '10px' }}>✎</span> Editar
      </span>
    );
  }
  if (state === 'view') {
    return (
      <span style={{
        display:      'inline-flex',
        alignItems:   'center',
        gap:          '4px',
        padding:      '3px 10px',
        borderRadius: 'var(--ds-radius-full)',
        background:   'var(--ds-info-light)',
        color:        'var(--ds-info-dark)',
        border:       '1px solid var(--ds-info-border)',
        fontSize:     '12px',
        fontWeight:   600,
        whiteSpace:   'nowrap',
      }}>
        <span style={{ fontSize: '10px' }}>◉</span> Ver
      </span>
    );
  }
  return (
    <span style={{
      display:      'inline-flex',
      alignItems:   'center',
      gap:          '4px',
      padding:      '3px 10px',
      borderRadius: 'var(--ds-radius-full)',
      background:   'var(--ds-neutral-100)',
      color:        'var(--ds-neutral-400)',
      fontSize:     '12px',
      whiteSpace:   'nowrap',
    }}>
      — Sin acceso
    </span>
  );
}

function SummaryCard({
  value,
  label,
  color,
  bg,
}: {
  value: number;
  label: string;
  color: string;
  bg: string;
}) {
  return (
    <div style={{
      flex:         1,
      background:   bg,
      border:       `1px solid ${color}33`,
      borderRadius: 'var(--ds-radius-xl)',
      padding:      '16px 18px',
      textAlign:    'center',
    }}>
      <div style={{ fontSize: '32px', fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '12px', color: 'var(--ds-neutral-600)', marginTop: '4px', fontWeight: 500 }}>{label}</div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function PermissionsMatrixPage() {
  const [selectedRole, setSelectedRole] = useState<RoleName>('DragonHelp');

  const summary = roleSummary(selectedRole);
  const roleConf = ROLES_CONFIG.find(r => r.name === selectedRole)!;

  return (
    <div>
      <AppPageHeader
        title="Matriz de Permisos"
        description="Permisos por campo y rol para los atributos AD gestionados por el portal"
      />

      {/* Role selector */}
      <AppCard style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ds-neutral-500)', marginRight: '4px' }}>
            Resumen para rol:
          </span>
          {ROLES_CONFIG.map(r => {
            const active = selectedRole === r.name;
            return (
              <button
                key={r.name}
                onClick={() => setSelectedRole(r.name)}
                style={{
                  padding:      '6px 16px',
                  borderRadius: 'var(--ds-radius-full)',
                  border:       active ? `2px solid ${r.color}` : '2px solid var(--ds-neutral-200)',
                  background:   active ? `${r.color}18` : 'transparent',
                  color:        active ? r.color : 'var(--ds-neutral-500)',
                  fontWeight:   active ? 700 : 500,
                  fontSize:     '13px',
                  cursor:       'pointer',
                  transition:   'all 0.15s',
                  whiteSpace:   'nowrap',
                }}
              >
                {r.displayName}
              </button>
            );
          })}
        </div>

        {/* Summary cards */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <SummaryCard
            value={summary.visible}
            label="Campos visibles"
            color={roleConf.color}
            bg={`${roleConf.color}11`}
          />
          <SummaryCard
            value={summary.editable}
            label="Campos editables"
            color="var(--ds-success-dark)"
            bg="var(--ds-success-light)"
          />
          <SummaryCard
            value={summary.restricted}
            label="Sin acceso"
            color="var(--ds-neutral-500)"
            bg="var(--ds-neutral-100)"
          />
        </div>
      </AppCard>

      {/* Permission matrix table */}
      <AppCard noPadding>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--ds-neutral-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ds-neutral-700)' }}>
            Matriz completa · {AD_FIELD_DEFINITIONS.length} campos × {ROLES_CONFIG.length} roles
          </span>
          <AppBadge variant="neutral" style={{ fontSize: '11px' }}>
            Basado en roleFieldPermissions.ts
          </AppBadge>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'var(--ds-neutral-50)' }}>
                {/* Field header */}
                <th style={{
                  padding:       '12px 20px',
                  textAlign:     'left',
                  fontSize:      '11px',
                  fontWeight:    700,
                  color:         'var(--ds-neutral-500)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  borderBottom:  '1px solid var(--ds-neutral-200)',
                  minWidth:      '200px',
                }}>
                  Campo AD
                </th>

                {/* Role headers */}
                {ROLES_CONFIG.map(r => (
                  <th
                    key={r.name}
                    style={{
                      padding:       '12px 20px',
                      textAlign:     'center',
                      fontSize:      '12px',
                      fontWeight:    700,
                      color:         r.color,
                      letterSpacing: '0.02em',
                      borderBottom:  '1px solid var(--ds-neutral-200)',
                      minWidth:      '140px',
                      borderLeft:    '1px solid var(--ds-neutral-100)',
                      background:    selectedRole === r.name ? `${r.color}08` : 'var(--ds-neutral-50)',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <span
                        style={{
                          width:        '28px',
                          height:       '28px',
                          borderRadius: 'var(--ds-radius-full)',
                          background:   `${r.color}22`,
                          border:       `2px solid ${r.color}44`,
                          display:      'flex',
                          alignItems:   'center',
                          justifyContent: 'center',
                          fontSize:     '10px',
                          fontWeight:   900,
                          color:        r.color,
                        }}
                      >
                        {r.displayName.slice(0, 2).toUpperCase()}
                      </span>
                      {r.displayName}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {AD_FIELD_DEFINITIONS.map((field, idx) => (
                <tr
                  key={field.fieldKey}
                  style={{ background: idx % 2 === 0 ? '#fff' : 'var(--ds-neutral-50)' }}
                >
                  {/* Field info */}
                  <td style={{ padding: '14px 20px', borderBottom: '1px solid var(--ds-neutral-100)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ds-neutral-900)' }}>
                          {field.displayName}
                          {field.isSensitive && (
                            <span style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--ds-warning-dark)', background: 'var(--ds-warning-light)', padding: '1px 5px', borderRadius: 'var(--ds-radius-sm)', fontWeight: 600, border: '1px solid var(--ds-warning-border)' }}>
                              sensible
                            </span>
                          )}
                        </div>
                        <div style={{ fontFamily: 'var(--ds-font-mono)', fontSize: '11px', color: 'var(--ds-neutral-400)', marginTop: '2px' }}>
                          {field.adAttributeName}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Permission cells — one per role */}
                  {ROLES_CONFIG.map(r => {
                    const state = cellState(field.fieldKey, r.name);
                    const isSelectedRole = r.name === selectedRole;
                    return (
                      <td
                        key={r.name}
                        style={{
                          padding:    '14px 20px',
                          textAlign:  'center',
                          borderLeft: '1px solid var(--ds-neutral-100)',
                          borderBottom: '1px solid var(--ds-neutral-100)',
                          background: isSelectedRole
                            ? `${r.color}06`
                            : 'transparent',
                        }}
                      >
                        <PermCell state={state} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--ds-neutral-100)', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: 'var(--ds-neutral-400)', fontWeight: 600, marginRight: '4px' }}>Leyenda:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <PermCell state="edit" />
            <span style={{ fontSize: '11px', color: 'var(--ds-neutral-500)' }}>— puede ver y modificar el campo</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <PermCell state="view" />
            <span style={{ fontSize: '11px', color: 'var(--ds-neutral-500)' }}>— solo lectura, no puede editar</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <PermCell state="none" />
            <span style={{ fontSize: '11px', color: 'var(--ds-neutral-500)' }}>— campo oculto para este rol</span>
          </div>
        </div>
      </AppCard>
    </div>
  );
}
