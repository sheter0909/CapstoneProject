import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { safeBack } from '@/lib/navigation';

export default function HouseholdLogoutScreen() {
  const router = useRouter();
  const { householdUser, logoutHousehold } = useAuth();

  const handleLogout = () => {
    logoutHousehold();
    router.replace('/');
  };

  const name = householdUser?.fullName || 'Household Member';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Logout</Text>
        <Text style={styles.subtitle}>
          You are currently signed in as <Text style={styles.boldText}>{name}</Text> (ID: {householdUser?.householdId || 'Unknown'}). Use the button below to sign out of the household portal.
        </Text>

        <Pressable style={styles.primaryButton} onPress={handleLogout}>
          <Text style={styles.primaryButtonText}>Log out</Text>
        </Pressable>

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
    lineHeight: 22,
    fontSize: 15,
  },
  boldText: {
    fontWeight: '800',
    color: '#1F7A37',
  },
  primaryButton: {
    marginTop: Spacing.four,
    borderRadius: 18,
    backgroundColor: '#1F7A37',
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
    alignItems: 'center',
  },
  backText: {
    color: '#1F7A37',
    fontWeight: '700',
  },
});