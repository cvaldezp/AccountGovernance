import { AppCard, AppBadge } from '../../shared/ui';
import type { AccountPreviewData } from './types';

interface Props {
  preview: AccountPreviewData | null;
}

interface AttributeRowProps {
  label: string;
  value: string;
  mono?:  boolean;
}

function AttributeRow({ label, value, mono = false }: AttributeRowProps) {
  const isEmpty = !value;
  return (
    <div style={{
      display:      'grid',
      gridTemplateColumns: '175px 1fr',
      gap:          '8px',
      padding:      '8px 0',
      borderBottom: '1px solid var(--ds-neutral-100)',
      alignItems:   'baseline',
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
      <span style={{
        fontSize:    mono ? 'var(--ds-text-sm)' : 'var(--ds-text-base)',
        fontFamily:  mono ? 'var(--ds-font-mono)' : undefined,
        color:       isEmpty ? 'var(--ds-neutral-300)' : 'var(--ds-neutral-800)',
        wordBreak:   'break-all',
      }}>
        {isEmpty ? '—' : value}
      </span>
    </div>
  );
}

export function AccountPreview({ preview }: Props) {
  return (
    <AppCard
      title="Vista previa de atributos AD"
      description="Se actualiza al completar el formulario"
    >
      {!preview ? (
        <div style={{
          padding:   '32px 0',
          textAlign: 'center',
          color:     'var(--ds-neutral-300)',
          fontSize:  'var(--ds-text-base)',
        }}>
          Selecciona un tipo de cuenta para ver la vista previa
        </div>
      ) : (
        <>
          <div style={{ marginBottom: '4px' }}>
            <AttributeRow label="userPrincipalName"    value={preview.userPrincipalName}    mono />
            <AttributeRow label="sAMAccountName"       value={preview.sAMAccountName}       mono />
            <AttributeRow label="displayName"          value={preview.displayName} />
            <AttributeRow label="description"          value={preview.description} />
            <div style={{
              display:      'grid',
              gridTemplateColumns: '175px 1fr',
              gap:          '8px',
              padding:      '8px 0',
              alignItems:   'center',
            }}>
              <span style={{
                fontSize:      'var(--ds-text-xs)',
                fontWeight:    600,
                color:         'var(--ds-neutral-400)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                fontFamily:    'var(--ds-font-mono)',
              }}>
                extensionAttribute14
              </span>
              {preview.extensionAttribute14 ? (
                <AppBadge variant="brand">
                  {preview.extensionAttribute14}
                </AppBadge>
              ) : (
                <span style={{ color: 'var(--ds-neutral-300)' }}>—</span>
              )}
            </div>
          </div>

          <div style={{
            marginTop:    '12px',
            padding:      '10px 12px',
            background:   'var(--ds-info-light)',
            borderRadius: 'var(--ds-radius-lg)',
            fontSize:     'var(--ds-text-xs)',
            color:        'var(--ds-info-dark)',
            border:       '1px solid var(--ds-info-border)',
          }}>
            Vista previa calculada localmente. El backend verificará conflictos de nombre al crear la cuenta.
          </div>
        </>
      )}
    </AppCard>
  );
}
