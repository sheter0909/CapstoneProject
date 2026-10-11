/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export const Brand = {
  primary: '#1F7A37',
  primaryDark: '#1B4A28',
  primaryDeep: '#0F2A12',
  subtitle: '#3C6A43',
  tintBg: '#E8F7E9',
  tintBorder: '#BBE5C3',
  tintText: '#2E6B34',
  navMuted: '#D6F3D1',
  warningBg: '#FEF6E7',
  warningBorder: '#F5D9A8',
  warningTitle: '#9A5C1B',
  warningText: '#7A4A15',
  ink: '#1F2937',
  body: '#4A4A4A',
  muted: '#6B7280',
  fieldBorder: '#E0E4E8',
  error: '#A12727',
} as const;

export const Radius = {
  card: 24,
  button: 14,
  field: 12,
  pill: 999,
} as const;

export const Shadow = {
  card: '0px 8px 12px rgba(0,0,0,0.05)',
  raised: '0px 8px 16px rgba(0,0,0,0.06)',
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;
