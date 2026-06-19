import { AppButton } from '../../shared/ui';
import type { ValidationResult } from './types';
import { AccountPreview } from './AccountPreview';

interface Props {
  result:      ValidationResult;
  onConfirm:   () => void;
  onBack:      () => void;
}

export function ValidationSummary({ result, onConfirm, onBack }: Props) {
  const { canCreate, errors, warnings, preview } = result;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Status banner */}
      <div style={{
        display:      'flex',
        alignItems:   'center',
        gap:          '12px',
        padding:      '14px 18px',
        borderRadius: 'var(--ds-radius-xl)',
        background:   canCreate ? 'var(--ds-success-light)' : 'var(--ds-danger-light)',
        border:       `1px solid ${canCreate ? 'var(--ds-success-border)' : 'var(--ds-danger-border)'}`,
      }}>
        <span style={{ fontSize: '22px' }}>{canCreate ? '✓' : '✗'}</span>
        <div>
          <div style={{
            fontWeight: 700,
            color: canCreate ? 'var(--ds-success-dark)' : 'var(--ds-danger-dark)',
          }}>
            {canCreate ? 'Validación correcta — la cuenta puede crearse' : 'No se puede crear la cuenta'}
          </div>
          {!canCreate && (
            <div style={{ fontSize: 'var(--ds-text-sm)', color: 'var(--ds-neutral-600)', marginTop: '2px' }}>
              Corrija los errores indicados y vuelva a validar.
            </div>
          )}
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div style={{
          background:   'var(--ds-danger-light)',
          border:       '1px solid var(--ds-danger-border)',
          borderRadius: 'var(--ds-radius-lg)',
          padding:      '14px 16px',
        }}>
          <div style={{
            fontWeight: 600, fontSize: 'var(--ds-text-sm)',
            color: 'var(--ds-danger-dark)', marginBottom: '8px',
          }}>
            Errores ({errors.length})
          </div>
          <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {errors.map((e, i) => (
              <li key={i} style={{ fontSize: 'var(--ds-text-sm)', color: 'var(--ds-danger-dark)' }}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div style={{
          background:   'var(--ds-warning-light, #fffbeb)',
          border:       '1px solid var(--ds-warning-border, #fde68a)',
          borderRadius: 'var(--ds-radius-lg)',
          padding:      '14px 16px',
        }}>
          <div style={{
            fontWeight: 600, fontSize: 'var(--ds-text-sm)',
            color: 'var(--ds-warning-dark, #92400e)', marginBottom: '8px',
          }}>
            Advertencias ({warnings.length})
          </div>
          <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {warnings.map((w, i) => (
              <li key={i} style={{ fontSize: 'var(--ds-text-sm)', color: 'var(--ds-warning-dark, #92400e)' }}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Preview panel */}
      {preview && <AccountPreview preview={preview} />}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <AppButton variant="secondary" size="md" onClick={onBack}>
          Volver al formulario
        </AppButton>
        <AppButton
          variant="primary"
          size="md"
          disabled={!canCreate}
          onClick={onConfirm}
          title={canCreate ? undefined : 'Corrija los errores antes de crear la cuenta'}
        >
          Confirmar y crear cuenta
        </AppButton>
      </div>
    </div>
  );
}
