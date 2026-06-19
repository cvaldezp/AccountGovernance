import { useState } from 'react';
import { AppInput, AppButton } from '../../shared/ui';
import type { AccountTypeKey, AccountFormData, RecoveryEmailValidation } from './types';

const PASSWORD_LENGTHS = [12, 14, 16, 20, 24, 32];

interface Props {
  typeKey:         AccountTypeKey;
  form:            AccountFormData;
  emailValidation: RecoveryEmailValidation;
  onFieldChange:   <K extends keyof AccountFormData>(key: K, value: AccountFormData[K]) => void;
  onValidateEmail: () => void;
  onGenPassword:   () => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize:      'var(--ds-text-xs)',
      fontWeight:    700,
      color:         'var(--ds-neutral-400)',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      marginBottom:  '10px',
      marginTop:     '4px',
    }}>
      {children}
    </div>
  );
}

const isService    = (k: AccountTypeKey) => k === 'SERVICE';
const isPartner    = (k: AccountTypeKey) => k === 'PARTNER';

export function DynamicAccountForm({
  typeKey,
  form,
  emailValidation,
  onFieldChange,
  onValidateEmail,
  onGenPassword,
}: Props) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* ── Identidad ───────────────────────────────────────────────────── */}
      <SectionLabel>Identidad</SectionLabel>

      {isService(typeKey) ? (
        <AppInput
          label="Nombre del servicio *"
          placeholder="ej. svc-ldap-sync"
          value={form.serviceName}
          onChange={e => onFieldChange('serviceName', e.target.value)}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <AppInput
            label="Primer nombre *"
            placeholder="ej. Juan"
            value={form.firstName}
            onChange={e => onFieldChange('firstName', e.target.value)}
          />
          <AppInput
            label="Primer apellido *"
            placeholder="ej. Pérez"
            value={form.lastName1}
            onChange={e => onFieldChange('lastName1', e.target.value)}
          />
          <AppInput
            label="Segundo apellido"
            placeholder="ej. García"
            value={form.lastName2}
            onChange={e => onFieldChange('lastName2', e.target.value)}
            style={{ gridColumn: 'span 2' }}
          />
        </div>
      )}

      {/* ── Organización ────────────────────────────────────────────────── */}
      <SectionLabel>Organización</SectionLabel>

      {isPartner(typeKey) && (
        <AppInput
          label="Empresa *"
          placeholder="ej. Acme Corp."
          value={form.company}
          onChange={e => onFieldChange('company', e.target.value)}
        />
      )}

      <AppInput
        label="Departamento *"
        placeholder="ej. Tecnología"
        value={form.department}
        onChange={e => onFieldChange('department', e.target.value)}
      />

      {isService(typeKey) && (
        <div className="ds-input">
          <label className="ds-input__label">Descripción</label>
          <textarea
            className="ds-input__field"
            placeholder="Descripción del servicio o aplicación"
            rows={3}
            value={form.description}
            onChange={e => onFieldChange('description', e.target.value)}
          />
        </div>
      )}

      {/* ── Correo de recuperación ───────────────────────────────────────── */}
      <SectionLabel>Correo de recuperación</SectionLabel>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <AppInput
            label="Correo de recuperación *"
            placeholder="usuario@usfq.edu.ec"
            type="email"
            value={form.recoveryEmail}
            onChange={e => onFieldChange('recoveryEmail', e.target.value)}
            hint="Debe corresponder a un usuario existente en AD"
          />
        </div>
        <AppButton
          variant="secondary"
          size="sm"
          onClick={onValidateEmail}
          disabled={!form.recoveryEmail.trim() || emailValidation.status === 'loading'}
          loading={emailValidation.status === 'loading'}
          style={{ marginBottom: emailValidation.status !== 'idle' ? '0' : undefined, flexShrink: 0 }}
        >
          Validar en AD
        </AppButton>
      </div>

      {emailValidation.status !== 'idle' && emailValidation.status !== 'loading' && (
        <div style={{
          display:      'flex',
          alignItems:   'center',
          gap:          '8px',
          padding:      '8px 12px',
          borderRadius: 'var(--ds-radius-lg)',
          fontSize:     'var(--ds-text-sm)',
          background:   emailValidation.status === 'valid' ? 'var(--ds-success-light)' : 'var(--ds-danger-light)',
          border:       `1px solid ${emailValidation.status === 'valid' ? 'var(--ds-success-border)' : 'var(--ds-danger-border)'}`,
          color:        emailValidation.status === 'valid' ? 'var(--ds-success-dark)' : 'var(--ds-danger-dark)',
        }}>
          <span>{emailValidation.status === 'valid' ? '✓' : '✗'}</span>
          <span>{emailValidation.message}</span>
        </div>
      )}

      {/* ── Contraseña ───────────────────────────────────────────────────── */}
      <SectionLabel>Contraseña</SectionLabel>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
        <div className="ds-input" style={{ width: '100px', flexShrink: 0 }}>
          <label className="ds-input__label">Longitud</label>
          <select
            className="ds-input__field"
            value={form.passwordLength}
            onChange={e => onFieldChange('passwordLength', Number(e.target.value))}
          >
            {PASSWORD_LENGTHS.map(len => (
              <option key={len} value={len}>{len}</option>
            ))}
          </select>
        </div>
        <AppButton
          variant="secondary"
          size="sm"
          onClick={onGenPassword}
          style={{ flexShrink: 0, marginBottom: '0' }}
        >
          Generar contraseña
        </AppButton>
      </div>

      {form.password && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <AppInput
              label="Contraseña generada"
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              readOnly
              style={{ paddingRight: '40px', fontFamily: 'var(--ds-font-mono)' }}
            />
          </div>
          <AppButton
            variant="ghost"
            size="sm"
            onClick={() => setShowPassword(v => !v)}
            style={{ flexShrink: 0 }}
            title={showPassword ? 'Ocultar' : 'Mostrar'}
          >
            {showPassword ? 'Ocultar' : 'Mostrar'}
          </AppButton>
          <AppButton
            variant="ghost"
            size="sm"
            onClick={() => {
              if (form.password) navigator.clipboard.writeText(form.password);
            }}
            style={{ flexShrink: 0 }}
            title="Copiar al portapapeles"
          >
            Copiar
          </AppButton>
        </div>
      )}

      {!form.password && (
        <div style={{
          padding:      '10px 12px',
          borderRadius: 'var(--ds-radius-lg)',
          background:   'var(--ds-neutral-50)',
          fontSize:     'var(--ds-text-sm)',
          color:        'var(--ds-neutral-400)',
          border:       '1px dashed var(--ds-neutral-200)',
        }}>
          Usa "Generar contraseña" para crear una contraseña segura de {form.passwordLength} caracteres.
        </div>
      )}

    </div>
  );
}
