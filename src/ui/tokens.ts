export const tokens = {
  color: {
    bg: '#0b0d12',
    surface: '#131722',
    surfaceElevated: '#1a2030',
    border: '#262e42',
    text: '#f3f5f9',
    textMuted: '#9aa4b8',
    accent: '#3b82f6',
    accentHover: '#2563eb',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
  },
  radius: {
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
  },
} as const;

export type DesignTokens = typeof tokens;
