import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from 'react';

export type ModalSize = 'sm' | 'md' | 'lg';

export interface AppModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  size?: ModalSize;
  loading?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}

// ── Compound sub-components ───────────────────────────────────────────────────
// Exposed as AppModal.Header/Body/Footer so future call sites can compose a modal
// explicitly (<AppModal><AppModal.Header/>...</AppModal>) instead of going through
// the title/footer props below. AppModalBase already renders through these three
// internally, so both styles stay visually identical — no duplicated markup.

export interface AppModalHeaderProps {
  children: ReactNode;
  onClose?: () => void;
  loading?: boolean;
  /** Id applied to the <h2>. Passed by AppModalBase so it can match the panel's
   *  aria-labelledby; falls back to a locally generated id for standalone use
   *  (<AppModal.Header> composed outside of AppModalBase). */
  titleId?: string;
}

function AppModalHeader({ children, onClose, loading, titleId }: AppModalHeaderProps) {
  const generatedId = useId();
  const resolvedId = titleId ?? generatedId;

  return (
    <div className="ds-modal__header">
      <h2 id={resolvedId} className="ds-modal__title">{children}</h2>
      {onClose && (
        <button
          type="button"
          className="ds-modal__close"
          onClick={onClose}
          disabled={loading}
          aria-label="Cerrar"
        >
          ×
        </button>
      )}
    </div>
  );
}

export interface AppModalBodyProps {
  children: ReactNode;
}

function AppModalBody({ children }: AppModalBodyProps) {
  return <div className="ds-modal__body">{children}</div>;
}

export interface AppModalFooterProps {
  children: ReactNode;
}

function AppModalFooter({ children }: AppModalFooterProps) {
  return <div className="ds-modal__footer">{children}</div>;
}

// ── Root component ────────────────────────────────────────────────────────────

function AppModalBase({
  open,
  onClose,
  title,
  size = 'md',
  loading = false,
  children,
  footer,
}: AppModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused.current?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const onOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !loading) onClose();
  };

  return (
    <div className="ds-modal__overlay" onMouseDown={onOverlayClick}>
      <div
        ref={panelRef}
        className={['ds-modal__panel', `ds-modal__panel--${size}`].join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <AppModalHeader onClose={onClose} loading={loading} titleId={titleId}>{title}</AppModalHeader>
        <AppModalBody>{children}</AppModalBody>
        {footer && <AppModalFooter>{footer}</AppModalFooter>}
      </div>
    </div>
  );
}

export const AppModal = Object.assign(AppModalBase, {
  Header: AppModalHeader,
  Body:   AppModalBody,
  Footer: AppModalFooter,
});
