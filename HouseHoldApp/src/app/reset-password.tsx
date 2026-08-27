import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { resetHouseholdPassword, householdResetAccountId } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    setError('');
    if (!newPassword || newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    const result = await resetHouseholdPassword(newPassword);
    setLoading(false);
    if (result.success) {
      setSuccess(true);
      setTimeout(() => {
        router.replace('/');
      }, 2000);
    } else {
      setError(result.error ?? 'Unable to reset password.');
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>New Password</Text>
          <Text style={styles.subtitle}>
            {householdResetAccountId ? `Setting new password for Household ${householdResetAccountId}.` : 'Please create a new strong password.'}
          </Text>

          {success ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>Password reset successfully! Redirecting to login...</Text>
            </View>
          ) : (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Create new password</Text>
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="At least 8 characters"
                  placeholderTextColor="#999"
                  secureTextEntry
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirm your password</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter password"
                  placeholderTextColor="#999"
                  secureTextEntry
                />
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <Pressable
                style={[styles.primaryButton, loading && { opacity: 0.7 }]}
                onPress={handleReset}
                disabled={loading}
              >
                <Text style={styles.primaryButtonText}>{loading ? 'Updating Password...' : 'Save New Password'}</Text>
              </Pressable>
            </>
          )}

          <Pressable style={styles.linkButton} onPress={() => router.replace('/')}>
            <Text style={styles.linkText}>Back to login</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  container: {
    padding: Spacing.four,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: Spacing.four,
    gap: Spacing.three,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1F7A37',
  },
  subtitle: {
    color: '#4A4A4A',
    lineHeight: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A4A4A',
  },
  input: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D9D9D9',
    backgroundColor: '#F7F7F7',
  },
  primaryButton: {
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: '#1F7A37',
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  errorText: {
    color: '#DC2626',
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
  },
  successBox: {
    backgroundColor: '#E8F7E9',
    borderRadius: 14,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: '#A7E0B0',
    alignItems: 'center',
    marginVertical: Spacing.two,
  },
  successText: {
    color: '#1F7A37',
    fontWeight: '700',
    fontSize: 15,
    textAlign: 'center',
  },
  linkButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  linkText: {
    color: '#1F7A37',
    fontWeight: '700',
  },
});
