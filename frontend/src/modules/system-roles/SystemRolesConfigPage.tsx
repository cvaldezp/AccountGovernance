import { useState } from 'react';
import { AppCard, AppButton, AppBadge, AppInput, AppPageHeader } from '../../shared/ui';
import { useAuth } from '../../auth/useAuth';
import { useSystemRoles } from './useSystemRoles';
import type { AdGroupValidation, CreateGroupForm, SystemRole } from './types';

function AdValidationResult({ v }: { v: AdGroupValidation }) {
  if (!v.isValid) {
    return (
      <div style={{
        padding: '10px 12px', borderRadius: 'var(--ds-radius-lg)', fontSize: 'var(--ds-text-sm)',
        background: 'var(--ds-danger-light)', border: '1px solid var(--ds-danger-border)',
        color: 'var(--ds-danger-dark)',
      }}>
        ✗ {v.error ?? 'No encontrado en Active Directory.'}
      </div>
    );
  }

  return (
    <div style={{
      padding: '10px 12px', borderRadius: 'var(--ds-radius-lg)',
      background: 'var(--ds-success-light)', border: '1px solid var(--ds-success-border)',
      color: 'var(--ds-success-dark)',
    }}>
      <div style={{ fontWeight: 700, fontSize: 'var(--ds-text-sm)' }}>
        ✓ {v.groupName}
        <span style={{ fontWeight: 400 }}>{v.isSecurity ? ' — Grupo de seguridad' : ' — Grupo de distribución'}</span>
      </div>
      <div style={{
        marginTop: '6px', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 8px',
        fontFamily: 'var(--ds-font-mono)', fontSize: 'var(--ds-text-xs)', opacity: 0.85,
      }}>
        <span>DN</span>   <span style={{ wordBreak: 'break-all' }}>{v.dn}</span>
        <span>SID</span>  <span style={{ wordBreak: 'break-all' }}>{v.sid ?? '—'}</span>
        <span>GUID</span> <span style={{ wordBreak: 'break-all' }}>{v.objectGuid ?? '—'}</span>
      </div>
    </div>
  );
}

// Search-only flow — the admin can never hand-type a DN, SID, or GUID. Typing in the
// "Grupo AD" box only searches AD by name; DN/SID/GUID are populated exclusively from
// a successful Validar result, and Guardar stays disabled until that happens.
function GroupForm({
  form, validation, validating, onQueryChange, onFieldChange, onValidate, onSave, onCancel, saving, saveError,
}: {
  form:       CreateGroupForm;
  validation: AdGroupValidation | null;
  validating: boolean;
  onQueryChange: (value: string) => void;
  onFieldChange: <K extends keyof CreateGroupForm>(key: K, value: CreateGroupForm[K]) => void;
  onValidate: () => void;
  onSave:     () => void;
  onCancel:   () => void;
  saving:     boolean;
  saveError:  string | null;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <AppInput
            label="Grupo AD *"
            placeholder="ej. account-seg"
            value={form.query}
            onChange={e => onQueryChange(e.target.value)}
          />
        </div>
        <AppButton
          variant="secondary" size="sm" onClick={onValidate} loading={validating}
          disabled={!form.query.trim()}
          style={{ flexShrink: 0 }}
        >
          Validar
        </AppButton>
      </div>

      {validation && <AdValidationResult v={validation} />}

      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
        <input
          type="checkbox" checked={form.isActive}
          onChange={e => onFieldChange('isActive', e.target.checked)}
          style={{ width: '16px', height: '16px', accentColor: 'var(--ds-brand-500)' }}
        />
        <span style={{ fontSize: 'var(--ds-text-sm)', color: 'var(--ds-neutral-700)' }}>Activo</span>
      </label>

      {saveError && (
        <div style={{
          padding: '8px 12px', borderRadius: 'var(--ds-radius-lg)',
          background: 'var(--ds-danger-light)', border: '1px solid var(--ds-danger-border)',
          color: 'var(--ds-danger-dark)', fontSize: 'var(--ds-text-sm)',
        }}>
          {saveError}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <AppButton variant="secondary" size="sm" onClick={onCancel} disabled={saving}>Cancelar</AppButton>
        <AppButton
          variant="primary" size="sm" onClick={onSave} loading={saving}
          disabled={!validation?.isValid}
        >
          Guardar
        </AppButton>
      </div>
    </div>
  );
}

export function SystemRolesConfigPage() {
  const { user } = useAuth();
  const isSystemAdmin = user?.roles.includes('SystemAdmin') ?? false;

  const {
    roles, loading, loadError,
    editingRoleKey, roleForm, savingRole, roleSaveError,
    startEditRole, cancelEditRole, updateRoleField, saveRole,
    editingGroupId, groupForm, groupValidation, validatingGroup, savingGroup, groupSaveError,
    startEditGroup, cancelEditGroup, updateGroupField, updateGroupQuery, validateEditGroup, saveEditGroup, deleteGroup,
    addingGroupForRole, addGroupForm, addGroupValidation, addValidatingGroup,
    openAddGroup, cancelAddGroup, updateAddGroupField, updateAddGroupQuery, validateAddGroup, saveAddGroup,
  } = useSystemRoles();

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Defense in depth — the sidebar link is already hidden for non-SystemAdmin users,
  // but there's no route guard in App.tsx, so re-check here.
  if (!isSystemAdmin) {
    return (
      <AppCard>
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--ds-danger-dark)' }}>
          Acceso denegado. Esta sección es exclusiva del rol SystemAdmin.
        </div>
      </AppCard>
    );
  }

  return (
    <div>
      <AppPageHeader
        title="Roles y Grupos"
        description="Administra los roles del sistema y los grupos de Active Directory que otorgan cada rol. Estos datos controlan quién puede acceder a Account Governance."
      />

      {loading && <div className="ds-loading">Cargando roles…</div>}

      {loadError && (
        <div style={{
          padding: '12px 16px', borderRadius: 'var(--ds-radius-lg)', marginBottom: '16px',
          background: 'var(--ds-danger-light)', border: '1px solid var(--ds-danger-border)',
          color: 'var(--ds-danger-dark)', fontSize: 'var(--ds-text-sm)',
        }}>
          No se pudieron cargar los roles: {loadError}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {roles.map((role: SystemRole) => {
          const isEditingRole = editingRoleKey === role.roleKey;
          return (
            <AppCard key={role.roleKey}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* ── Role header / fields ─────────────────────────────── */}
                {isEditingRole && roleForm ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <AppInput
                      label="Nombre visible *"
                      value={roleForm.displayName}
                      onChange={e => updateRoleField('displayName', e.target.value)}
                    />
                    <AppInput
                      label="Descripción"
                      value={roleForm.description}
                      onChange={e => updateRoleField('description', e.target.value)}
                    />
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: 'var(--ds-text-xs)', color: 'var(--ds-neutral-500)' }}>Prioridad:</span>
                        <input
                          type="number" value={roleForm.priority}
                          onChange={e => updateRoleField('priority', Number(e.target.value))}
                          style={{ width: '70px', padding: '4px 6px', border: '1px solid var(--ds-neutral-300)', borderRadius: '4px', fontSize: 'var(--ds-text-sm)' }}
                        />
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                          type="checkbox" checked={roleForm.isActive}
                          onChange={e => updateRoleField('isActive', e.target.checked)}
                          style={{ width: '16px', height: '16px', accentColor: 'var(--ds-brand-500)' }}
                        />
                        <span style={{ fontSize: 'var(--ds-text-sm)' }}>Activo</span>
                      </label>
                    </div>

                    {roleSaveError && (
                      <div style={{
                        padding: '8px 12px', borderRadius: 'var(--ds-radius-lg)',
                        background: 'var(--ds-danger-light)', border: '1px solid var(--ds-danger-border)',
                        color: 'var(--ds-danger-dark)', fontSize: 'var(--ds-text-sm)',
                      }}>
                        {roleSaveError}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <AppButton variant="secondary" size="sm" onClick={cancelEditRole} disabled={savingRole}>Cancelar</AppButton>
                      <AppButton variant="primary" size="sm" onClick={saveRole} loading={savingRole}>Guardar</AppButton>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 700, fontSize: 'var(--ds-text-base)', color: 'var(--ds-neutral-900)' }}>
                          {role.displayName}
                        </span>
                        <AppBadge variant="neutral" size="sm">{role.roleKey}</AppBadge>
                        <AppBadge variant="neutral" size="sm">prioridad {role.priority}</AppBadge>
                        {!role.isActive && <AppBadge variant="warning" size="sm">inactivo</AppBadge>}
                        {role.groups.filter(g => g.isActive).length === 0 && (
                          <AppBadge variant="danger" size="sm">sin grupo AD</AppBadge>
                        )}
                      </div>
                      {role.description && (
                        <div style={{ fontSize: 'var(--ds-text-sm)', color: 'var(--ds-neutral-500)', marginTop: '2px' }}>
                          {role.description}
                        </div>
                      )}
                    </div>
                    <AppButton variant="secondary" size="sm" onClick={() => startEditRole(role)}>
                      Editar rol
                    </AppButton>
                  </div>
                )}

                {/* ── Groups ────────────────────────────────────────────── */}
                <div style={{ borderTop: '1px solid var(--ds-neutral-200)', paddingTop: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {role.groups.length === 0 && addingGroupForRole !== role.roleKey && (
                      <div style={{
                        padding: '14px', textAlign: 'center', color: 'var(--ds-neutral-400)',
                        fontSize: 'var(--ds-text-sm)', border: '1px dashed var(--ds-neutral-200)',
                        borderRadius: 'var(--ds-radius-lg)',
                      }}>
                        Sin grupos AD asociados a este rol.
                      </div>
                    )}

                    {role.groups.map(group => (
                      editingGroupId === group.id ? (
                        <div key={group.id} style={{
                          padding: '14px', border: '2px solid var(--ds-brand-200)',
                          borderRadius: 'var(--ds-radius-lg)', background: 'var(--ds-brand-50)',
                        }}>
                          <div style={{ fontWeight: 600, fontSize: 'var(--ds-text-sm)', color: 'var(--ds-brand-700)', marginBottom: '10px' }}>
                            Editando: {group.groupName}
                          </div>
                          <GroupForm
                            form={groupForm} validation={groupValidation} validating={validatingGroup}
                            onQueryChange={updateGroupQuery} onFieldChange={updateGroupField} onValidate={validateEditGroup}
                            onSave={() => saveEditGroup(role.roleKey)} onCancel={cancelEditGroup}
                            saving={savingGroup} saveError={groupSaveError}
                          />
                        </div>
                      ) : (
                        <div key={group.id} style={{
                          display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
                          padding: '10px 14px', border: '1px solid var(--ds-neutral-200)',
                          borderRadius: 'var(--ds-radius-lg)',
                          background: group.isActive ? 'var(--ds-neutral-0)' : 'var(--ds-neutral-50)',
                          opacity: group.isActive ? 1 : 0.65,
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontWeight: 600, fontSize: 'var(--ds-text-sm)' }}>{group.groupName}</span>
                              {!group.isActive && <AppBadge variant="neutral" size="sm">inactivo</AppBadge>}
                            </div>
                            <div style={{
                              fontSize: 'var(--ds-text-xs)', color: 'var(--ds-neutral-400)',
                              fontFamily: 'var(--ds-font-mono)', marginTop: '2px',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {group.groupDn}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                            {confirmDeleteId === group.id ? (
                              <>
                                <AppButton variant="danger" size="sm" onClick={() => { setConfirmDeleteId(null); void deleteGroup(role.roleKey, group.id); }}>
                                  Confirmar
                                </AppButton>
                                <AppButton variant="secondary" size="sm" onClick={() => setConfirmDeleteId(null)}>Cancelar</AppButton>
                              </>
                            ) : (
                              <>
                                <AppButton variant="secondary" size="sm" onClick={() => startEditGroup(group)}>Editar</AppButton>
                                <AppButton variant="ghost" size="sm" onClick={() => setConfirmDeleteId(group.id)} style={{ color: 'var(--ds-danger-main)' }}>
                                  Eliminar
                                </AppButton>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    ))}

                    {addingGroupForRole === role.roleKey && (
                      <div style={{
                        padding: '14px', border: '2px solid var(--ds-success-border)',
                        borderRadius: 'var(--ds-radius-lg)', background: 'var(--ds-success-light)',
                      }}>
                        <div style={{ fontWeight: 600, fontSize: 'var(--ds-text-sm)', color: 'var(--ds-success-dark)', marginBottom: '10px' }}>
                          Nuevo grupo para {role.displayName}
                        </div>
                        <GroupForm
                          form={addGroupForm} validation={addGroupValidation} validating={addValidatingGroup}
                          onQueryChange={updateAddGroupQuery} onFieldChange={updateAddGroupField} onValidate={validateAddGroup}
                          onSave={saveAddGroup} onCancel={cancelAddGroup}
                          saving={savingGroup} saveError={groupSaveError}
                        />
                      </div>
                    )}
                  </div>

                  {addingGroupForRole !== role.roleKey && editingGroupId === null && (
                    <div style={{ marginTop: '10px' }}>
                      <AppButton variant="secondary" size="sm" onClick={() => openAddGroup(role.roleKey)}>
                        + Agregar grupo
                      </AppButton>
                    </div>
                  )}
                </div>
              </div>
            </AppCard>
          );
        })}
      </div>
    </div>
  );
}
