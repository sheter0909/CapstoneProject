import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
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
      .then((data: any) => {
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
    .filter((item) => item._id !== 'non_biodegradable' && item._id !== 'not_segregated')
    .reduce((sum, item) => sum + Number(item.totalKg || 0), 0);
  const nonSegregatedWaste = reports
    .filter((item) => item._id === 'non_biodegradable' || item._id === 'not_segregated')
    .reduce((sum, item) => sum + Number(item.totalKg || 0), 0);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.profileCard}>
        <Text style={styles.title}>{collectorUser?.fullName || 'Garbage Collector'}</Text>
        <Text style={styles.subtitle}>Collector ID: {collectorUser?.collectorId || 'Pending'}</Text>
      </View>

      <View style={styles.statsCard}>
        <Text style={styles.sectionTitle}>Collection Overview</Text>
        <Text style={styles.statText}>Total Waste Logged: {totalWaste.toFixed(1)} kg</Text>
        <Text style={styles.statText}>Segregated / Recyclable: {segregatedWaste.toFixed(1)} kg</Text>
        <Text style={styles.statText}>Non-segregated: {nonSegregatedWaste.toFixed(1)} kg</Text>
      </View>

      <Pressable style={styles.actionButton} onPress={() => router.push('/garbagecollector/quick-scan' as any)}>
        <Text style={styles.actionButtonText}>Quick Scan</Text>
      </Pressable>
      <Pressable style={styles.actionButtonSecondary} onPress={() => router.push('/garbagecollector/activity-logs' as any)}>
        <Text style={styles.actionButtonSecondaryText}>Activity Logs</Text>
      </Pressable>
      <Pressable style={styles.actionButtonSecondary} onPress={() => router.push('/garbagecollector/reports' as any)}>
        <Text style={styles.actionButtonSecondaryText}>Summary Reports</Text>
      </Pressable>

      <Pressable style={styles.logoutButton} onPress={() => router.push('/garbagecollector/logout' as any)}>
        <Text style={styles.logoutButtonText}>LOGOUT</Text>
      </Pressable>
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
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1F7A37',
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
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F7A37',
  },
  statText: {
    color: '#4A4A4A',
    lineHeight: 24,
  },
  actionButton: {
    backgroundColor: '#1F7A37',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  actionButtonSecondary: {
    backgroundColor: '#E8F7E9',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
  },
  actionButtonSecondaryText: {
    color: '#1F7A37',
    fontWeight: '700',
    fontSize: 16,
  },
  logoutButton: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1F7A37',
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  logoutButtonText: {
    color: '#1F7A37',
    fontWeight: '700',
    fontSize: 15,
  },
});
