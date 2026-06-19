import { AppCard, AppButton, AppBadge, AppPageHeader } from '../../shared/ui';
import { AccountTypeSelector } from './AccountTypeSelector';
import { SubTypeSelector } from './SubTypeSelector';
import { DynamicAccountForm } from './DynamicAccountForm';
import { AccountPreview } from './AccountPreview';
import { useAccountCreation } from './useAccountCreation';

export function CreateAccountPage() {
  const {
    accountTypes,
    typesLoading,
    selectedType,
    selectedSubType,
    typeInfo,
    subTypeInfo,
    form,
    preview,
    emailValidation,
    selectType,
    selectSubType,
    resetType,
    updateField,
    generatePassword,
    validateRecoveryEmail,
  } = useAccountCreation();

  // Step 1: select type
  if (!selectedType) {
    return (
      <div>
        <AppPageHeader
          title="Creación de Cuentas"
          description="Selecciona el tipo de cuenta que deseas crear"
        />
        <AppCard title="Tipo de cuenta" description="Define el propósito y el nivel de acceso de la nueva cuenta">
          {typesLoading ? (
            <div className="ds-loading">Cargando tipos de cuenta…</div>
          ) : (
            <AccountTypeSelector
              accountTypes={accountTypes}
              selected={selectedType}
              onSelect={selectType}
            />
          )}
        </AppCard>
      </div>
    );
  }

  // Step 2 (PRIVILEGED only): select sub-type
  if (selectedType === 'PRIVILEGED' && !selectedSubType) {
    return (
      <div>
        <AppPageHeader
          title="Creación de Cuentas"
          description="Configura y previsualiza los parámetros de la nueva cuenta antes de crearla"
        />

        <div style={{
          display:      'flex',
          alignItems:   'center',
          gap:          '12px',
          padding:      '10px 16px',
          marginBottom: '20px',
          background:   'var(--ds-danger-light)',
          border:       '1px solid var(--ds-danger-border)',
          borderRadius: 'var(--ds-radius-xl)',
        }}>
          <span style={{
            fontFamily: 'var(--ds-font-mono)', fontSize: '11px', fontWeight: 700,
            background: 'var(--ds-danger-main)', color: 'white', padding: '2px 8px', borderRadius: '4px',
          }}>
            PRV
          </span>
          <span style={{ fontWeight: 600, color: 'var(--ds-neutral-800)' }}>Privilegiada</span>
          <AppBadge variant="danger" size="sm">Privilegiada</AppBadge>
          <div style={{ flex: 1 }} />
          <AppButton variant="ghost" size="sm" onClick={resetType}>Cambiar tipo</AppButton>
        </div>

        <AppCard title="Sub-tipo de cuenta" description="El área funcional determina el prefijo y la OU de destino">
          <SubTypeSelector
            subTypes={typeInfo?.subTypes ?? []}
            selected={selectedSubType}
            onSelect={selectSubType}
          />
        </AppCard>
      </div>
    );
  }

  // Step 3: form + preview
  const isPrivileged = typeInfo?.isPrivileged ?? false;

  return (
    <div>
      <AppPageHeader
        title="Creación de Cuentas"
        description="Configura y previsualiza los parámetros de la nueva cuenta antes de crearla"
      />

      {/* Selected type / subtype banner */}
      <div style={{
        display:      'flex',
        alignItems:   'center',
        gap:          '12px',
        padding:      '10px 16px',
        marginBottom: '20px',
        background:   isPrivileged ? 'var(--ds-danger-light)' : 'var(--ds-brand-50)',
        border:       `1px solid ${isPrivileged ? 'var(--ds-danger-border)' : 'var(--ds-brand-100)'}`,
        borderRadius: 'var(--ds-radius-xl)',
      }}>
        <span style={{
          fontFamily:  'var(--ds-font-mono)',
          fontSize:    '11px',
          fontWeight:  700,
          background:  isPrivileged ? 'var(--ds-danger-main)' : 'var(--ds-brand-500)',
          color:       'white',
          padding:     '2px 8px',
          borderRadius:'4px',
        }}>
          {typeInfo?.badge}
        </span>

        <span style={{ fontWeight: 600, color: 'var(--ds-neutral-800)' }}>
          {typeInfo?.label}
        </span>

        {isPrivileged && subTypeInfo && (
          <>
            <span style={{ color: 'var(--ds-neutral-400)' }}>›</span>
            <span style={{ fontWeight: 600, color: 'var(--ds-danger-dark)' }}>
              {subTypeInfo.label}
            </span>
            <AppBadge variant="danger" size="sm">Privilegiada</AppBadge>
            <span style={{ fontSize: 'var(--ds-text-sm)', color: 'var(--ds-neutral-500)' }}>
              Prefijo:{' '}
              <code style={{ fontFamily: 'var(--ds-font-mono)', fontWeight: 600 }}>
                {subTypeInfo.samPrefix}.
              </code>
            </span>
          </>
        )}

        <div style={{ flex: 1 }} />

        {isPrivileged && (
          <AppButton variant="ghost" size="sm" onClick={() => selectType('PRIVILEGED')}>
            Cambiar sub-tipo
          </AppButton>
        )}
        <AppButton variant="ghost" size="sm" onClick={resetType}>
          Cambiar tipo
        </AppButton>
      </div>

      {/* Form + Preview two-column layout */}
      <div style={{
        display:             'grid',
        gridTemplateColumns: '1fr 380px',
        gap:                 '20px',
        alignItems:          'start',
      }}>
        <AppCard title="Datos de la cuenta">
          <DynamicAccountForm
            typeKey={selectedType}
            form={form}
            emailValidation={emailValidation}
            onFieldChange={updateField}
            onValidateEmail={validateRecoveryEmail}
            onGenPassword={generatePassword}
          />

          <div style={{
            marginTop:      '20px',
            paddingTop:     '16px',
            borderTop:      '1px solid var(--ds-neutral-200)',
            display:        'flex',
            gap:            '10px',
            justifyContent: 'flex-end',
          }}>
            <AppButton variant="secondary" size="md" onClick={resetType}>
              Cancelar
            </AppButton>
            <AppButton
              variant="primary"
              size="md"
              disabled
              title="La creación de cuentas estará disponible en la siguiente fase"
            >
              Crear cuenta
            </AppButton>
          </div>
        </AppCard>

        <AccountPreview preview={preview} />
      </div>
    </div>
  );
}
