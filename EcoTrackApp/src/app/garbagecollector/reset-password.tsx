import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';

export default function ResetCollectorPasswordScreen() {
  const router = useRouter();
  const { collectorRecoveryVerified, resetCollectorPassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isReset, setIsReset] = useState(false);

  useEffect(() => {
    if (!collectorRecoveryVerified && !isReset) {
      router.replace('/garbagecollector/forgot-password' as any);
      return;
    }

    if (!isReset) return;

    const timeout = setTimeout(() => router.replace('/garbagecollector/login' as any), 1800);
    return () => clearTimeout(timeout);
  }, [collectorRecoveryVerified, isReset, router]);

  const handleReset = async () => {
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }

    const result = await resetCollectorPassword(password);
    if (!result.success) {
      setError(result.error ?? 'Unable to reset password. Please try again.');
      return;
    }
    setIsReset(true);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          {isReset ? (
            <>
              <Text style={styles.title}>Password Successfully Reset</Text>
              <Text style={styles.subtitle}>Your password has been updated. Redirecting you to Garbage Collector Login...</Text>
            </>
          ) : (
            <>
              <Text style={styles.title}>Create New Password</Text>
              <Text style={styles.subtitle}>Choose a new password for your collector account.</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>New password</Text>
                <View style={styles.passwordInput}>
                  <TextInput style={styles.passwordField} value={password} onChangeText={(val) => { setPassword(val); if (error) setError(''); }} placeholder="At least 8 characters" placeholderTextColor="#999" secureTextEntry={!showPassword} />
                  <Pressable accessibilityLabel={showPassword ? 'Hide new password' : 'Show new password'} onPress={() => setShowPassword(!showPassword)}>
                    <MaterialIcons name={showPassword ? 'visibility-off' : 'visibility'} size={22} color="#6B8A6B" />
                  </Pressable>
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirm password</Text>
                <View style={styles.passwordInput}>
                  <TextInput style={styles.passwordField} value={confirmation} onChangeText={setConfirmation} placeholder="Confirm new password" placeholderTextColor="#999" secureTextEntry={!showConfirmation} />
                  <Pressable accessibilityLabel={showConfirmation ? 'Hide confirmation password' : 'Show confirmation password'} onPress={() => setShowConfirmation(!showConfirmation)}>
                    <MaterialIcons name={showConfirmation ? 'visibility-off' : 'visibility'} size={22} color="#6B8A6B" />
                  </Pressable>
                </View>
              </View>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <Pressable style={styles.primaryButton} onPress={handleReset}>
                <Text style={styles.primaryButtonText}>RESET PASSWORD</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.light.background },
  container: { padding: Spacing.four },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: Spacing.four, gap: Spacing.three, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  title: { fontSize: 24, fontWeight: '800', color: '#1F7A37' },
  subtitle: { color: '#4A4A4A', lineHeight: 20 },
  inputGroup: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: '#4A4A4A' },
  passwordInput: { height: 48, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: '#D9D9D9', backgroundColor: '#F7F7F7', flexDirection: 'row', alignItems: 'center' },
  passwordField: { flex: 1, height: '100%' },
  errorText: { color: '#B00020', fontSize: 14, fontWeight: '600' },
  primaryButton: { marginTop: 12, borderRadius: 14, backgroundColor: '#1F7A37', paddingVertical: 14, alignItems: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});