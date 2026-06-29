import { AppButton } from '../../shared/ui';
import type { ValidationResult, ValidationChecks } from './types';
import { AccountPreview } from './AccountPreview';

interface Props {
  result:    ValidationResult;
  onConfirm: () => void;
  onBack:    () => void;
}

// ── Checklist ──────────────────────────────────────────────────────────────────

interface CheckItem {
  label:      string;
  value:      boolean | null;
  detail?:    string;
}

function buildChecklist(checks: ValidationChecks, targetOU?: string | null): CheckItem[] {
  return [
    { label: 'Configuración encontrada',    value: checks.configFound },
    { label: 'sAMAccountName disponible',   value: checks.samAvailable },
    { label: 'UPN disponible',              value: checks.upnAvailable },
    { label: 'Correo de recuperación válido', value: checks.recoveryEmailValid },
    { label: 'Contraseña válida',           value: checks.passwordValid },
    {
      label:  'OU de destino válida',
      value:  checks.ouValid,
      detail: checks.ouValid === false && targetOU ? targetOU : undefined,
    },
  ];
}

function CheckRow({ item }: { item: CheckItem }) {
  const isNull = item.value === null;
  const icon   = isNull ? '–' : item.value ? '✓' : '✗';
  const color  = isNull
    ? 'var(--ds-neutral-400)'
    : item.value
      ? 'var(--ds-success-dark)'
      : 'var(--ds-danger-dark)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{
          fontFamily:  'var(--ds-font-mono)',
          fontWeight:  700,
          fontSize:    'var(--ds-text-base)',
          color,
          width:       '16px',
          flexShrink:  0,
          textAlign:   'center',
        }}>
          {icon}
        </span>
        <span style={{
          fontSize: 'var(--ds-text-sm)',
          color:    isNull ? 'var(--ds-neutral-400)' : 'var(--ds-neutral-700)',
        }}>
          {item.label}
          {isNull && (
            <span style={{ marginLeft: '6px', fontSize: 'var(--ds-text-xs)', color: 'var(--ds-neutral-400)' }}>
              (no verificado)
            </span>
          )}
        </span>
      </div>
      {item.detail && (
        <div style={{ marginLeft: '26px' }}>
          <div style={{
            fontSize:     'var(--ds-text-xs)',
            color:        'var(--ds-neutral-500)',
            marginBottom: '2px',
            fontWeight:   600,
          }}>
            OU utilizada:
          </div>
          <code style={{
            display:      'block',
            fontSize:     'var(--ds-text-xs)',
            fontFamily:   'var(--ds-font-mono)',
            color:        'var(--ds-danger-dark)',
            background:   'var(--ds-danger-light)',
            border:       '1px solid var(--ds-danger-border)',
            borderRadius: '4px',
            padding:      '4px 8px',
            wordBreak:    'break-all',
            lineHeight:   1.5,
          }}>
            {item.detail}
          </code>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ValidationSummary({ result, onConfirm, onBack }: Props) {
  const { canCreate, errors, warnings, preview, checks } = result;

  const checklist = checks
    ? buildChecklist(checks, preview?.targetOU)
    : null;

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

      {/* Validation checklist */}
      {checklist && (
        <div style={{
          background:   'var(--ds-neutral-50)',
          border:       '1px solid var(--ds-neutral-200)',
          borderRadius: 'var(--ds-radius-lg)',
          padding:      '14px 16px',
        }}>
          <div style={{
            fontWeight:   600,
            fontSize:     'var(--ds-text-sm)',
            color:        'var(--ds-neutral-600)',
            marginBottom: '12px',
          }}>
            Verificaciones realizadas
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {checklist.map((item, i) => (
              <CheckRow key={i} item={item} />
            ))}
          </div>
        </div>
      )}

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

      {/* Preview panel — always backend source here */}
      {preview && <AccountPreview preview={preview} source="backend" />}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <AppButton variant="secondary" size="md" onClick={onBack}>
          Volver al formulario
        </AppButton>
        {canCreate && (
          <AppButton variant="primary" size="md" onClick={onConfirm}>
            Confirmar y crear cuenta
          </AppButton>
        )}
      </div>
    </div>
  );
}
