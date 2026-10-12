/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

export const Colors = {
  light: {
    background: '#ffffff',
  },
} as const;

export const Brand = {
  primary: '#1F7A37',
  primaryDark: '#1B4A28',
  subtitle: '#3C6A43',
  body: '#4A4A4A',
  muted: '#6B7280',
  fieldBorder: '#E0E4E8',
  error: '#A12727',
} as const;

export const Radius = {
  card: 24,
  button: 14,
  field: 12,
} as const;

export const Shadow = {
  card: '0px 8px 12px rgba(0,0,0,0.05)',
} as const;

export const Spacing = {
  one: 4,
  two: 8,
  three: 16,
  four: 24,
} as const;
