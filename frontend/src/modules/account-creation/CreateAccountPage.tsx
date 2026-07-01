import { AppCard, AppButton, AppBadge, AppPageHeader } from '../../shared/ui';
import { AccountTypeSelector } from './AccountTypeSelector';
import { SubTypeSelector } from './SubTypeSelector';
import { DynamicAccountForm } from './DynamicAccountForm';
import { AccountPreview } from './AccountPreview';
import { ValidationSummary } from './ValidationSummary';
import { CreateResultView } from './CreateResultView';
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
    expirationConfig,
    creationStep,
    validationResult,
    createResult,
    selectType,
    selectSubType,
    resetType,
    backToForm,
    updateField,
    generatePassword,
    validateRecoveryEmail,
    validateAndProceed,
    confirmCreate,
  } = useAccountCreation();

  // ── Step 1: select type ────────────────────────────────────────────────────
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

  // ── Step 2 (PRIVILEGED only): select sub-type ──────────────────────────────
  if (selectedType === 'PRIVILEGED' && !selectedSubType) {
    return (
      <div>
        <AppPageHeader
          title="Creación de Cuentas"
          description="Configura y previsualiza los parámetros de la nueva cuenta antes de crearla"
        />

        <TypeBanner typeInfo={typeInfo} subTypeInfo={null} onReset={resetType} onChangeSubType={undefined} />

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

  const isPrivileged = typeInfo?.isPrivileged ?? false;

  // ── Step: result ─────────────────────────────────────────────────────────
  if (creationStep === 'result' && createResult) {
    return (
      <div>
        <AppPageHeader
          title="Creación de Cuentas"
          description={createResult.success ? 'La cuenta ha sido creada en Active Directory' : 'Error al crear la cuenta'}
        />
        <AppCard title={createResult.success ? 'Cuenta creada' : 'Error'}>
          <CreateResultView result={createResult} onNewAccount={resetType} />
        </AppCard>
      </div>
    );
  }

  // ── Step: validating / confirming ─────────────────────────────────────────
  if (creationStep === 'validating' || creationStep === 'confirming' || creationStep === 'creating') {
    return (
      <div>
        <AppPageHeader
          title="Creación de Cuentas"
          description="Verificando parámetros antes de crear la cuenta"
        />

        <TypeBanner
          typeInfo={typeInfo}
          subTypeInfo={subTypeInfo ?? null}
          onReset={resetType}
          onChangeSubType={isPrivileged ? () => selectType('PRIVILEGED') : undefined}
        />

        <AppCard title="Validación previa">
          {(creationStep === 'validating' || creationStep === 'creating') ? (
            <div style={{ padding: '32px', textAlign: 'center' }}>
              <div className="ds-loading" style={{ marginBottom: '12px' }} />
              <div style={{ color: 'var(--ds-neutral-600)', fontSize: 'var(--ds-text-sm)' }}>
                {creationStep === 'validating'
                  ? 'Verificando parámetros en Active Directory…'
                  : 'Creando cuenta en Active Directory…'}
              </div>
            </div>
          ) : validationResult ? (
            <ValidationSummary
              result={validationResult}
              onConfirm={confirmCreate}
              onBack={backToForm}
            />
          ) : null}
        </AppCard>
      </div>
    );
  }

  // ── Step 3: form + preview (default) ─────────────────────────────────────
  const isFormReady =
    form.accountName.trim().length > 0 &&
    form.firstName.trim().length > 0 &&
    form.apellidos.trim().length > 0 &&
    form.description.trim().length > 0 &&
    form.password.length > 0 &&
    emailValidation.status === 'valid';

  return (
    <div>
      <AppPageHeader
        title="Creación de Cuentas"
        description="Configura y previsualiza los parámetros de la nueva cuenta antes de crearla"
      />

      <TypeBanner
        typeInfo={typeInfo}
        subTypeInfo={subTypeInfo ?? null}
        onReset={resetType}
        onChangeSubType={isPrivileged ? () => selectType('PRIVILEGED') : undefined}
      />

      <div style={{
        display:             'grid',
        gridTemplateColumns: '1fr 380px',
        gap:                 '20px',
        alignItems:          'start',
      }}>
        <AppCard title="Datos de la cuenta">
          <DynamicAccountForm
            form={form}
            emailValidation={emailValidation}
            expirationConfig={expirationConfig}
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
              disabled={!isFormReady}
              onClick={validateAndProceed}
              title={isFormReady ? undefined : 'Complete todos los campos y valide el correo de recuperación'}
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

// ── Internal sub-component ────────────────────────────────────────────────────

interface TypeBannerProps {
  typeInfo:        ReturnType<typeof useAccountCreation>['typeInfo'];
  subTypeInfo:     ReturnType<typeof useAccountCreation>['subTypeInfo'] | null;
  onReset:         () => void;
  onChangeSubType: (() => void) | undefined;
}

function TypeBanner({ typeInfo, subTypeInfo, onReset, onChangeSubType }: TypeBannerProps) {
  const isPrivileged = typeInfo?.isPrivileged ?? false;
  return (
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
              {subTypeInfo.samPrefix}
            </code>
          </span>
        </>
      )}

      <div style={{ flex: 1 }} />

      {onChangeSubType && (
        <AppButton variant="ghost" size="sm" onClick={onChangeSubType}>
          Cambiar sub-tipo
        </AppButton>
      )}
      <AppButton variant="ghost" size="sm" onClick={onReset}>
        Cambiar tipo
      </AppButton>
    </div>
  );
}
