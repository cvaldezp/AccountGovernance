import { useEffect, useMemo, useState } from 'react';
import { AppButton, AppModal } from '../ui';
import { sanitizeHtml } from './sanitize';

export interface HtmlAttributeEditModalProps {
  open: boolean;
  title: string;
  initialValue: string;
  saving: boolean;
  onSave: (value: string) => void;
  onCancel: () => void;
}

export function HtmlAttributeEditModal({
  open, title, initialValue, saving, onSave, onCancel,
}: HtmlAttributeEditModalProps) {
  const [draft, setDraft] = useState(initialValue);

  // Reinicia el borrador cada vez que el modal se abre — evita arrastrar texto
  // de una edición previa (p.ej. reabrir tras cancelar).
  useEffect(() => { if (open) setDraft(initialValue); }, [open, initialValue]);

  const safePreview = useMemo(() => sanitizeHtml(draft), [draft]);

  return (
    <AppModal
      open={open}
      onClose={onCancel}
      title={`Editar: ${title}`}
      size="lg"
      loading={saving}
      footer={
        <>
          <AppButton variant="secondary" onClick={onCancel} disabled={saving}>Cancelar</AppButton>
          <AppButton variant="primary" onClick={() => onSave(draft)} loading={saving}>Guardar</AppButton>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', minHeight: '260px' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ds-neutral-500)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
            Código HTML
          </div>
          <textarea
            className="ds-input__field"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={12}
            autoFocus
            style={{ fontFamily: 'var(--ds-font-mono)', fontSize: '12px', width: '100%', resize: 'vertical' }}
          />
        </div>

        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ds-neutral-500)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
            Vista previa
          </div>
          <div
            style={{
              border: '1px solid var(--ds-neutral-200)',
              borderRadius: 'var(--ds-radius-lg)',
              padding: '12px 14px',
              minHeight: '260px',
              fontSize: '13px',
              background: 'var(--ds-neutral-0)',
            }}
            // Único otro punto del proyecto con dangerouslySetInnerHTML — mismo
            // sanitizeHtml() que HtmlValueDisplay, recalculado en cada tecla.
            dangerouslySetInnerHTML={{ __html: safePreview }}
          />
        </div>
      </div>
    </AppModal>
  );
}
