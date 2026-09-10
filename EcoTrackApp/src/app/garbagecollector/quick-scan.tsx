import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Spacing } from '@/constants/theme';
import { safeBack } from '@/lib/navigation';

function extractHouseholdId(qrData: string): string | null {
  const normalized = qrData.trim();
  if (!normalized) return null;
  if (normalized.startsWith('household-')) {
    const segments = normalized.split('-');
    if (segments.length >= 2 && segments[1]) return segments[1];
    return null;
  }
  return normalized;
}

export default function GarbageCollectorQuickScanScreen() {
  const router = useRouter();
  const [householdId, setHouseholdId] = useState('');
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const navigateToResults = (targetId: string) => {
    router.push({
      pathname: '/garbagecollector/scan-results' as any,
      params: { householdId: targetId },
    });
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    const extracted = extractHouseholdId(data);
    if (!extracted) return;
    setScanned(true);
    setHouseholdId(extracted);
    navigateToResults(extracted);
  };

  const handleProceed = () => {
    const targetId = householdId.trim() || extractHouseholdId(householdId) || '0123';
    navigateToResults(targetId);
  };

  const handleRescan = () => {
    setScanned(false);
    setHouseholdId('');
  };

  if (!permission) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator size="large" color="#1F7A37" />
        <Text style={styles.stateText}>Requesting camera access...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Quick Scan</Text>
          <Text style={styles.subtitle}>
            Camera access is needed to scan resident QR codes. Grant permission below, or enter the Household ID manually.
          </Text>

          <Pressable style={styles.primaryButton} onPress={requestPermission}>
            <Text style={styles.primaryButtonText}>Allow Camera Access</Text>
          </Pressable>

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

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.title}>Quick Scan</Text>
        <Text style={styles.subtitle}>Point the camera at a resident QR code to start collection.</Text>

        <View style={styles.scannerFrame}>
          {scanned ? (
            <Pressable style={styles.scannedOverlay} onPress={handleRescan}>
              <Text style={styles.scannedText}>✓ Scanned: {householdId}</Text>
              <Text style={styles.rescanText}>Tap to scan again</Text>
            </Pressable>
          ) : (
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleBarcodeScanned}
            />
          )}
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
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  stateText: {
    color: '#6B7280',
    fontSize: 14,
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
  scannerFrame: {
    height: 280,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#000000',
    marginTop: Spacing.four,
  },
  scannedOverlay: {
    flex: 1,
    backgroundColor: '#1F7A37',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  scannedText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  rescanText: {
    color: '#D4EBD7',
    fontSize: 13,
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
