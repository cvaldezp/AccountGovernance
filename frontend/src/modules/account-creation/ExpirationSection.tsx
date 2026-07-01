import type { AccountFormData, ExpirationConfig } from './types';

interface Props {
  form:     AccountFormData;
  config:   ExpirationConfig | null;
  onChange: <K extends keyof AccountFormData>(key: K, value: AccountFormData[K]) => void;
}

const MONTH_LABELS: Record<number, string> = {
  1: '1 mes', 2: '2 meses', 3: '3 meses', 6: '6 meses', 9: '9 meses',
  12: '12 meses', 18: '18 meses', 24: '24 meses', 36: '36 meses',
  48: '48 meses', 60: '60 meses',
};

function monthLabel(m: number) {
  return MONTH_LABELS[m] ?? `${m} meses`;
}

export function ExpirationSection({ form, config, onChange }: Props) {
  const allowNoExp    = config?.allowNoExpiration ?? true;
  const allowCustom   = config?.allowCustomDate   ?? true;
  const allowedMonths = config?.allowedMonths     ?? [1, 2, 3, 6, 9, 12, 18, 24, 36, 48, 60];

  const isExpiring = form.expirationMode === 'months' || form.expirationMode === 'custom';

  function setNoExpiration() {
    onChange('expirationMode',   'never');
    onChange('expirationMonths', null);
    onChange('expirationDate',   null);
  }

  function setExpiring() {
    // Default to months if available, otherwise custom
    const defaultMode = allowedMonths.length > 0 ? 'months' : 'custom';
    onChange('expirationMode',   defaultMode);
    onChange('expirationMonths', allowedMonths[0] ?? null);
    onChange('expirationDate',   null);
  }

  const radioStyle = (active: boolean): React.CSSProperties => ({
    display:      'flex',
    alignItems:   'center',
    gap:          '8px',
    padding:      '10px 14px',
    borderRadius: 'var(--ds-radius-lg)',
    border:       `1px solid ${active ? 'var(--ds-brand-main)' : 'var(--ds-neutral-200)'}`,
    background:   active ? 'var(--ds-brand-light)' : 'var(--ds-neutral-50)',
    cursor:       'pointer',
    flex:         1,
    fontSize:     'var(--ds-text-sm)',
    fontWeight:   active ? 600 : 400,
    color:        active ? 'var(--ds-brand-dark)' : 'var(--ds-neutral-600)',
    userSelect:   'none',
    transition:   'all 0.12s',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

      {/* ── Selector principal ───────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {allowNoExp && (
          <div style={radioStyle(!isExpiring)} onClick={setNoExpiration}>
            <span style={{ fontSize: '16px' }}>{!isExpiring ? '●' : '○'}</span>
            Sin expiración
          </div>
        )}
        <div style={radioStyle(isExpiring)} onClick={setExpiring}>
          <span style={{ fontSize: '16px' }}>{isExpiring ? '●' : '○'}</span>
          Con expiración
        </div>
      </div>

      {/* ── Sub-opciones de duración ─────────────────────────────────── */}
      {isExpiring && (
        <div className="ds-input">
          <label className="ds-input__label">Duración</label>
          <select
            className="ds-input__field"
            value={
              form.expirationMode === 'custom'
                ? 'custom'
                : (form.expirationMonths ?? '')
            }
            onChange={e => {
              const v = e.target.value;
              if (v === 'custom') {
                onChange('expirationMode',   'custom');
                onChange('expirationMonths', null);
                onChange('expirationDate',   null);
              } else {
                onChange('expirationMode',   'months');
                onChange('expirationMonths', Number(v) || null);
                onChange('expirationDate',   null);
              }
            }}
          >
            <option value="">— seleccionar duración —</option>
            {allowedMonths.map(m => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
            {allowCustom && (
              <option value="custom">Fecha específica</option>
            )}
          </select>
        </div>
      )}

      {/* ── Date picker cuando eligió "Fecha específica" ─────────────── */}
      {form.expirationMode === 'custom' && (
        <div className="ds-input">
          <label className="ds-input__label">Fecha de vencimiento</label>
          <input
            className="ds-input__field"
            type="date"
            min={new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)}
            value={form.expirationDate ?? ''}
            onChange={e => onChange('expirationDate', e.target.value || null)}
          />
        </div>
      )}

      {/* ── Resumen inline ───────────────────────────────────────────── */}
      {form.expirationMode === 'months' && form.expirationMonths && (
        <div style={{
          padding:      '8px 12px',
          borderRadius: 'var(--ds-radius-md)',
          background:   'var(--ds-warning-light)',
          border:       '1px solid var(--ds-warning-border)',
          fontSize:     'var(--ds-text-sm)',
          color:        'var(--ds-warning-dark)',
        }}>
          La cuenta expirará {monthLabel(form.expirationMonths)} después de su creación.
        </div>
      )}
    </div>
  );
}
