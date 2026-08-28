import { useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { safeBack } from '@/lib/navigation';

export default function HouseholdQrScreen() {
  const router = useRouter();
  const { householdUser } = useAuth();

  const householdId = householdUser?.householdId || '0123';
  const fullName = householdUser?.fullName || 'Household Member';
  const address = [householdUser?.purok, householdUser?.address].filter(Boolean).join(', ') || 'Community Resident';
  const qrData = `household-${householdId}-${householdUser?.address || ''}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrData)}`;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>My QR Code</Text>
        <Text style={styles.subtitle}>Present this QR code to the garbage collector during waste collection.</Text>

        <View style={styles.qrContainer}>
          <View style={styles.qrWrapper}>
            <Image source={{ uri: qrUrl }} style={styles.qrImage} resizeMode="contain" />
          </View>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoName}>{fullName}</Text>
          <Text style={styles.infoSubtitle}>{address}</Text>
          <Text style={styles.infoId}>Household ID: {householdId}</Text>
        </View>

        <Pressable style={styles.backButton} onPress={() => safeBack(router, '/household/home')}>
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
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1F7A37',
  },
  subtitle: {
    color: '#555555',
    textAlign: 'center',
    lineHeight: 20,
    fontSize: 14,
  },
  qrContainer: {
    width: '100%',
    alignItems: 'center',
    marginVertical: Spacing.two,
  },
  qrWrapper: {
    width: 240,
    height: 240,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 12,
    borderWidth: 2,
    borderColor: '#D4EBD7',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  qrImage: {
    width: 216,
    height: 216,
  },
  infoBox: {
    width: '100%',
    backgroundColor: '#F3F9F4',
    borderRadius: 18,
    padding: Spacing.four,
    alignItems: 'center',
    gap: 4,
  },
  infoName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F7A37',
  },
  infoSubtitle: {
    color: '#4B5563',
    fontSize: 14,
  },
  infoId: {
    marginTop: 4,
    color: '#15803D',
    fontWeight: '700',
    fontSize: 13,
  },
  backButton: {
    width: '100%',
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
