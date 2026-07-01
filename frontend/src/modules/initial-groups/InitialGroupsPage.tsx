import { useState } from 'react';
import { AppCard, AppButton, AppBadge, AppInput, AppPageHeader } from '../../shared/ui';
import { useInitialGroups } from './useInitialGroups';
import type { InitialGroup, CreateGroupForm, AdGroupValidation } from './types';

// Account types available (mirrors the 5 canonical types)
const ACCOUNT_TYPES = [
  { typeKey: 'GENERIC',    label: 'Genérica',    badge: 'GEN', isPrivileged: false, subTypes: [] },
  { typeKey: 'PARTNER',    label: 'Partner',     badge: 'PTR', isPrivileged: false, subTypes: [] },
  { typeKey: 'SERVICE',    label: 'Servicio',    badge: 'SVC', isPrivileged: false, subTypes: [] },
  { typeKey: 'EXTENSION',  label: 'Extensión',   badge: 'EXT', isPrivileged: false, subTypes: [] },
  {
    typeKey: 'PRIVILEGED', label: 'Privilegiada', badge: 'PRV', isPrivileged: true,
    subTypes: [
      { key: 'OPERACIONES',     label: 'Operaciones'     },
      { key: 'INFRAESTRUCTURA', label: 'Infraestructura' },
      { key: 'SISTEMAS',        label: 'Sistemas'        },
      { key: 'SEGURIDAD',       label: 'Seguridad'       },
    ],
  },
] as const;

function AdValidationBanner({ v }: { v: AdGroupValidation }) {
  if (!v.isValid && !v.error) return null;
  return (
    <div style={{
      padding:      '10px 12px',
      borderRadius: 'var(--ds-radius-lg)',
      fontSize:     'var(--ds-text-sm)',
      background:   v.isValid ? 'var(--ds-success-light)' : 'var(--ds-danger-light)',
      border:       `1px solid ${v.isValid ? 'var(--ds-success-border)' : 'var(--ds-danger-border)'}`,
      color:        v.isValid ? 'var(--ds-success-dark)' : 'var(--ds-danger-dark)',
    }}>
      {v.isValid
        ? <>
            <strong>✓ {v.groupName}</strong>
            {v.isSecurity ? ' — Grupo de seguridad' : ' — Grupo de distribución'}
            {v.objectGuid && <div style={{ fontFamily: 'var(--ds-font-mono)', fontSize: 'var(--ds-text-xs)', marginTop: '4px', opacity: 0.8 }}>GUID: {v.objectGuid}</div>}
          </>
        : <>✗ {v.error ?? 'No encontrado en Active Directory.'}</>
      }
    </div>
  );
}

function GroupForm({
  form, adValidation, validating,
  onFieldChange, onValidate, onSave, onCancel, saving, saveError,
  saveLabel = 'Guardar',
}: {
  form:         CreateGroupForm;
  adValidation: AdGroupValidation | null;
  validating:   boolean;
  onFieldChange: <K extends keyof CreateGroupForm>(key: K, value: CreateGroupForm[K]) => void;
  onValidate:   () => void;
  onSave:       () => void;
  onCancel:     () => void;
  saving:       boolean;
  saveError:    string | null;
  saveLabel?:   string;
}) {
  const query    = form.groupDn.trim();
  const isOuInput = /^ou=/i.test(query);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <AppInput
            label="Grupo AD *"
            placeholder="ej. GRP-Servicios  o  CN=GRP-Servicios,OU=Grupos,DC=usfq,DC=edu,DC=ec"
            value={form.groupDn}
            onChange={e => onFieldChange('groupDn', e.target.value)}
            style={{ fontFamily: 'var(--ds-font-mono)', fontSize: 'var(--ds-text-xs)' }}
            hint="Ingresa el nombre del grupo, sAMAccountName o DN completo."
          />
        </div>
        <AppButton
          variant="secondary"
          size="sm"
          onClick={onValidate}
          loading={validating}
          disabled={(!form.groupDn.trim() && !form.groupName.trim()) || isOuInput}
          style={{ flexShrink: 0 }}
        >
          Validar en AD
        </AppButton>
      </div>

      {isOuInput && (
        <div style={{
          padding:      '9px 12px',
          borderRadius: 'var(--ds-radius-lg)',
          fontSize:     'var(--ds-text-sm)',
          background:   'var(--ds-warning-light, #fffbeb)',
          border:       '1px solid var(--ds-warning-border, #fcd34d)',
          color:        'var(--ds-warning-dark, #92400e)',
        }}>
          Ingresaste una OU, no un grupo. Debes ingresar el nombre del grupo o un DN que empiece con <code>CN=</code>.
        </div>
      )}

      {!isOuInput && adValidation && <AdValidationBanner v={adValidation} />}

      <AppInput
        label="Nombre del grupo *"
        placeholder="ej. GRP-ServiceAccounts-USFQ"
        value={form.groupName}
        onChange={e => onFieldChange('groupName', e.target.value)}
        hint="Se auto-completa al validar en AD"
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <AppInput
          label="objectGUID (opcional)"
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          value={form.groupObjectGuid}
          onChange={e => onFieldChange('groupObjectGuid', e.target.value)}
          style={{ fontFamily: 'var(--ds-font-mono)', fontSize: 'var(--ds-text-xs)' }}
          hint="Se rellena automáticamente al validar"
        />
        <AppInput
          label="SID (opcional)"
          placeholder="S-1-5-21-..."
          value={form.groupSid}
          onChange={e => onFieldChange('groupSid', e.target.value)}
          style={{ fontFamily: 'var(--ds-font-mono)', fontSize: 'var(--ds-text-xs)' }}
          hint="Se rellena automáticamente al validar"
        />
      </div>

      <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={form.isCritical}
            onChange={e => onFieldChange('isCritical', e.target.checked)}
            style={{ width: '16px', height: '16px', accentColor: 'var(--ds-danger-main)' }}
          />
          <span style={{ fontSize: 'var(--ds-text-sm)', color: 'var(--ds-neutral-700)', fontWeight: 600 }}>
            Grupo crítico
          </span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={form.continueOnFailure}
            onChange={e => onFieldChange('continueOnFailure', e.target.checked)}
            style={{ width: '16px', height: '16px', accentColor: 'var(--ds-brand-500)' }}
          />
          <span style={{ fontSize: 'var(--ds-text-sm)', color: 'var(--ds-neutral-700)' }}>
            Continuar si falla
          </span>
          <span style={{ fontSize: 'var(--ds-text-xs)', color: 'var(--ds-neutral-400)' }}>
            (desmarcar para detener la cadena)
          </span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={e => onFieldChange('isActive', e.target.checked)}
            style={{ width: '16px', height: '16px', accentColor: 'var(--ds-brand-500)' }}
          />
          <span style={{ fontSize: 'var(--ds-text-sm)', color: 'var(--ds-neutral-700)' }}>Activo</span>
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: 'var(--ds-text-xs)', color: 'var(--ds-neutral-500)' }}>Orden:</span>
          <input
            type="number"
            value={form.sortOrder}
            onChange={e => onFieldChange('sortOrder', Number(e.target.value))}
            style={{
              width: '60px', padding: '4px 6px',
              border: '1px solid var(--ds-neutral-300)', borderRadius: '4px',
              fontSize: 'var(--ds-text-sm)',
            }}
          />
        </div>
      </div>

      {saveError && (
        <div style={{
          padding: '8px 12px', borderRadius: 'var(--ds-radius-lg)',
          background: 'var(--ds-danger-light)', border: '1px solid var(--ds-danger-border)',
          color: 'var(--ds-danger-dark)', fontSize: 'var(--ds-text-sm)',
        }}>
          {saveError}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '4px' }}>
        <AppButton variant="secondary" size="sm" onClick={onCancel} disabled={saving}>Cancelar</AppButton>
        <AppButton
          variant="primary"
          size="sm"
          onClick={onSave}
          loading={saving}
          disabled={!form.groupName.trim() || !form.groupDn.trim()}
        >
          {saveLabel}
        </AppButton>
      </div>
    </div>
  );
}

function GroupRow({
  group, isEditing, editForm, adValidation, validating,
  onEdit, onCancel, onSave, onDelete, onFieldChange, onValidate,
  saving, saveError,
}: {
  group:        InitialGroup;
  isEditing:    boolean;
  editForm:     CreateGroupForm;
  adValidation: AdGroupValidation | null;
  validating:   boolean;
  onEdit:       () => void;
  onCancel:     () => void;
  onSave:       () => void;
  onDelete:     () => void;
  onFieldChange: <K extends keyof CreateGroupForm>(key: K, value: CreateGroupForm[K]) => void;
  onValidate:   () => void;
  saving:       boolean;
  saveError:    string | null;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isEditing) {
    return (
      <div style={{
        padding: '14px', border: '2px solid var(--ds-brand-200)',
        borderRadius: 'var(--ds-radius-lg)', background: 'var(--ds-brand-50)',
      }}>
        <div style={{ fontWeight: 600, fontSize: 'var(--ds-text-sm)', color: 'var(--ds-brand-700)', marginBottom: '12px' }}>
          Editando: {group.groupName}
        </div>
        <GroupForm
          form={editForm} adValidation={adValidation} validating={validating}
          onFieldChange={onFieldChange} onValidate={onValidate}
          onSave={onSave} onCancel={onCancel} saving={saving} saveError={saveError}
          saveLabel="Guardar cambios"
        />
      </div>
    );
  }

  return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      gap:          '10px',
      flexWrap:     'wrap',
      padding:      '10px 14px',
      background:   group.isActive ? 'var(--ds-neutral-0)' : 'var(--ds-neutral-50)',
      border:       '1px solid var(--ds-neutral-200)',
      borderRadius: 'var(--ds-radius-lg)',
      opacity:      group.isActive ? 1 : 0.65,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 'var(--ds-text-sm)', color: 'var(--ds-neutral-900)' }}>
            {group.groupName}
          </span>
          {group.isCritical           && <AppBadge variant="danger"  size="sm">crítico</AppBadge>}
          {!group.continueOnFailure   && <AppBadge variant="warning" size="sm">detiene</AppBadge>}
          {!group.isActive            && <AppBadge variant="neutral" size="sm">inactivo</AppBadge>}
          {group.sortOrder > 0 && (
            <span style={{ fontSize: 'var(--ds-text-xs)', color: 'var(--ds-neutral-400)' }}>
              #{group.sortOrder}
            </span>
          )}
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
        {confirmDelete ? (
          <>
            <AppButton variant="danger" size="sm" onClick={() => { setConfirmDelete(false); onDelete(); }}>
              Confirmar
            </AppButton>
            <AppButton variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </AppButton>
          </>
        ) : (
          <>
            <AppButton variant="secondary" size="sm" onClick={onEdit}>Editar</AppButton>
            <AppButton variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}
              style={{ color: 'var(--ds-danger-main)' }}>
              Eliminar
            </AppButton>
          </>
        )}
      </div>
    </div>
  );
}

export function InitialGroupsPage() {
  const [selectedType,    setSelectedType]    = useState<string | null>(null);
  const [selectedSubType, setSelectedSubType] = useState<string | null>(null);

  const {
    groups, loading, selectScope,
    editingId, editForm, saving, saveError,
    adValidation, validating,
    startEdit, cancelEdit, updateEditField, validateEditGroup, saveEdit, deleteGroup,
    showAddForm, addForm, addAdValidation, addValidating,
    openAddForm, cancelAdd, updateAddField, validateAddGroup, saveAdd,
  } = useInitialGroups();

  const handleSelectType = (typeKey: string) => {
    setSelectedType(typeKey);
    setSelectedSubType(null);
    const type = ACCOUNT_TYPES.find(t => t.typeKey === typeKey);
    if (type && !type.isPrivileged) {
      selectScope(typeKey);
    }
  };

  const handleSelectSubType = (subTypeKey: string) => {
    if (!selectedType) return;
    setSelectedSubType(subTypeKey);
    selectScope(selectedType, subTypeKey);
  };

  const selectedTypeInfo = ACCOUNT_TYPES.find(t => t.typeKey === selectedType);

  const scopeLabel = selectedType
    ? selectedSubType
      ? `${selectedTypeInfo?.label} › ${selectedTypeInfo?.subTypes.find((s) => s.key === selectedSubType)?.label}`
      : selectedTypeInfo?.label
    : null;

  return (
    <div>
      <AppPageHeader
        title="Grupos Iniciales"
        description="Configura los grupos de Active Directory que se asignarán automáticamente al crear cada tipo de cuenta"
      />

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '20px', alignItems: 'start' }}>

        {/* ── Type/subtype selector ─────────────────────────────────────── */}
        <AppCard title="Tipo de cuenta">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {ACCOUNT_TYPES.map(type => (
              <div key={type.typeKey}>
                <button
                  onClick={() => handleSelectType(type.typeKey)}
                  style={{
                    width:        '100%',
                    textAlign:    'left',
                    padding:      '8px 10px',
                    border:       'none',
                    borderRadius: 'var(--ds-radius-lg)',
                    cursor:       'pointer',
                    display:      'flex',
                    alignItems:   'center',
                    gap:          '8px',
                    background:   selectedType === type.typeKey
                      ? (type.isPrivileged ? 'var(--ds-danger-light)' : 'var(--ds-brand-50)')
                      : 'transparent',
                    color:        selectedType === type.typeKey
                      ? (type.isPrivileged ? 'var(--ds-danger-dark)' : 'var(--ds-brand-700)')
                      : 'var(--ds-neutral-700)',
                    fontWeight:   selectedType === type.typeKey ? 600 : 400,
                    fontSize:     'var(--ds-text-sm)',
                  }}
                >
                  <span style={{
                    fontFamily:   'var(--ds-font-mono)',
                    fontSize:     '10px',
                    fontWeight:   700,
                    background:   type.isPrivileged ? 'var(--ds-danger-light)' : 'var(--ds-neutral-100)',
                    color:        type.isPrivileged ? 'var(--ds-danger-dark)' : 'var(--ds-neutral-500)',
                    padding:      '1px 5px',
                    borderRadius: '4px',
                    flexShrink:   0,
                  }}>
                    {type.badge}
                  </span>
                  {type.label}
                </button>

                {/* Sub-types for PRIVILEGED */}
                {type.isPrivileged && selectedType === 'PRIVILEGED' && (
                  <div style={{ paddingLeft: '16px', marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {type.subTypes.map(sub => (
                      <button
                        key={sub.key}
                        onClick={() => handleSelectSubType(sub.key)}
                        style={{
                          textAlign:    'left',
                          padding:      '6px 10px',
                          border:       'none',
                          borderRadius: 'var(--ds-radius-lg)',
                          cursor:       'pointer',
                          fontSize:     'var(--ds-text-xs)',
                          background:   selectedSubType === sub.key ? 'var(--ds-danger-light)' : 'transparent',
                          color:        selectedSubType === sub.key ? 'var(--ds-danger-dark)' : 'var(--ds-neutral-600)',
                          fontWeight:   selectedSubType === sub.key ? 600 : 400,
                        }}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </AppCard>

        {/* ── Groups panel ─────────────────────────────────────────────── */}
        <div>
          {!selectedType || (selectedTypeInfo?.isPrivileged && !selectedSubType) ? (
            <AppCard>
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--ds-neutral-400)' }}>
                {!selectedType
                  ? 'Selecciona un tipo de cuenta para ver sus grupos iniciales.'
                  : 'Selecciona un sub-tipo de Privilegiada para ver sus grupos.'}
              </div>
            </AppCard>
          ) : (
            <AppCard
              title={`Grupos iniciales — ${scopeLabel}`}
              description="Los grupos se asignan automáticamente al crear una cuenta de este tipo. Si un grupo falla, la cuenta siempre se conserva. Grupos con 'detiene' interrumpen la cadena si fallan."
            >
              {loading ? (
                <div className="ds-loading">Cargando grupos…</div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {groups.length === 0 && !showAddForm && (
                      <div style={{
                        padding:    '24px', textAlign: 'center',
                        color:      'var(--ds-neutral-400)', fontSize: 'var(--ds-text-sm)',
                        border:     '1px dashed var(--ds-neutral-200)',
                        borderRadius: 'var(--ds-radius-lg)',
                      }}>
                        No hay grupos configurados para este tipo de cuenta.
                      </div>
                    )}

                    {groups.map(group => (
                      <GroupRow
                        key={group.id}
                        group={group}
                        isEditing={editingId === group.id}
                        editForm={editForm}
                        adValidation={adValidation}
                        validating={validating}
                        onEdit={() => startEdit(group)}
                        onCancel={cancelEdit}
                        onSave={saveEdit}
                        onDelete={() => deleteGroup(group.id)}
                        onFieldChange={updateEditField}
                        onValidate={validateEditGroup}
                        saving={saving}
                        saveError={saveError}
                      />
                    ))}

                    {/* Add form */}
                    {showAddForm && (
                      <div style={{
                        padding: '14px', border: '2px solid var(--ds-success-border)',
                        borderRadius: 'var(--ds-radius-lg)', background: 'var(--ds-success-light)',
                      }}>
                        <div style={{
                          fontWeight: 600, fontSize: 'var(--ds-text-sm)',
                          color: 'var(--ds-success-dark)', marginBottom: '12px',
                        }}>
                          Nuevo grupo inicial
                        </div>
                        <GroupForm
                          form={addForm} adValidation={addAdValidation} validating={addValidating}
                          onFieldChange={updateAddField} onValidate={validateAddGroup}
                          onSave={saveAdd} onCancel={cancelAdd} saving={saving} saveError={saveError}
                          saveLabel="Agregar grupo"
                        />
                      </div>
                    )}
                  </div>

                  {!showAddForm && editingId === null && (
                    <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--ds-neutral-200)' }}>
                      <AppButton variant="secondary" size="sm" onClick={openAddForm}>
                        + Agregar grupo
                      </AppButton>
                    </div>
                  )}
                </>
              )}
            </AppCard>
          )}
        </div>
      </div>
    </div>
  );
}
