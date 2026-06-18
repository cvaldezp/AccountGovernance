import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/useAuth';
import { useRouter } from '../../routes/AppRoutes';
import { userProfileAgent } from '../../agents/UserProfileAgent';
import { userStatusAgent } from '../../agents/UserStatusAgent';
import { useFieldConfig } from '../../hooks/useFieldConfig';
import {
  getViewableFields,
  getEditableFields,
  getReadOnlyFields,
} from '../../skills/PermissionValidationSkill';
import { AppButton, AppCard, AppBadge, AppPageHeader } from '../../shared/ui';
import type { User, FieldName, FieldConfig } from '../../types';

// ── Role permissions matrix panel ────────────────────────────────────────────
// Shows what the active role can do with each AD field in this view.

function RolePermissionsPanel({ fieldConfigs }: { fieldConfigs: FieldConfig[] }) {
  const allVisible  = getViewableFields(fieldConfigs);
  const editable    = getEditableFields(fieldConfigs);
  const readOnly    = getReadOnlyFields(fieldConfigs);
  const hiddenCount = fieldConfigs.length - allVisible.length;

  if (allVisible.length === 0 && hiddenCount === 0) return null;

  return (
    <div
      style={{
        background: 'var(--ds-neutral-50)',
        border: '1px solid var(--ds-neutral-200)',
        borderRadius: 'var(--ds-radius-xl)',
        padding: '14px 16px',
        marginBottom: '20px',
      }}
    >
      <div
        style={{
          fontSize: '11px',
          fontWeight: 700,
          color: 'var(--ds-neutral-500)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: '10px',
        }}
      >
        Acceso de tu rol en esta pantalla
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: hiddenCount > 0 ? '10px' : '0' }}>
        {editable.map(f => (
          <span
            key={f.fieldKey}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 10px',
              borderRadius: 'var(--ds-radius-full)',
              background: 'var(--ds-success-light)',
              color: 'var(--ds-success-dark)',
              border: '1px solid var(--ds-success-border)',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <span style={{ fontSize: '10px' }}>&#9998;</span>
            {f.displayName}
          </span>
        ))}
        {readOnly.map(f => (
          <span
            key={f.fieldKey}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 10px',
              borderRadius: 'var(--ds-radius-full)',
              background: 'var(--ds-neutral-100)',
              color: 'var(--ds-neutral-600)',
              border: '1px solid var(--ds-neutral-200)',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            <span style={{ fontSize: '10px' }}>&#9673;</span>
            {f.displayName}
          </span>
        ))}
      </div>

      {hiddenCount > 0 && (
        <div style={{ fontSize: '11px', color: 'var(--ds-neutral-400)' }}>
          {hiddenCount} campo(s) no visible(s) para tu rol.
        </div>
      )}
    </div>
  );
}

// ── Internal: renders the right input control per fieldType ──────────────────
function FieldInput({
  fieldConf,
  value,
  onChange,
}: {
  fieldConf: FieldConfig;
  value: string;
  onChange: (v: string) => void;
}) {
  if (fieldConf.fieldType === 'select' && fieldConf.allowedValues) {
    return (
      <select
        className="ds-input__field"
        value={value}
        onChange={e => onChange(e.target.value)}
        autoFocus
      >
        {fieldConf.allowedValues.map(v => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>
    );
  }
  if (fieldConf.fieldType === 'textarea') {
    return (
      <textarea
        className="ds-input__field"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={fieldConf.placeholder ?? ''}
        rows={3}
        autoFocus
      />
    );
  }
  return (
    <input
      className="ds-input__field"
      type={fieldConf.fieldType === 'email' ? 'email' : 'text'}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={fieldConf.placeholder ?? ''}
      autoFocus
    />
  );
}

// ── Internal: read-only display of a field value ─────────────────────────────
function FieldValueDisplay({ adAttributeName, value }: { adAttributeName: string; value: string }) {
  if (adAttributeName === 'AccountStatus') {
    const variant =
      value === 'Enabled' ? 'success' :
      value === 'Locked'  ? 'warning' :
      'danger';
    const label =
      value === 'Enabled' ? 'Habilitada' :
      value === 'Locked'  ? 'Bloqueada'  :
      'Deshabilitada';
    return <AppBadge variant={variant}>{label}</AppBadge>;
  }
  if (!value) {
    return <em style={{ color: 'var(--ds-neutral-400)', fontSize: '13px' }}>Sin valor</em>;
  }
  return <span>{value}</span>;
}

// ── Internal: one attribute row ──────────────────────────────────────────────
function AttributeRow({
  fieldConf,
  value,
  isEditing,
  editValue,
  saving,
  onStartEdit,
  onChangeEdit,
  onSave,
  onCancel,
}: {
  fieldConf: FieldConfig;
  value: string;
  isEditing: boolean;
  editValue: string;
  saving: boolean;
  onStartEdit: () => void;
  onChangeEdit: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const isStatusField = fieldConf.adAttributeName === 'AccountStatus';

  return (
    <div style={{ padding: '14px 0', borderBottom: '1px solid var(--ds-neutral-100)' }}>
      <div className="detail-field-label">
        {fieldConf.displayName}
        {fieldConf.isSensitive && (
          <span className="field-sensitive-badge">sensible</span>
        )}
        {fieldConf.canView && !fieldConf.canEdit && (
          <span className="field-readonly-badge">solo lectura</span>
        )}
      </div>

      {fieldConf.description && (
        <div style={{ fontSize: '11px', color: 'var(--ds-neutral-400)', marginTop: '2px', marginBottom: '6px', lineHeight: 1.4 }}>
          {fieldConf.description}
        </div>
      )}

      {isEditing ? (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <FieldInput fieldConf={fieldConf} value={editValue} onChange={onChangeEdit} />
          <AppButton size="sm" variant="primary" onClick={onSave} loading={saving}>
            Guardar
          </AppButton>
          <AppButton size="sm" variant="secondary" onClick={onCancel}>
            Cancelar
          </AppButton>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="detail-field-value">
            <FieldValueDisplay adAttributeName={fieldConf.adAttributeName} value={value} />
          </span>
          {fieldConf.canEdit && !isStatusField && (
            <AppButton size="sm" variant="secondary" onClick={onStartEdit}>
              Editar
            </AppButton>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function UserDetailPage() {
  const { user: operator } = useAuth();
  const { params, navigate } = useRouter();
  const { fieldConfigs, loading: configLoading } = useFieldConfig();
  const userId = params.userId ?? '';

  const [userData, setUserData]   = useState<User | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [feedback, setFeedback]   = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [saving, setSaving]       = useState(false);

  const viewableFields  = getViewableFields(fieldConfigs);
  const statusFieldConf = viewableFields.find(f => f.adAttributeName === 'AccountStatus');
  const canEditStatus   = !!statusFieldConf?.canEdit;

  useEffect(() => {
    if (!userId || !operator) return;
    setLoading(true);
    setLoadError(null);
    console.debug(`[AccountGovernance] UserDetailPage loading samAccountName: ${userId}`);
    userProfileAgent.getProfile(userId, operator.role).then(res => {
      if (res.success && res.data) {
        setUserData(res.data);
      } else {
        setLoadError(res.error ?? 'Usuario no encontrado.');
      }
      setLoading(false);
    });
  }, [userId, operator?.role]);

  const showFeedback = (type: 'success' | 'error', msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleSave = async (adAttributeName: string, displayName: string) => {
    if (!operator || !userData) return;
    setSaving(true);
    const res = await userProfileAgent.updateField(
      userId,
      adAttributeName as FieldName,
      editValue,
      operator.name,
      operator.role,
    );
    if (res.success) {
      setUserData(prev =>
        prev ? { ...prev, attributes: { ...prev.attributes, [adAttributeName]: editValue } } : prev,
      );
      showFeedback('success', `"${displayName}" actualizado correctamente`);
    } else {
      showFeedback('error', res.error ?? 'Error al actualizar');
    }
    setEditField(null);
    setSaving(false);
  };

  const handleStatusToggle = async () => {
    if (!operator || !userData) return;
    setSaving(true);
    const isEnabled = userData.attributes.AccountStatus === 'Enabled';
    const res = isEnabled
      ? await userStatusAgent.disable(userId, operator.name, operator.role)
      : await userStatusAgent.enable(userId, operator.name, operator.role);

    if (res.success) {
      const newStatus: 'Enabled' | 'Disabled' = isEnabled ? 'Disabled' : 'Enabled';
      setUserData(prev =>
        prev ? { ...prev, attributes: { ...prev.attributes, AccountStatus: newStatus } } : prev,
      );
      showFeedback('success', `Cuenta ${newStatus === 'Enabled' ? 'habilitada' : 'deshabilitada'} correctamente`);
    } else {
      showFeedback('error', res.error ?? 'Error al cambiar estado');
    }
    setSaving(false);
  };

  // ── Guard states ─────────────────────────────────────────────────────────────

  if (!userId) {
    return (
      <div>
        <div className="ds-alert ds-alert--error">No se especific&oacute; un usuario.</div>
        <AppButton variant="secondary" onClick={() => navigate('search')}>Volver a B&uacute;squeda</AppButton>
      </div>
    );
  }

  if (loading || configLoading) {
    return <div className="ds-loading">Cargando datos del usuario...</div>;
  }

  if (!userData) {
    return (
      <div>
        <div className="ds-alert ds-alert--error">
          {loadError ?? 'Usuario no encontrado.'}
        </div>
        <AppButton variant="secondary" onClick={() => navigate('search')}>Volver a B&uacute;squeda</AppButton>
      </div>
    );
  }

  const initials      = userData.displayName.split(' ').map(w => w[0]).slice(0, 2).join('');
  const accountStatus = userData.attributes.AccountStatus;
  const statusVariant =
    accountStatus === 'Enabled' ? 'success' :
    accountStatus === 'Locked'  ? 'warning' :
    'danger';
  const statusLabel =
    accountStatus === 'Enabled' ? 'Habilitada'   :
    accountStatus === 'Locked'  ? 'Bloqueada'    :
    'Deshabilitada';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <AppPageHeader
        title={userData.displayName}
        description={`${userData.jobTitle} — ${userData.department}`}
        breadcrumb={[
          { label: 'Buscar Usuario', onClick: () => navigate('search') },
          { label: userData.displayName },
        ]}
        action={
          <AppBadge variant={statusVariant} style={{ fontSize: '13px', padding: '4px 12px' }}>
            {statusLabel}
          </AppBadge>
        }
      />

      {feedback && (
        <div className={`ds-alert ds-alert--${feedback.type}`}>{feedback.msg}</div>
      )}

      {/* User header card */}
      <AppCard style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            className="user-avatar"
            style={{
              width: '56px',
              height: '56px',
              fontSize: '20px',
              background:
                accountStatus === 'Enabled' ? 'var(--ds-success-main)' :
                accountStatus === 'Locked'  ? 'var(--ds-warning-main)' :
                'var(--ds-danger-main)',
            }}
          >
            {initials}
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700 }}>{userData.displayName}</div>
            <div style={{ fontSize: '13px', color: 'var(--ds-neutral-500)', marginTop: '2px' }}>
              {userData.email}
            </div>
          </div>
        </div>
      </AppCard>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* AD attributes — dynamic from fieldConfigs + role matrix */}
        <AppCard
          title="Atributos de Active Directory"
          action={
            <span style={{ fontSize: '12px', color: 'var(--ds-neutral-400)' }}>
              {viewableFields.length} campo(s) visibles
            </span>
          }
        >
          <RolePermissionsPanel fieldConfigs={fieldConfigs} />

          {viewableFields.length === 0 ? (
            <p style={{ color: 'var(--ds-neutral-400)', fontSize: '14px' }}>
              Tu rol no tiene acceso a ning&uacute;n atributo.
            </p>
          ) : (
            viewableFields.map(fieldConf => {
              const rawValue =
                (userData.attributes as unknown as Record<string, string>)[fieldConf.adAttributeName] ?? '';
              return (
                <AttributeRow
                  key={fieldConf.fieldKey}
                  fieldConf={fieldConf}
                  value={rawValue}
                  isEditing={editField === fieldConf.adAttributeName}
                  editValue={editValue}
                  saving={saving}
                  onStartEdit={() => { setEditField(fieldConf.adAttributeName); setEditValue(rawValue); }}
                  onChangeEdit={setEditValue}
                  onSave={() => handleSave(fieldConf.adAttributeName, fieldConf.displayName)}
                  onCancel={() => setEditField(null)}
                />
              );
            })
          )}
        </AppCard>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <AppCard title="Informaci&oacute;n General">
            <div className="detail-grid">
              {[
                { label: 'Usuario',      value: userData.username   },
                { label: 'Email',        value: userData.email      },
                { label: 'Departamento', value: userData.department },
                { label: 'Cargo',        value: userData.jobTitle   },
              ].map(item => (
                <div key={item.label}>
                  <div className="detail-field-label">{item.label}</div>
                  <div className="detail-field-value">{item.value}</div>
                </div>
              ))}
            </div>
          </AppCard>

          {/* Account status management — only shown when fieldConfig grants canEdit */}
          {canEditStatus && (
            <AppCard title="Gesti&oacute;n de Cuenta">
              <p style={{ fontSize: '13px', color: 'var(--ds-neutral-500)', marginBottom: '14px' }}>
                Estado actual:{' '}
                <strong
                  style={{
                    color:
                      accountStatus === 'Enabled' ? 'var(--ds-success-dark)' :
                      accountStatus === 'Locked'  ? 'var(--ds-warning-dark)' :
                      'var(--ds-danger-dark)',
                  }}
                >
                  {statusLabel}
                </strong>
              </p>
              {accountStatus === 'Locked' ? (
                <div className="ds-alert ds-alert--warning">
                  Cuenta bloqueada por intentos fallidos. Contacta a Seguridades para desbloquear.
                </div>
              ) : (
                <AppButton
                  variant={accountStatus === 'Enabled' ? 'danger' : 'success'}
                  onClick={handleStatusToggle}
                  loading={saving}
                >
                  {accountStatus === 'Enabled' ? 'Deshabilitar Cuenta' : 'Habilitar Cuenta'}
                </AppButton>
              )}
            </AppCard>
          )}
        </div>
      </div>
    </div>
  );
}
