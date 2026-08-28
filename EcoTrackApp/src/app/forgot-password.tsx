import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import DatePickerField from '@/components/date-picker-field';
import { safeBack } from '@/lib/navigation';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { verifyHouseholdIdentity } = useAuth();
  const [houseId, setHouseId] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    setError('');
    if (!houseId.trim() || !birthdate.trim()) {
      setError('House ID and Birthdate are required.');
      return;
    }
    setLoading(true);
    const result = await verifyHouseholdIdentity(houseId.trim(), birthdate.trim());
    setLoading(false);
    if (result.success) {
      router.push('/reset-password');
    } else {
      setError(result.error ?? 'Account ID and birthdate do not match.');
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Forgot Password</Text>
          <Text style={styles.subtitle}>Enter your House ID and registered Birthdate to verify your identity.</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>House ID</Text>
            <TextInput
              style={styles.input}
              value={houseId}
              onChangeText={(val) => {
                setHouseId(val);
                if (error) setError('');
              }}
              placeholder="e.g. 011704"
              placeholderTextColor="#999"
              autoCapitalize="none"
            />
            <Text style={styles.helperText}>Your House ID was provided by your Barangay Admin during enrollment.</Text>
          </View>

          <DatePickerField
            label="Registered Birthdate"
            value={birthdate}
            onChange={(val) => {
              setBirthdate(val);
              if (error) setError('');
            }}
            placeholder="MM/DD/YYYY"
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            style={[styles.primaryButton, loading && { opacity: 0.7 }]}
            onPress={handleVerify}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>{loading ? 'Verifying...' : 'Continue'}</Text>
          </Pressable>

          <Pressable style={styles.linkButton} onPress={() => safeBack(router, '/')}>
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
  helperText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    lineHeight: 16,
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
  linkButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  linkText: {
    color: '#1F7A37',
    fontWeight: '700',
  },
});
