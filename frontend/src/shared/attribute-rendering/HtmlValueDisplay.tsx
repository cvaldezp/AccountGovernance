import { useMemo } from 'react';
import { sanitizeHtml } from './sanitize';

export function HtmlValueDisplay({ value }: { value: string }) {
  const safeHtml = useMemo(() => sanitizeHtml(value), [value]);

  return (
    <div style={{ width: '100%' }}>
      <div
        style={{
          border: '1px solid var(--ds-neutral-200)',
          borderRadius: 'var(--ds-radius-lg)',
          background: 'var(--ds-neutral-0)',
          boxShadow: 'var(--ds-shadow-sm)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            fontSize: '10px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--ds-neutral-400)',
            padding: '6px 12px',
            borderBottom: '1px solid var(--ds-neutral-100)',
            background: 'var(--ds-neutral-50)',
          }}
        >
          Vista previa
        </div>
        {/* Único dangerouslySetInnerHTML del proyecto — siempre detrás de sanitizeHtml(). */}
        <div
          style={{ padding: '12px 14px', fontSize: '13px', color: 'var(--ds-neutral-800)' }}
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
      </div>

      <details style={{ marginTop: '8px' }}>
        <summary
          style={{
            cursor: 'pointer',
            fontSize: '12px',
            color: 'var(--ds-neutral-500)',
            fontWeight: 600,
            userSelect: 'none',
          }}
        >
          Ver código HTML
        </summary>
        <pre
          style={{
            marginTop: '8px',
            padding: '10px 12px',
            background: 'var(--ds-neutral-900)',
            color: 'var(--ds-neutral-100)',
            borderRadius: 'var(--ds-radius-md)',
            fontFamily: 'var(--ds-font-mono)',
            fontSize: '12px',
            lineHeight: 1.5,
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {value}
        </pre>
      </details>
    </div>
  );
}
