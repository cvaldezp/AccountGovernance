import { AppButton } from '../../shared/ui';
import type { CreateResult } from './types';

interface Props {
  result:       CreateResult;
  onNewAccount: () => void;
}

export function CreateResultView({ result, onNewAccount }: Props) {
  const { success, message, samAccountName, userPrincipalName, displayName } = result;

  const failedGroups = result.groupAssignments?.filter(g => !g.success) ?? [];
  const hasWarnings  = (result.warnings?.length ?? 0) > 0 || failedGroups.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '560px', margin: '0 auto' }}>

      {/* Result banner */}
      <div style={{
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'center',
        gap:           '12px',
        padding:       '32px 24px',
        borderRadius:  'var(--ds-radius-xl)',
        textAlign:     'center',
        background:    success ? 'var(--ds-success-light)' : 'var(--ds-danger-light)',
        border:        `1px solid ${success ? 'var(--ds-success-border)' : 'var(--ds-danger-border)'}`,
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
          background:    'var(--ds-neutral-50)',
          border:        '1px solid var(--ds-neutral-200)',
          borderRadius:  'var(--ds-radius-lg)',
          padding:       '16px 18px',
          display:       'flex',
          flexDirection: 'column',
          gap:           '10px',
        }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--ds-text-sm)', color: 'var(--ds-neutral-700)' }}>
            Resumen de la cuenta creada
          </div>
          {[
            { label: 'Nombre',         value: displayName },
            { label: 'sAMAccountName', value: samAccountName },
            { label: 'UPN',            value: userPrincipalName },
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

      {/* Group assignment results */}
      {success && result.groupAssignments && result.groupAssignments.length > 0 && (
        <div style={{
          background:    'var(--ds-neutral-50)',
          border:        '1px solid var(--ds-neutral-200)',
          borderRadius:  'var(--ds-radius-lg)',
          padding:       '14px 18px',
          display:       'flex',
          flexDirection: 'column',
          gap:           '8px',
        }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--ds-text-sm)', color: 'var(--ds-neutral-700)' }}>
            Grupos iniciales
          </div>
          {result.groupAssignments.map(g => (
            <div key={g.groupName} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <span style={{
                fontFamily: 'var(--ds-font-mono)', fontSize: '13px', flexShrink: 0,
                color: g.success ? 'var(--ds-success-dark)' : 'var(--ds-danger-dark)',
              }}>
                {g.success ? '✓' : '✗'}
              </span>
              <div>
                <span style={{ fontSize: 'var(--ds-text-sm)', color: 'var(--ds-neutral-800)' }}>
                  {g.groupName}
                </span>
                {!g.success && g.error && (
                  <div style={{
                    fontSize: 'var(--ds-text-xs)', color: 'var(--ds-danger-dark)',
                    marginTop: '2px', fontFamily: 'var(--ds-font-mono)',
                  }}>
                    {g.error}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Warnings panel — groups not assigned */}
      {success && hasWarnings && (
        <div style={{
          background:    'var(--ds-warning-light, #fffbeb)',
          border:        '1px solid var(--ds-warning-border, #fcd34d)',
          borderRadius:  'var(--ds-radius-lg)',
          padding:       '14px 18px',
          display:       'flex',
          flexDirection: 'column',
          gap:           '6px',
        }}>
          <div style={{
            fontWeight: 600, fontSize: 'var(--ds-text-sm)',
            color:      'var(--ds-warning-dark, #92400e)',
          }}>
            Advertencias
          </div>
          {(result.warnings ?? []).map((w, i) => (
            <div key={i} style={{ fontSize: 'var(--ds-text-sm)', color: 'var(--ds-warning-dark, #92400e)' }}>
              {w}
            </div>
          ))}
          <div style={{ fontSize: 'var(--ds-text-xs)', color: 'var(--ds-neutral-500)', marginTop: '4px' }}>
            La cuenta fue creada correctamente. Los grupos marcados arriba no pudieron asignarse
            y deberán configurarse manualmente en Active Directory.
          </div>
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
