import { AppBadge } from '../../shared/ui';
import type { AccountSubTypeInfo, AccountSubTypeKey } from './types';

interface Props {
  subTypes:  AccountSubTypeInfo[];
  selected:  AccountSubTypeKey | null;
  onSelect:  (key: AccountSubTypeKey) => void;
}

function SubTypeCard({
  subType, selected, onSelect,
}: { subType: AccountSubTypeInfo; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        padding:      '16px',
        border:       `2px solid ${selected ? 'var(--ds-danger-main)' : 'var(--ds-neutral-200)'}`,
        borderRadius: 'var(--ds-radius-xl)',
        background:   selected ? 'var(--ds-danger-light)' : 'var(--ds-neutral-0)',
        cursor:       'pointer',
        textAlign:    'left',
        width:        '100%',
        transition:   'all var(--ds-transition-fast)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span style={{
          display:        'inline-flex',
          alignItems:     'center',
          justifyContent: 'center',
          height:         '32px',
          padding:        '0 10px',
          borderRadius:   '8px',
          background:     selected ? 'var(--ds-danger-main)' : 'var(--ds-danger-light)',
          color:          selected ? 'white'                  : 'var(--ds-danger-dark)',
          fontFamily:     'var(--ds-font-mono)',
          fontSize:       '11px',
          fontWeight:     700,
          letterSpacing:  '0.04em',
          flexShrink:     0,
        }}>
          {subType.samPrefix}.
        </span>
        {selected && <AppBadge variant="danger" size="sm">Seleccionado</AppBadge>}
      </div>

      <div style={{
        fontWeight:   600,
        fontSize:     'var(--ds-text-base)',
        color:        selected ? 'var(--ds-danger-dark)' : 'var(--ds-neutral-900)',
        marginBottom: '4px',
      }}>
        {subType.label}
      </div>

      <div style={{
        fontSize:   'var(--ds-text-xs)',
        color:      'var(--ds-neutral-500)',
        fontFamily: 'var(--ds-font-mono)',
      }}>
        EA14: {subType.extensionAttribute14}
      </div>
    </button>
  );
}

export function SubTypeSelector({ subTypes, selected, onSelect }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{
        fontSize:    'var(--ds-text-sm)',
        color:       'var(--ds-neutral-500)',
        padding:     '8px 12px',
        background:  'var(--ds-danger-light)',
        border:      '1px solid var(--ds-danger-border)',
        borderRadius:'var(--ds-radius-lg)',
        display:     'flex',
        alignItems:  'center',
        gap:         '8px',
      }}>
        <span style={{ fontWeight: 700, color: 'var(--ds-danger-dark)' }}>⚠</span>
        <span>Las cuentas privilegiadas requieren aprobación adicional. Selecciona el área funcional.</span>
      </div>

      <div style={{
        display:             'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap:                 '10px',
      }}>
        {subTypes.map(sub => (
          <SubTypeCard
            key={sub.key}
            subType={sub}
            selected={selected === sub.key}
            onSelect={() => onSelect(sub.key)}
          />
        ))}
      </div>
    </div>
  );
}
