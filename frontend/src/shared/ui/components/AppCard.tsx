import type { ReactNode } from 'react';

export interface AppCardProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  noPadding?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function AppCard({
  title,
  description,
  action,
  children,
  noPadding = false,
  className,
  style,
}: AppCardProps) {
  const cardClass = [
    'ds-card',
    noPadding ? 'ds-card--no-padding' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const hasHeader = title || description || action;

  return (
    <div className={cardClass} style={style}>
      {hasHeader && (
        <div className="ds-card__header">
          <div>
            {title && <div className="ds-card__title">{title}</div>}
            {description && <div className="ds-card__description">{description}</div>}
          </div>
          {action && <div className="ds-card__action">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
