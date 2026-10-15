import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Brand, Colors, Spacing } from '@/constants/theme';
import { AppButton, AppTextInput, Card, Field, PasswordField } from '@/components/ui';
import { useAuth, type LoginResult } from '@/context/auth';
import { pingServerDb } from '@/lib/api';

function collectorLoginMessage(result: LoginResult): string {
  if (result.code === 'WRONG_PASSWORD') return 'The password you entered is incorrect.';
  if (result.code === 'ACCOUNT_NOT_FOUND') return "We couldn't find an account with that Collector ID.";
  // Network failures and server errors must never read as a wrong password.
  if (result.network || (result.status !== undefined && result.status >= 500)) {
    return 'Something went wrong. Please try again.';
  }
  // Other backend messages (e.g. archived/inactive accounts) pass through.
  return result.error || 'Something went wrong. Please try again.';
}

export default function GarbageCollectorLoginScreen() {
  const router = useRouter();
  const { loginCollector } = useAuth();
  const [collectorId, setCollectorId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Fire-and-forget: warm up backend instance and database connection on login mount
    pingServerDb();
  }, []);

  const handleLogin = async () => {
    if (isLoading) return;
    setError('');

    if (!collectorId.trim() || !password.trim()) {
      setError('Collector ID and password are required.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await loginCollector(collectorId, password);

      if (!result.success) {
        setError(collectorLoginMessage(result));
        return;
      }

      router.push('/garbagecollector');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Card>
          <View>
            <Text style={styles.brandTitle}>EcoTrack</Text>
            <Text style={styles.brandSubtitle}>Garbage Collector Portal</Text>
          </View>

          <Field label="Collector ID" helper="Your Collector ID was assigned by your Administrator.">
            <View style={styles.idRow}>
              <MaterialIcons name="person" size={20} color="#6B8A6B" />
              <AppTextInput
                value={collectorId}
                onChangeText={(val) => {
                  setCollectorId(val);
                  if (error) setError('');
                }}
                placeholder="e.g. GC-0001"
                autoCapitalize="characters"
                accessibilityLabel="Collector ID"
                style={styles.idInput}
              />
            </View>
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
            <Text style={styles.errorText} role="alert" accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
          <AppButton title="Login" onPress={handleLogin} loading={isLoading} />

          <AppButton title="Forgot password?" variant="ghost" onPress={() => router.push('/garbagecollector/forgot-password')} />

          <AppButton title="Back to Household Login" variant="secondary" onPress={() => router.push('/')} />
        </Card>
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
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1,
    borderColor: '#E0E4E8',
    gap: 10,
  },
  idInput: {
    flex: 1,
    height: '100%',
    borderWidth: 0,
    paddingHorizontal: 0,
  },
  errorText: {
    color: Brand.error,
    fontSize: 14,
    fontWeight: '600',
  },
});
