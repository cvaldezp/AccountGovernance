import { useState } from 'react';
import { AppCard, AppBadge, AppButton } from '../../shared/ui';
import type { AccountPreviewData } from './types';

interface Props {
  preview: AccountPreviewData | null;
  source?: 'backend' | 'local';
}

interface AttrRowProps {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  badge?: boolean;
}

function AttrRow({ label, value, mono = false, badge = false }: AttrRowProps) {
  const empty = !value;
  return (
    <div style={{
      display:             'grid',
      gridTemplateColumns: '175px 1fr',
      gap:                 '8px',
      padding:             '8px 0',
      borderBottom:        '1px solid var(--ds-neutral-100)',
      alignItems:          'center',
    }}>
      <span style={{
        fontSize:      'var(--ds-text-xs)',
        fontWeight:    600,
        color:         'var(--ds-neutral-400)',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        fontFamily:    'var(--ds-font-mono)',
      }}>
        {label}
      </span>
      {badge && !empty ? (
        <AppBadge variant="brand">{value}</AppBadge>
      ) : (
        <span style={{
          fontSize:   mono ? 'var(--ds-text-sm)' : 'var(--ds-text-base)',
          fontFamily: mono ? 'var(--ds-font-mono)' : undefined,
          color:      empty ? 'var(--ds-neutral-300)' : 'var(--ds-neutral-800)',
          wordBreak:  'break-all',
        }}>
          {empty ? '—' : value}
        </span>
      )}
    </div>
  );
}

function OuRow({ value }: { value: string | null | undefined }) {
  return (
    <div style={{
      display:             'grid',
      gridTemplateColumns: '175px 1fr',
      gap:                 '8px',
      padding:             '8px 0',
      borderBottom:        '1px solid var(--ds-neutral-100)',
      alignItems:          'start',
    }}>
      <span style={{
        fontSize:      'var(--ds-text-xs)',
        fontWeight:    600,
        color:         'var(--ds-neutral-400)',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        fontFamily:    'var(--ds-font-mono)',
        paddingTop:    '2px',
      }}>
        targetOU
      </span>
      {!value ? (
        <span style={{ color: 'var(--ds-neutral-300)', fontSize: 'var(--ds-text-sm)' }}>—</span>
      ) : (
        <code style={{
          fontSize:    'var(--ds-text-xs)',
          fontFamily:  'var(--ds-font-mono)',
          color:       'var(--ds-neutral-700)',
          background:  'var(--ds-neutral-50)',
          border:      '1px solid var(--ds-neutral-200)',
          borderRadius:'4px',
          padding:     '3px 6px',
          wordBreak:   'break-all',
          lineHeight:  1.4,
          display:     'block',
        }}>
          {value}
        </code>
      )}
    </div>
  );
}

export function AccountPreview({ preview, source = 'local' }: Props) {
  const [showLdap, setShowLdap] = useState(false);

  if (!preview) {
    return (
      <AppCard title="Vista previa de atributos AD" description="Se actualiza al completar el formulario">
        <div style={{
          padding:   '32px 0',
          textAlign: 'center',
          color:     'var(--ds-neutral-300)',
          fontSize:  'var(--ds-text-base)',
        }}>
          Selecciona un tipo de cuenta para ver la vista previa
        </div>
      </AppCard>
    );
  }

  const isBackend = source === 'backend';

  return (
    <AppCard title="Vista previa de atributos AD" description="Se actualiza al completar el formulario">
      <div style={{ marginBottom: '4px' }}>
        <AttrRow label="userPrincipalName" value={preview.userPrincipalName} mono />
        <AttrRow label="sAMAccountName"    value={preview.sAMAccountName}    mono />
        <AttrRow label="displayName"       value={preview.displayName} />
        {preview.company && <AttrRow label="company" value={preview.company} />}
        <AttrRow label="description"       value={preview.description} />
        <AttrRow label="extensionAttribute14" value={preview.extensionAttribute14} badge />
      </div>

      {/* Ver atributos LDAP completos */}
      <div style={{ marginTop: '12px' }}>
        <AppButton
          variant="ghost"
          size="sm"
          onClick={() => setShowLdap(v => !v)}
        >
          {showLdap ? 'Ocultar atributos LDAP' : 'Ver atributos LDAP completos'}
        </AppButton>
      </div>

      {showLdap && (
        <div style={{
          marginTop:    '12px',
          padding:      '14px 16px',
          background:   'var(--ds-neutral-50)',
          border:       '1px solid var(--ds-neutral-200)',
          borderRadius: 'var(--ds-radius-lg)',
        }}>
          <div style={{
            fontSize:     'var(--ds-text-xs)',
            fontWeight:   700,
            color:        'var(--ds-neutral-500)',
            letterSpacing:'0.06em',
            textTransform:'uppercase',
            marginBottom: '8px',
          }}>
            Atributos enviados al AddRequest de AD
          </div>

          <AttrRow label="givenName"     value={preview.givenName} />
          <AttrRow label="sn"            value={preview.sn} />
          <AttrRow label="displayName"   value={preview.displayName} />
          <AttrRow label="company"       value={preview.company} />
          <AttrRow label="description"   value={preview.description} />
          <AttrRow label="extensionAttribute14" value={preview.extensionAttribute14} mono />
          <AttrRow label="userPrincipalName"    value={preview.userPrincipalName}    mono />
          <AttrRow label="sAMAccountName"       value={preview.sAMAccountName}       mono />
          <AttrRow
            label="Custom-External-Email-Address"
            value={preview.recoveryEmail}
            mono
          />
          <AttrRow
            label="userAccountControl"
            value="514 (deshabilitado al crear) → 512 (habilitado tras password)"
          />
          <OuRow value={preview.targetOU} />

          <div style={{ borderTop: '1px solid var(--ds-neutral-200)', marginTop: '4px', paddingTop: '8px' }}>
            <AttrRow label="Tipo"    value={preview.accountTypeLabel ?? preview.accountTypeKey} />
            {preview.subTypeLabel && (
              <AttrRow label="Subtipo" value={preview.subTypeLabel} />
            )}
          </div>
        </div>
      )}

      {/* Source label */}
      <div style={{
        marginTop:    '12px',
        padding:      '10px 12px',
        background:   isBackend ? 'var(--ds-success-light)' : 'var(--ds-info-light)',
        borderRadius: 'var(--ds-radius-lg)',
        fontSize:     'var(--ds-text-xs)',
        color:        isBackend ? 'var(--ds-success-dark)' : 'var(--ds-info-dark)',
        border:       `1px solid ${isBackend ? 'var(--ds-success-border)' : 'var(--ds-info-border)'}`,
      }}>
        {isBackend
          ? 'Vista previa generada por el backend — atributos verificados contra la configuración activa.'
          : 'Vista previa calculada localmente. El backend verificará conflictos de nombre al crear la cuenta.'}
      </div>
    </AppCard>
  );
}
