/**
 * Color tokens for @usfq/design-system
 * Source of truth — consumed by theme.css via CSS custom properties.
 * Brand palette aligned with AppRecovery_Modern USFQ institutional colors.
 */
export const colors = {
  brand: {
    50:  '#FFF0F1',
    100: '#FFD5D7',
    200: '#FFADB0',
    300: '#FF7575',
    400: '#E53935', // gradient "to" end — lighter USFQ red
    500: '#ED1C24', // redUsfq — primary brand red
    600: '#C0161D', // darkRedUsfq — hover / action
    700: '#B91B1B', // CSS primary-color — button gradient start
    800: '#7F0000', // CSS primary-dark
    900: '#570000',
  },
  neutral: {
    0:   '#FFFFFF',
    50:  '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
  },
  success: {
    light:  '#DCFCE7',
    border: '#BBF7D0',
    main:   '#22C55E',
    dark:   '#16A34A',
  },
  warning: {
    light:  '#FEF3C7',
    border: '#FDE68A',
    main:   '#F59E0B',
    dark:   '#D97706',
  },
  danger: {
    light:  '#FEE2E2',
    border: '#FECACA',
    main:   '#EF4444',
    dark:   '#DC2626',
  },
  info: {
    light:  '#DBEAFE',
    border: '#BFDBFE',
    main:   '#3B82F6',
    dark:   '#2563EB',
  },
} as const;

export type ColorToken = typeof colors;
