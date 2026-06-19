import { AppCard, AppButton, AppBadge, AppInput, AppPageHeader } from '../../shared/ui';
import { useAccountTypeConfig } from './useAccountTypeConfig';
import type { AccountTypeConfigItem, AccountSubTypeConfigItem } from './accountTypeConfigApi';

const PASSWORD_LENGTHS = [8, 12, 14, 16, 20, 24, 32, 64];

function ConfigBadge({ item }: { item: AccountTypeConfigItem }) {
  return (
    <span style={{
      display:        'inline-flex',
      alignItems:     'center',
      justifyContent: 'center',
      width:          '36px',
      height:         '36px',
      borderRadius:   '8px',
      background:     item.isPrivileged ? 'var(--ds-danger-light)' : 'var(--ds-info-light)',
      color:          item.isPrivileged ? 'var(--ds-danger-dark)'  : 'var(--ds-info-dark)',
      fontFamily:     'var(--ds-font-mono)',
      fontSize:       '10px',
      fontWeight:     700,
      flexShrink:     0,
    }}>
      {item.badge}
    </span>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <span style={{
      display:    'inline-flex',
      gap:        '4px',
      fontSize:   'var(--ds-text-xs)',
      color:      'var(--ds-neutral-500)',
      background: 'var(--ds-neutral-50)',
      border:     '1px solid var(--ds-neutral-200)',
      borderRadius: 'var(--ds-radius-lg)',
      padding:    '2px 8px',
    }}>
      <span style={{ color: 'var(--ds-neutral-400)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--ds-font-mono)', fontWeight: 600 }}>{value}</span>
    </span>
  );
}

function SubTypeSummaryRow({ sub, onEdit }: { sub: AccountSubTypeConfigItem; onEdit: () => void }) {
  return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      gap:          '10px',
      flexWrap:     'wrap',
      padding:      '8px 12px',
      background:   sub.isActive ? 'var(--ds-neutral-0)' : 'var(--ds-neutral-50)',
      border:       '1px solid var(--ds-neutral-200)',
      borderRadius: 'var(--ds-radius-lg)',
      opacity:      sub.isActive ? 1 : 0.6,
    }}>
      <span style={{
        fontFamily: 'var(--ds-font-mono)',
        fontSize:   '11px',
        fontWeight: 700,
        background: 'var(--ds-danger-light)',
        color:      'var(--ds-danger-dark)',
        padding:    '2px 7px',
        borderRadius:'4px',
        flexShrink: 0,
      }}>
        {sub.samPrefix}.
      </span>

      <span style={{ fontWeight: 600, fontSize: 'var(--ds-text-sm)', minWidth: '110px' }}>
        {sub.label}
      </span>

      <MetaChip label="EA14" value={sub.extensionAttribute14} />

      {sub.targetOU && (
        <span style={{
          fontSize: 'var(--ds-text-xs)', color: 'var(--ds-neutral-400)',
          fontFamily: 'var(--ds-font-mono)', flex: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {sub.targetOU}
        </span>
      )}

      {!sub.isActive && <AppBadge variant="neutral" size="sm">Inactivo</AppBadge>}

      <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
        <AppButton variant="secondary" size="sm" onClick={onEdit}>Editar</AppButton>
      </div>
    </div>
  );
}

export function AccountTypeConfigPage() {
  const {
    configs, loading,
    editingKey, editForm, saving, saveError,
    editingSubTypeKey, editSubTypeForm, savingSubType,
    startEdit, cancelEdit, updateEditField, saveEdit,
    startEditSubType, cancelEditSubType, updateSubTypeField, saveSubType,
  } = useAccountTypeConfig();

  return (
    <div>
      <AppPageHeader
        title="Tipos de Cuenta"
        description="Administra parámetros de cada tipo — extensionAttribute14, OU destino, longitud de contraseña y plantilla de descripción"
      />

      {loading ? (
        <div className="ds-loading">Cargando configuración…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {configs.map(item => (
            <AppCard key={item.typeKey} style={{ opacity: item.isActive ? 1 : 0.6 }}>

              {/* ── Summary row ─────────────────────────────────────────────── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <ConfigBadge item={item} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: 'var(--ds-text-base)', color: 'var(--ds-neutral-900)' }}>
                      {item.label}
                    </span>
                    {item.isPrivileged && <AppBadge variant="danger" size="sm">Privilegiada</AppBadge>}
                    {!item.isActive && <AppBadge variant="neutral" size="sm">Inactivo</AppBadge>}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                    {item.isPrivileged
                      ? <MetaChip label="Sub-tipos" value={`${item.subTypes.length} áreas`} />
                      : item.samPrefix && <MetaChip label="Prefijo" value={`${item.samPrefix}.`} />
                    }
                    <MetaChip label="EA14" value={item.extensionAttribute14} />
                    <MetaChip label="Pwd" value={`${item.defaultPasswordLength} chars`} />
                    {!item.isPrivileged && item.targetOU && (
                      <span style={{
                        fontSize: 'var(--ds-text-xs)', color: 'var(--ds-neutral-400)',
                        alignSelf: 'center', fontFamily: 'var(--ds-font-mono)',
                        maxWidth: '360px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {item.targetOU}
                      </span>
                    )}
                  </div>
                </div>

                {editingKey !== item.typeKey && (
                  <AppButton variant="secondary" size="sm" onClick={() => startEdit(item.typeKey)}>
                    Editar
                  </AppButton>
                )}
              </div>

              {/* ── Inline edit form (type-level) ────────────────────────────── */}
              {editingKey === item.typeKey && editForm && (
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--ds-neutral-200)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {!item.isPrivileged && (
                      <AppInput
                        label="Prefijo SAM"
                        placeholder="vacío = sin prefijo"
                        value={editForm.samPrefix}
                        onChange={e => updateEditField('samPrefix', e.target.value)}
                        hint="El sAMAccountName será: prefijo.{inicial}{apellido}"
                      />
                    )}
                    <AppInput
                      label="extensionAttribute14 *"
                      placeholder="ej. GENERICA"
                      value={editForm.extensionAttribute14}
                      onChange={e => updateEditField('extensionAttribute14', e.target.value.toUpperCase())}
                      style={item.isPrivileged ? { gridColumn: 'span 1' } : undefined}
                    />
                    <div className="ds-input">
                      <label className="ds-input__label">Longitud contraseña *</label>
                      <select
                        className="ds-input__field"
                        value={editForm.defaultPasswordLength}
                        onChange={e => updateEditField('defaultPasswordLength', Number(e.target.value))}
                      >
                        {PASSWORD_LENGTHS.map(l => (
                          <option key={l} value={l}>{l} caracteres</option>
                        ))}
                      </select>
                    </div>
                    <div className="ds-input" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '18px' }}>
                        <input
                          type="checkbox"
                          checked={editForm.isActive}
                          onChange={e => updateEditField('isActive', e.target.checked)}
                          style={{ width: '16px', height: '16px', accentColor: 'var(--ds-brand-500)' }}
                        />
                        <span style={{ fontSize: 'var(--ds-text-base)', color: 'var(--ds-neutral-700)' }}>Tipo activo</span>
                      </label>
                    </div>
                    {!item.isPrivileged && (
                      <div className="ds-input" style={{ gridColumn: 'span 2' }}>
                        <label className="ds-input__label">OU Destino</label>
                        <input
                          className="ds-input__field"
                          placeholder="OU=Usuarios,DC=usfq,DC=edu,DC=ec"
                          value={editForm.targetOU}
                          onChange={e => updateEditField('targetOU', e.target.value)}
                          style={{ fontFamily: 'var(--ds-font-mono)', fontSize: 'var(--ds-text-sm)' }}
                        />
                      </div>
                    )}
                    <div className="ds-input" style={{ gridColumn: 'span 2' }}>
                      <label className="ds-input__label">Plantilla de descripción</label>
                      <textarea
                        className="ds-input__field"
                        rows={2}
                        placeholder="Cuenta genérica — {Department}"
                        value={editForm.descriptionTemplate}
                        onChange={e => updateEditField('descriptionTemplate', e.target.value)}
                      />
                      <span className="ds-input__hint">
                        Variables: {'{Department}'} {'{Company}'} {'{ServiceName}'} {'{SubType}'}
                      </span>
                    </div>
                  </div>

                  {saveError && (
                    <div className="ds-alert ds-alert--error" style={{ marginTop: '12px' }}>{saveError}</div>
                  )}

                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
                    <AppButton variant="secondary" size="sm" onClick={cancelEdit} disabled={saving}>Cancelar</AppButton>
                    <AppButton variant="primary" size="sm" onClick={saveEdit} loading={saving}>Guardar cambios</AppButton>
                  </div>

                  {item.updatedAt && (
                    <div style={{ marginTop: '8px', fontSize: 'var(--ds-text-xs)', color: 'var(--ds-neutral-400)', textAlign: 'right' }}>
                      Última edición: {new Date(item.updatedAt).toLocaleString('es-EC')}
                      {item.updatedBy ? ` — ${item.updatedBy}` : ''}
                    </div>
                  )}
                </div>
              )}

              {/* ── Sub-types section (PRIVILEGED only) ──────────────────────── */}
              {item.isPrivileged && item.subTypes.length > 0 && editingKey !== item.typeKey && (
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--ds-neutral-200)' }}>
                  <div style={{
                    fontSize: 'var(--ds-text-xs)', fontWeight: 700, color: 'var(--ds-neutral-400)',
                    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px',
                  }}>
                    Sub-tipos
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {item.subTypes.map(sub => (
                      <div key={sub.subTypeKey}>
                        {editingSubTypeKey !== sub.subTypeKey ? (
                          <SubTypeSummaryRow
                            sub={sub}
                            onEdit={() => startEditSubType(sub.subTypeKey)}
                          />
                        ) : (
                          editSubTypeForm && (
                            <div style={{
                              padding:      '14px',
                              border:       '2px solid var(--ds-brand-200)',
                              borderRadius: 'var(--ds-radius-lg)',
                              background:   'var(--ds-brand-50)',
                            }}>
                              <div style={{ fontSize: 'var(--ds-text-sm)', fontWeight: 600, marginBottom: '12px', color: 'var(--ds-brand-700)' }}>
                                Editando sub-tipo: {sub.label}
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <AppInput
                                  label="Prefijo SAM *"
                                  placeholder="ej. op"
                                  value={editSubTypeForm.samPrefix}
                                  onChange={e => updateSubTypeField('samPrefix', e.target.value)}
                                  hint="El sAMAccountName será: prefijo.{inicial}{apellido}"
                                />
                                <AppInput
                                  label="extensionAttribute14 *"
                                  placeholder="ej. PRIV_OP"
                                  value={editSubTypeForm.extensionAttribute14}
                                  onChange={e => updateSubTypeField('extensionAttribute14', e.target.value.toUpperCase())}
                                />
                                <div className="ds-input" style={{ gridColumn: 'span 2' }}>
                                  <label className="ds-input__label">OU Destino</label>
                                  <input
                                    className="ds-input__field"
                                    placeholder="OU=Privilegiadas,OU=Operaciones,DC=usfq,DC=edu,DC=ec"
                                    value={editSubTypeForm.targetOU}
                                    onChange={e => updateSubTypeField('targetOU', e.target.value)}
                                    style={{ fontFamily: 'var(--ds-font-mono)', fontSize: 'var(--ds-text-sm)' }}
                                  />
                                </div>
                                <div className="ds-input">
                                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '18px' }}>
                                    <input
                                      type="checkbox"
                                      checked={editSubTypeForm.isActive}
                                      onChange={e => updateSubTypeField('isActive', e.target.checked)}
                                      style={{ width: '16px', height: '16px', accentColor: 'var(--ds-brand-500)' }}
                                    />
                                    <span style={{ fontSize: 'var(--ds-text-base)', color: 'var(--ds-neutral-700)' }}>Sub-tipo activo</span>
                                  </label>
                                </div>
                              </div>

                              {saveError && (
                                <div className="ds-alert ds-alert--error" style={{ marginTop: '10px' }}>{saveError}</div>
                              )}

                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
                                <AppButton variant="secondary" size="sm" onClick={cancelEditSubType} disabled={savingSubType}>
                                  Cancelar
                                </AppButton>
                                <AppButton variant="primary" size="sm" onClick={saveSubType} loading={savingSubType}>
                                  Guardar sub-tipo
                                </AppButton>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </AppCard>
          ))}
        </div>
      )}
    </div>
  );
}
