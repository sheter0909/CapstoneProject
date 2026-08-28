import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import DatePickerField from '@/components/date-picker-field';
import { safeBack } from '@/lib/navigation';

export default function ForgotCollectorPasswordScreen() {
  const router = useRouter();
  const { verifyCollectorIdentity } = useAuth();
  const [collectorId, setCollectorId] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    setError('');

    if (!collectorId.trim() || !birthdate.trim()) {
      setError('Collector ID and birthdate are required.');
      return;
    }

    setLoading(true);
    const verified = await verifyCollectorIdentity(collectorId.trim(), birthdate.trim());
    setLoading(false);

    if (!verified) {
      setError('Collector ID and birthdate do not match our records.');
      return;
    }

    router.push('/garbagecollector/reset-password' as any);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Forgot Collector Password</Text>
          <Text style={styles.subtitle}>Enter your Collector ID and birthdate to recover access.</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Collector ID</Text>
            <TextInput
              style={styles.input}
              value={collectorId}
              onChangeText={(val) => {
                setCollectorId(val);
                if (error) setError('');
              }}
              placeholder="e.g. GC-0001"
              placeholderTextColor="#999"
              autoCapitalize="characters"
            />
            <Text style={styles.helperText}>Your Collector ID was assigned by your Administrator.</Text>
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

          <Pressable style={styles.primaryButton} onPress={handleContinue}>
            <Text style={styles.primaryButtonText}>CONTINUE</Text>
          </Pressable>

          <Pressable style={styles.linkButton} onPress={() => safeBack(router, '/garbagecollector/login')}>
            <Text style={styles.linkText}>Back to Login</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.light.background },
  container: { padding: Spacing.four },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 24, padding: Spacing.four, gap: Spacing.three,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 3,
  },
  title: { fontSize: 24, fontWeight: '800', color: '#1F7A37' },
  subtitle: { color: '#4A4A4A', lineHeight: 20 },
  inputGroup: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: '#4A4A4A' },
  input: {
    height: 48, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1,
    borderColor: '#D9D9D9', backgroundColor: '#F7F7F7',
  },
  helperText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    lineHeight: 16,
  },
  errorText: { color: '#B00020', fontSize: 14, fontWeight: '600' },
  primaryButton: { marginTop: 12, borderRadius: 14, backgroundColor: '#1F7A37', paddingVertical: 14, alignItems: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  linkButton: { marginTop: 16, alignItems: 'center' },
  linkText: { color: '#1F7A37', fontWeight: '700' },
});