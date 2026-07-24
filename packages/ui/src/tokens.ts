/** Design token constants (TS). Prefer CSS variables in components. */

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radius = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  full: 9999,
} as const;

export const motion = {
  instant: 0,
  fast: 120,
  normal: 180,
  slow: 240,
} as const;

export const layout = {
  sidebarWidth: 248,
  sidebarRail: 64,
  topbarHeight: 56,
  contentMax: 1440,
  formMax: 640,
  readingMax: 720,
  pageGutterMobile: 16,
  pageGutterDesktop: 24,
} as const;
