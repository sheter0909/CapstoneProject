import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { AppButton } from '@/components/ui';
import { useAuth } from '@/context/auth';
import { collectorApi } from '@/lib/api';

export default function GarbageCollectorHomeScreen() {
  const router = useRouter();
  const { collectorUser } = useAuth();
  const [reports, setReports] = useState<{ _id: string; totalKg: number; entries: number }[]>([]);

  useEffect(() => {
    let isMounted = true;
    collectorApi
      .reports()
      .then((data) => {
        if (isMounted && Array.isArray(data)) {
          setReports(data);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  const totalWaste = reports.reduce((sum, item) => sum + Number(item.totalKg || 0), 0);
  const segregatedWaste = reports
    .filter((item) => item._id === 'biodegradable' || item._id === 'recyclable' || item._id === 'non_biodegradable')
    .reduce((sum, item) => sum + Number(item.totalKg || 0), 0);
  const nonSegregatedWaste = reports
    .filter((item) => item._id === 'mixed' || item._id === 'not_segregated')
    .reduce((sum, item) => sum + Number(item.totalKg || 0), 0);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.profileCard}>
        <Text style={styles.greeting}>{greeting}!</Text>
        <Text style={styles.title}>{collectorUser?.fullName || 'Garbage Collector'}</Text>
        <Text style={styles.subtitle}>Collector ID: {collectorUser?.collectorId || 'Pending'}</Text>
      </View>

      <View style={styles.scanHero}>
        <Text style={styles.scanHeroTitle}>Quick Scan</Text>
        <Text style={styles.scanHeroSubtitle}>Scan a household QR code to start a collection</Text>
        <View style={styles.scanCta}>
          <AppButton title="Scan now" variant="light" onPress={() => router.push('/garbagecollector/quick-scan')} />
        </View>
      </View>

      <View style={styles.statsCard}>
        <Text style={styles.sectionTitle}>Collection Overview</Text>
        <Pressable
          style={styles.statRow}
          onPress={() => router.push('/garbagecollector/reports')}
          accessibilityRole="button"
          accessibilityLabel="View collection reports"
        >
          <Text style={styles.statLabel}>Total waste logged</Text>
          <Text style={styles.statValue}>{totalWaste.toFixed(1)} kg</Text>
        </Pressable>
        <Pressable
          style={styles.statRow}
          onPress={() => router.push('/garbagecollector/activity-logs')}
          accessibilityRole="button"
          accessibilityLabel="View activity logs"
        >
          <Text style={styles.statLabel}>Segregated</Text>
          <Text style={styles.statValue}>{segregatedWaste.toFixed(1)} kg</Text>
        </Pressable>
        <Pressable
          style={styles.statRow}
          onPress={() => router.push('/garbagecollector/activity-logs')}
          accessibilityRole="button"
          accessibilityLabel="View activity logs"
        >
          <Text style={styles.statLabel}>Non-segregated</Text>
          <Text style={styles.statValue}>{nonSegregatedWaste.toFixed(1)} kg</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.four,
    gap: Spacing.four,
    backgroundColor: Colors.light.background,
  },
  profileCard: {
    backgroundColor: '#F2F8F2',
    borderRadius: 24,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  greeting: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4A7A52',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1F7A37',
  },
  scanHero: {
    backgroundColor: '#1F7A37',
    borderRadius: 24,
    padding: Spacing.four,
    gap: 4,
    alignItems: 'stretch',
    boxShadow: '0px 6px 12px rgba(31,122,55,0.25)',
    elevation: 4,
  },
  scanHeroTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  scanHeroSubtitle: {
    fontSize: 14,
    color: '#D6F3D1',
    textAlign: 'center',
    marginBottom: 8,
  },
  scanCta: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 280,
  },
  subtitle: {
    color: '#4A4A4A',
    fontSize: 16,
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: Spacing.four,
    gap: Spacing.two,
    boxShadow: '0px 8px 12px rgba(0,0,0,0.05)',
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F7A37',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F2F8F2',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  statLabel: {
    color: '#4A4A4A',
    fontWeight: '600',
  },
  statValue: {
    color: '#1F7A37',
    fontWeight: '800',
  },
});
