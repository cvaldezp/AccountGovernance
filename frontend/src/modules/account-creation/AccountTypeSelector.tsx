import { AppBadge } from '../../shared/ui';
import type { AccountTypeInfo, AccountTypeKey } from './types';

interface Props {
  accountTypes: AccountTypeInfo[];
  selected:     AccountTypeKey | null;
  onSelect:     (key: AccountTypeKey) => void;
}

function TypeCard({ type, selected, onSelect }: {
  type:     AccountTypeInfo;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        padding:       '16px',
        border:        `2px solid ${selected ? 'var(--ds-brand-500)' : 'var(--ds-neutral-200)'}`,
        borderRadius:  'var(--ds-radius-xl)',
        background:    selected ? 'var(--ds-brand-50)' : 'var(--ds-neutral-0)',
        cursor:        'pointer',
        textAlign:     'left',
        width:         '100%',
        transition:    'all var(--ds-transition-fast)',
        boxShadow:     selected ? 'var(--ds-shadow-brand)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span style={{
          display:         'inline-flex',
          alignItems:      'center',
          justifyContent:  'center',
          width:           '38px',
          height:          '38px',
          borderRadius:    '8px',
          background:      type.isPrivileged ? 'var(--ds-danger-light)' : 'var(--ds-info-light)',
          color:           type.isPrivileged ? 'var(--ds-danger-dark)'  : 'var(--ds-info-dark)',
          fontFamily:      'var(--ds-font-mono)',
          fontSize:        '10px',
          fontWeight:      700,
          letterSpacing:   '0.04em',
          flexShrink:      0,
        }}>
          {type.badge}
        </span>
        {type.isPrivileged && (
          <AppBadge variant="danger" size="sm">Privilegiada</AppBadge>
        )}
      </div>

      <div style={{
        fontWeight:   600,
        fontSize:     'var(--ds-text-base)',
        color:        selected ? 'var(--ds-brand-700)' : 'var(--ds-neutral-900)',
        marginBottom: '4px',
        lineHeight:   1.3,
      }}>
        {type.label}
      </div>

      <div style={{
        fontSize: 'var(--ds-text-sm)',
        color:    'var(--ds-neutral-500)',
      }}>
        {type.description}
        {type.isPrivileged && type.subTypes.length > 0 && (
          <span style={{
            marginLeft:  '6px',
            fontFamily:  'var(--ds-font-mono)',
            background:  'var(--ds-neutral-100)',
            padding:     '1px 5px',
            borderRadius:'4px',
            fontSize:    'var(--ds-text-xs)',
          }}>
            {type.subTypes.map(s => s.samPrefix).join(' / ')}.
          </span>
        )}
      </div>
    </button>
  );
}

export function AccountTypeSelector({ accountTypes, selected, onSelect }: Props) {
  return (
    <div style={{
      display:               'grid',
      gridTemplateColumns:   'repeat(auto-fill, minmax(210px, 1fr))',
      gap:                   '12px',
    }}>
      {accountTypes.map(type => (
        <TypeCard
          key={type.key}
          type={type}
          selected={selected === type.key}
          onSelect={() => onSelect(type.key)}
        />
      ))}
    </div>
  );
}
