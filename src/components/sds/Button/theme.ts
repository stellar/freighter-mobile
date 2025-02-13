export const BUTTON_THEME = {
  height: {
    sm: 26,
    md: 32,
    lg: 40,
  },
  fontSize: {
    sm: 12,
    md: 14,
    lg: 16,
  },
  padding: {
    sm: {
      vertical: 4,
      horizontal: 8,
    },
    md: {
      vertical: 6,
      horizontal: 10,
    },
    lg: {
      vertical: 8,
      horizontal: 12,
    },
  },
  borderRadius: {
    sm: 4,
    md: 6,
    lg: 8,
  },
  colors: {
    primary: {
      background: '#6E56CF',
      text: '#FFFFFF',
    },
    secondary: {
      background: '#171717',
      text: '#FFFFFF',
    },
    tertiary: {
      background: '#FCFCFC',
      text: '#171717',
      border: '#E2E2E2',
    },
    error: {
      background: '#FFFCFC',
      text: '#CD2B31',
      border: '#F9C6C6',
    },
    destructive: {
      background: '#E5484D',
      text: '#FFFFFF',
    },
    disabled: {
      background: '#E2E2E2',
      text: '#8F8F8F',
    },
  },
  icon: {
    spacing: 8,
  },
} as const; 