import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';

export default function LoginScreen() {
  const router = useRouter();
  const { loginHousehold } = useAuth();
  const [houseId, setHouseId] = useState('');
  const [password, setPassword] = useState('');
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
      router.push('/household' as any);
    } else {
      setError(result.error ?? 'Invalid House ID or password.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.brandTitle}>EcoTrack</Text>
          <Text style={styles.brandSubtitle}>Household Portal</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>House ID</Text>
            <TextInput
              value={houseId}
              onChangeText={(val) => {
                setHouseId(val);
                if (error) setError('');
              }}
              placeholder="e.g. 011704"
              placeholderTextColor="#999"
              style={styles.input}
              autoCapitalize="none"
            />
            <Text style={styles.helperText}>Your House ID was provided by your Barangay Admin during enrollment.</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              value={password}
              onChangeText={(val) => {
                setPassword(val);
                if (error) setError('');
              }}
              secureTextEntry
              placeholder="Enter password"
              placeholderTextColor="#999"
              style={styles.input}
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <Pressable
            style={[styles.primaryButton, isLoading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            <Text style={styles.primaryButtonText}>{isLoading ? 'LOGGING IN...' : 'LOGIN'}</Text>
          </Pressable>

          <Pressable style={styles.ghostButton} onPress={() => router.push('/forgot-password')}>
            <Text style={styles.ghostButtonText}>Forgot password?</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={() => router.push('/garbagecollector/login' as any)}>
            <Text style={styles.secondaryButtonText}>LOGIN AS GARBAGE COLLECTOR</Text>
          </Pressable>
        </View>

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
  card: {
    backgroundColor: '#F5F5F5',
    borderRadius: 24,
    padding: Spacing.four,
    gap: Spacing.three,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1B4A28',
  },
  brandSubtitle: {
    color: '#3C6A43',
    marginTop: 4,
    marginBottom: 20,
    fontSize: 16,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    color: '#4A4A4A',
    fontWeight: '600',
  },
  input: {
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E4E8',
  },
  helperText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    lineHeight: 16,
  },
  primaryButton: {
    marginTop: 12,
    backgroundColor: '#1F7A37',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
  errorText: {
    color: '#A12727',
    fontWeight: '700',
  },
  ghostButton: {
    alignItems: 'center',
    marginTop: 12,
  },
  ghostButtonText: {
    color: '#1F7A37',
    fontWeight: '700',
  },
  secondaryButton: {
    marginTop: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1F7A37',
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#1F7A37',
    fontWeight: '700',
    fontSize: 14,
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
    color: '#1F7A37',
    fontWeight: '700',
    marginTop: 10,
  },
});
