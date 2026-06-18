/**
 * Typography tokens for @usfq/design-system
 * Font families aligned with AppRecovery_Modern institutional identity.
 */
export const typography = {
  fontFamily: {
    heading: "'Libre Baskerville', Georgia, 'Times New Roman', serif",
    body:    "'Quicksand', 'Inter', system-ui, -apple-system, sans-serif",
    sans:    "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    mono:    "ui-monospace, 'Cascadia Code', Consolas, 'Courier New', monospace",
  },
  fontSize: {
    '2xs': '10px',
    xs:    '11px',
    sm:    '12px',
    base:  '14px',
    md:    '15px',
    lg:    '16px',
    xl:    '18px',
    '2xl': '22px',
    '3xl': '28px',
    '4xl': '36px',
  },
  fontWeight: {
    normal:    400,
    medium:    500,
    semibold:  600,
    bold:      700,
    extrabold: 800,
  },
  lineHeight: {
    none:    '1',
    tight:   '1.25',
    snug:    '1.375',
    normal:  '1.5',
    relaxed: '1.625',
  },
  letterSpacing: {
    tighter: '-0.05em',
    tight:   '-0.025em',
    normal:  '0em',
    wide:    '0.025em',
    wider:   '0.05em',
    widest:  '0.1em',
  },
} as const;

export type TypographyToken = typeof typography;
