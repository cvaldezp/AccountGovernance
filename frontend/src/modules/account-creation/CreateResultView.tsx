import { AppButton } from '../../shared/ui';
import type { CreateResult } from './types';

interface Props {
  result:    CreateResult;
  onNewAccount: () => void;
}

export function CreateResultView({ result, onNewAccount }: Props) {
  const { success, message, samAccountName, userPrincipalName, displayName } = result;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '560px', margin: '0 auto' }}>

      {/* Result banner */}
      <div style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        gap:            '12px',
        padding:        '32px 24px',
        borderRadius:   'var(--ds-radius-xl)',
        textAlign:      'center',
        background:     success ? 'var(--ds-success-light)' : 'var(--ds-danger-light)',
        border:         `1px solid ${success ? 'var(--ds-success-border)' : 'var(--ds-danger-border)'}`,
      }}>
        <span style={{ fontSize: '40px' }}>{success ? '✓' : '✗'}</span>
        <div style={{
          fontWeight: 700, fontSize: 'var(--ds-text-lg)',
          color: success ? 'var(--ds-success-dark)' : 'var(--ds-danger-dark)',
        }}>
          {success ? 'Cuenta creada correctamente' : 'Error al crear la cuenta'}
        </div>
        <div style={{ fontSize: 'var(--ds-text-sm)', color: 'var(--ds-neutral-700)' }}>
          {message}
        </div>
      </div>

      {/* Account details (on success) */}
      {success && (samAccountName || userPrincipalName || displayName) && (
        <div style={{
          background:   'var(--ds-neutral-50)',
          border:       '1px solid var(--ds-neutral-200)',
          borderRadius: 'var(--ds-radius-lg)',
          padding:      '16px 18px',
          display:      'flex',
          flexDirection:'column',
          gap:          '10px',
        }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--ds-text-sm)', color: 'var(--ds-neutral-700)' }}>
            Resumen de la cuenta creada
          </div>
          {[
            { label: 'Nombre',           value: displayName },
            { label: 'sAMAccountName',   value: samAccountName },
            { label: 'UPN',              value: userPrincipalName },
          ].filter(r => !!r.value).map(row => (
            <div key={row.label} style={{ display: 'flex', gap: '12px', alignItems: 'baseline' }}>
              <span style={{
                fontFamily: 'var(--ds-font-mono)', fontSize: '11px', fontWeight: 600,
                color:      'var(--ds-neutral-500)', minWidth: '120px',
              }}>
                {row.label}
              </span>
              <code style={{ fontFamily: 'var(--ds-font-mono)', fontSize: '13px', color: 'var(--ds-neutral-800)' }}>
                {row.value}
              </code>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <AppButton variant="primary" size="md" onClick={onNewAccount}>
          {success ? 'Crear otra cuenta' : 'Intentar de nuevo'}
        </AppButton>
      </div>
    </div>
  );
}
