import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { safeBack } from '@/lib/navigation';

export default function GarbageCollectorQuickScanScreen() {
  const router = useRouter();
  const [householdId, setHouseholdId] = useState('');

  const handleProceed = () => {
    const targetId = householdId.trim() || '0123';
    router.push({
      pathname: '/garbagecollector/scan-results' as any,
      params: { householdId: targetId },
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.title}>Quick Scan</Text>
        <Text style={styles.subtitle}>Scan a resident QR code or enter Household ID to start collection.</Text>

        <View style={styles.scannerPlaceholder}>
          <Text style={styles.scannerText}>CAMERA / QR SCANNER</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Or Enter Household ID manually:</Text>
          <TextInput
            style={styles.input}
            value={householdId}
            onChangeText={setHouseholdId}
            placeholder="e.g. 011704 or 0123"
            placeholderTextColor="#999"
            autoCapitalize="none"
          />
        </View>

        <Pressable style={styles.primaryButton} onPress={handleProceed}>
          <Text style={styles.primaryButtonText}>Get Results & Proceed</Text>
        </Pressable>

        <Pressable style={styles.backButton} onPress={() => safeBack(router, '/garbagecollector/home')}>
          <Text style={styles.backText}>Back to Dashboard</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.four,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: Spacing.four,
    gap: Spacing.four,
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
    lineHeight: 22,
  },
  scannerPlaceholder: {
    height: 280,
    borderRadius: 24,
    backgroundColor: '#F2F8F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.four,
  },
  scannerText: {
    color: '#6B6B6B',
    fontWeight: '700',
  },
  primaryButton: {
    marginTop: Spacing.four,
    backgroundColor: '#1F7A37',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  inputGroup: {
    gap: 8,
    marginTop: Spacing.two,
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
    fontSize: 15,
  },
  backButton: {
    marginTop: Spacing.two,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1F7A37',
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  backText: {
    color: '#1F7A37',
    fontWeight: '700',
  },
});