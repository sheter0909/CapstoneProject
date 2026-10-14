import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Brand, Radius, Shadow, Spacing } from '@/constants/theme';

export function Card({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'light';

// Web-only pointer cursor for Pressables. No-op on native; typed via
// ViewStyle extension since RN types don't include `cursor`.
export function webCursor(disabled?: boolean) {
  return Platform.select({
    web: { cursor: disabled ? 'not-allowed' : 'pointer' },
    default: {},
  }) as object;
}

export function AppButton({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  accessibilityLabel,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  style?: object;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        webCursor(isDisabled),
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'light' && styles.buttonLight,
        pressed && !isDisabled && styles.buttonPressed,
        isDisabled && styles.buttonDisabled,
        style,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          variant === 'primary' && styles.buttonTextPrimary,
          variant === 'secondary' && styles.buttonTextSecondary,
          variant === 'ghost' && styles.buttonTextGhost,
          variant === 'light' && styles.buttonTextSecondary,
        ]}
      >
        {loading ? 'Please wait…' : title}
      </Text>
    </Pressable>
  );
}

export function Field({
  label,
  helper,
  error,
  children,
}: {
  label: string;
  helper?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? (
        <Text style={styles.errorText} role="alert">
          {error}
        </Text>
      ) : helper ? (
        <Text style={styles.helperText}>{helper}</Text>
      ) : null}
    </View>
  );
}

export function AppTextInput(props: TextInputProps) {
  return (
    <TextInput
      {...props}
      placeholderTextColor="#9AA39A"
      style={[styles.input, props.style]}
    />
  );
}

export function PasswordField({
  value,
  onChangeText,
  showPassword,
  onToggleVisibility,
  placeholder = 'Enter password',
}: {
  value: string;
  onChangeText: (v: string) => void;
  showPassword: boolean;
  onToggleVisibility: () => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.inputRow}>
      <MaterialIcons name="lock" size={20} color="#6B8A6B" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!showPassword}
        placeholder={placeholder}
        placeholderTextColor="#9AA39A"
        style={styles.inputFlex}
        accessibilityLabel="Password"
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
        onPress={onToggleVisibility}
        hitSlop={8}
        style={webCursor()}
      >
        <MaterialIcons name={showPassword ? 'visibility-off' : 'visibility'} size={22} color="#6B8A6B" />
      </Pressable>
    </View>
  );
}

export function SectionHeader({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" accessibilityLabel={actionLabel} style={webCursor()}>
          <Text style={styles.linkText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.card,
    padding: Spacing.four,
    gap: Spacing.three,
    boxShadow: Shadow.card,
    elevation: 3,
  },
  button: {
    borderRadius: Radius.button,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: Brand.primary,
    marginTop: 12,
  },
  buttonSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Brand.primary,
    marginTop: 12,
  },
  buttonGhost: {
    alignItems: 'center',
    marginTop: 12,
  },
  buttonLight: {
    backgroundColor: '#FFFFFF',
    marginTop: 12,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontWeight: '700',
    fontSize: 16,
  },
  buttonTextPrimary: {
    color: '#FFFFFF',
  },
  buttonTextSecondary: {
    color: Brand.primary,
    fontSize: 14,
  },
  buttonTextGhost: {
    color: Brand.primary,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    color: Brand.body,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    color: Brand.muted,
    marginTop: 2,
    lineHeight: 16,
  },
  errorText: {
    color: Brand.error,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  input: {
    height: 48,
    borderRadius: Radius.field,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Brand.fieldBorder,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.field,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1,
    borderColor: Brand.fieldBorder,
    gap: 10,
    overflow: 'hidden',
  },
  inputFlex: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    ...Platform.select({
      web: { outlineWidth: 0 },
      default: {},
    }),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Brand.primary,
  },
  linkText: {
    color: Brand.primary,
    fontWeight: '700',
  },
});
