import type { CSSProperties, ReactNode } from 'react';

export type BadgeVariant = 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'brand';
export type BadgeSize = 'sm' | 'md';

export interface AppBadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function AppBadge({
  variant = 'neutral',
  size,
  children,
  className,
  style,
}: AppBadgeProps) {
  const classes = [
    'ds-badge',
    `ds-badge--${variant}`,
    size ? `ds-badge--${size}` : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes} style={style}>
      {children}
    </span>
  );
}
