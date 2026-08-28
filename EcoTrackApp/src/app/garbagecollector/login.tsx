import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';

export default function GarbageCollectorLoginScreen() {
  const router = useRouter();
  const { loginCollector } = useAuth();
  const [collectorId, setCollectorId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');

    if (!collectorId.trim() || !password.trim()) {
      setError('Collector ID and Password are required.');
      return;
    }

    const success = await loginCollector(collectorId, password);

    if (!success) {
      setError('Invalid Collector ID or Password.');
      return;
    }

    router.push('/garbagecollector' as any);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.headerBar}>
          <Text style={styles.headerBrand}>EcoTrack</Text>
          <Text style={styles.headerSub}>Garbage Collector Portal</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.brandTitleLarge}>EcoTrack</Text>
          <Text style={styles.brandSubtitle}>Garbage Collector Portal</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Collector ID</Text>
            <View style={styles.inputWithIcon}>
              <MaterialIcons name="person" size={20} color="#6B8A6B" />
              <TextInput
                value={collectorId}
                onChangeText={(val) => {
                  setCollectorId(val);
                  if (error) setError('');
                }}
                placeholder="e.g. GC-0001"
                placeholderTextColor="#9AA39A"
                style={styles.inputWithIconField}
                autoCapitalize="characters"
              />
            </View>
            <Text style={styles.helperText}>Your Collector ID was assigned by your Administrator.</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWithIcon}>
              <MaterialIcons name="lock" size={20} color="#6B8A6B" />
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="Enter password"
                placeholderTextColor="#9AA39A"
                style={styles.inputWithIconField}
              />
            </View>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable style={styles.primaryButton} onPress={handleLogin}>
            <Text style={styles.primaryButtonText}>LOGIN</Text>
          </Pressable>

          <Pressable style={styles.ghostButton} onPress={() => router.push('/garbagecollector/forgot-password' as any)}>
            <Text style={styles.ghostButtonText}>Forgot password?</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={() => router.push('/')}>
            <Text style={styles.secondaryButtonText}>Back to Household Login</Text>
          </Pressable>
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
  inputGroupRow: {
    gap: Spacing.three,
  },
  inputWithIcon: {
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
  inputWithIconField: {
    flex: 1,
    height: '100%',
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
  errorText: {
    color: '#B00020',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  secondaryButton: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1F7A37',
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#0F4F28',
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  headerBar: {
    backgroundColor: '#1F7A37',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: 8,
    alignItems: 'center',
  },
  headerBrand: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  headerSub: {
    color: '#D6F3D1',
    fontSize: 12,
  },
  brandTitleLarge: {
    fontSize: 40,
    fontWeight: '900',
    color: '#1B4A28',
    textAlign: 'center',
  },
  primaryButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
  ghostButton: {
    alignItems: 'center',
    marginTop: 12,
  },
  ghostButtonText: {
    color: '#1F7A37',
    fontWeight: '700',
  },
});