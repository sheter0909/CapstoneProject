import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Spacing } from '@/constants/theme';
import { collectorApi } from '@/lib/api';

export default function GarbageCollectorReportsScreen() {
  const router = useRouter();
  const [reports, setReports] = useState<{ _id: string; totalKg: number; entries: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    collectorApi
      .reports()
      .then((data: any) => {
        if (isMounted && Array.isArray(data)) {
          setReports(data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const totalWaste = reports.reduce((sum, item) => sum + Number(item.totalKg || 0), 0);
  const totalEntries = reports.reduce((sum, item) => sum + Number(item.entries || 0), 0);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Summary Reports</Text>
        <Text style={styles.subtitle}>Your real-time collection metrics recorded across all households.</Text>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color="#1F7A37" />
          </View>
        ) : (
          <>
            <View style={styles.reportCard}>
              <Text style={styles.reportLabel}>Total Waste Collected</Text>
              <Text style={styles.reportValue}>{totalWaste.toFixed(1)} kg</Text>
            </View>
            <View style={styles.reportCard}>
              <Text style={styles.reportLabel}>Total Collections Logged</Text>
              <Text style={styles.reportValue}>{totalEntries}</Text>
            </View>
            {reports.map((item) => (
              <View key={item._id} style={styles.reportCard}>
                <Text style={styles.reportLabel}>{item._id.replace('_', ' ').toUpperCase()} Waste</Text>
                <Text style={styles.reportValue}>{Number(item.totalKg).toFixed(1)} kg ({item.entries} entries)</Text>
              </View>
            ))}
          </>
        )}

        <Pressable style={styles.primaryButton} onPress={() => router.push('/garbagecollector' as any)}>
          <Text style={styles.primaryButtonText}>Back to Dashboard</Text>
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
    color: '#555',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.two,
  },
  loadingBox: {
    paddingVertical: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportCard: {
    backgroundColor: '#F2F8F2',
    borderRadius: 20,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  reportLabel: {
    color: '#4A4A4A',
  },
  reportValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1F7A37',
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
});