/**
 * Spacing tokens for @usfq/design-system
 * All values in px. Semantic aliases describe intent, not size.
 * Radii aligned with AppRecovery_Modern: xl=12px (inputs/buttons), 2xl=20px (cards).
 */
export const spacing = {
  // Scale
  0:    '0px',
  px:   '1px',
  0.5:  '2px',
  1:    '4px',
  1.5:  '6px',
  2:    '8px',
  2.5:  '10px',
  3:    '12px',
  3.5:  '14px',
  4:    '16px',
  5:    '20px',
  6:    '24px',
  7:    '28px',
  8:    '32px',
  9:    '36px',
  10:   '40px',
  12:   '48px',
  14:   '56px',
  16:   '64px',

  // Semantic aliases
  cardPadding:    '20px',
  pagePadding:    '24px',
  sectionGap:     '24px',
  fieldGap:       '16px',
  inputPaddingX:  '12px',
  inputPaddingY:  '8px',
  buttonPaddingX: '16px',
  buttonPaddingY: '8px',
  rowGap:         '12px',
} as const;

export const radii = {
  sm:   '4px',
  md:   '6px',
  lg:   '8px',
  xl:   '12px',  // buttons, inputs, small elements
  '2xl':'20px',  // cards (AppRecovery --radius-lg)
  '3xl':'24px',  // info panels
  full: '9999px',
} as const;

export type SpacingToken = typeof spacing;
export type RadiiToken   = typeof radii;
