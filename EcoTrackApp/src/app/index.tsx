import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { Brand, Colors, Spacing } from '@/constants/theme';
import { AppButton, AppTextInput, Card, Field, PasswordField } from '@/components/ui';
import { useAuth } from '@/context/auth';

const APK_URL: string = process.env.EXPO_PUBLIC_APK_URL ?? '';
const IS_WEB: boolean = Platform.OS === 'web';
// Best-effort iOS detection on web only; never evaluated in the native app.
const IS_IOS_WEB: boolean =
  IS_WEB &&
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

export default function LoginScreen() {
  const router = useRouter();
  const { loginHousehold } = useAuth();
  const [houseId, setHouseId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setError('');
    if (!houseId.trim() || !password) {
      setError('House ID and password are required.');
      return;
    }
    setIsLoading(true);
    const result = await loginHousehold(houseId.trim(), password);
    setIsLoading(false);
    if (result.success) {
      router.push('/household');

    } else {
      setError(result.error ?? 'Invalid House ID or password.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Card>
          <View>
            <Text style={styles.brandTitle}>EcoTrack</Text>
            <Text style={styles.brandSubtitle}>Household Portal</Text>
          </View>

          <Field label="House ID" helper="Your House ID was provided by your Barangay Admin during enrollment.">
            <AppTextInput
              value={houseId}
              onChangeText={(val) => {
                setHouseId(val);
                if (error) setError('');
              }}
              placeholder="e.g. 011704"
              autoCapitalize="none"
              accessibilityLabel="House ID"
            />
          </Field>

          <Field label="Password">
            <PasswordField
              value={password}
              onChangeText={(val) => {
                setPassword(val);
                if (error) setError('');
              }}
              showPassword={showPassword}
              onToggleVisibility={() => setShowPassword(!showPassword)}
            />
          </Field>

          {error ? (
            <Text style={styles.errorText} role="alert">
              {error}
            </Text>
          ) : null}
          <AppButton title="Login" onPress={handleLogin} loading={isLoading} />

          <AppButton title="Forgot password?" variant="ghost" onPress={() => router.push('/forgot-password')} />

          <AppButton title="Login as Garbage Collector" variant="secondary" onPress={() => router.push('/garbagecollector/login')} />

          {IS_WEB && APK_URL && !IS_IOS_WEB ? (
            <Pressable style={styles.apkButton} onPress={() => Linking.openURL(APK_URL)}>
              <MaterialIcons name="android" size={20} color="#FFF" />
              <Text style={styles.apkButtonText}>Download Android app (APK)</Text>
            </Pressable>
          ) : null}
          {IS_WEB && APK_URL && IS_IOS_WEB ? (
            <Text style={styles.apkNote}>The downloadable app is Android only.</Text>
          ) : null}
        </Card>

        <View style={styles.footerCard}>
          <Text style={styles.footerTitle}>Need help?</Text>
          <Text style={styles.footerText}>If you are locked out, use the forgot password flow or contact your community leader.</Text>
          <Link href="/forgot-password" style={styles.footerLink}>
            Reset your password
          </Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  container: {
    padding: Spacing.four,
    alignItems: 'stretch',
    gap: Spacing.four,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Brand.primaryDark,
  },
  brandSubtitle: {
    color: Brand.subtitle,
    marginTop: 4,
    fontSize: 16,
  },
  errorText: {
    color: Brand.error,
    fontWeight: '700',
  },
  apkButton: {
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: Brand.primaryDark,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  apkButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  apkNote: {
    marginTop: 12,
    textAlign: 'center',
    color: Brand.muted,
    fontSize: 12,
  },
  footerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: '#E7E7E7',
    gap: 8,
  },
  footerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  footerText: {
    color: '#5A5A5A',
    lineHeight: 20,
  },
  footerLink: {
    color: Brand.primary,
    fontWeight: '700',
    marginTop: 10,
  },
});
