import type { ReactNode } from 'react';

interface Crumb {
  label: string;
  onClick?: () => void;
}

export interface AppPageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  breadcrumb?: Crumb[];
  className?: string;
}

export function AppPageHeader({
  title,
  description,
  action,
  breadcrumb,
  className,
}: AppPageHeaderProps) {
  return (
    <div className={['ds-page-header', className ?? ''].filter(Boolean).join(' ')}>
      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="ds-page-header__breadcrumb" aria-label="breadcrumb">
          {breadcrumb.map((crumb, i) => (
            <span key={i}>
              {i > 0 && (
                <span className="ds-page-header__breadcrumb-sep" aria-hidden="true">
                  ›
                </span>
              )}
              {crumb.onClick ? (
                <button
                  type="button"
                  className="ds-page-header__breadcrumb-link"
                  onClick={crumb.onClick}
                >
                  {crumb.label}
                </button>
              ) : (
                <span className="ds-page-header__breadcrumb-current">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      <div className="ds-page-header__main">
        <div>
          <h1 className="ds-page-header__title">{title}</h1>
          {description && (
            <p className="ds-page-header__description">{description}</p>
          )}
        </div>
        {action && <div className="ds-page-header__action">{action}</div>}
      </div>
    </div>
  );
}
