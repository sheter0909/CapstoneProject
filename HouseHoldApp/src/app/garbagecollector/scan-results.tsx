import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { CollectionHistoryItem, collectorApi, HouseholdUser } from '@/lib/api';
import { safeBack } from '@/lib/navigation';

export default function GarbageCollectorScanResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ householdId?: string }>();
  const targetId = params.householdId || '0123';

  const [household, setHousehold] = useState<HouseholdUser | null>(null);
  const [history, setHistory] = useState<CollectionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    collectorApi
      .householdSummary(targetId)
      .then((data) => {
        if (isMounted) {
          setHousehold(data.household);
          setHistory(data.history ?? []);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unable to load household summary.');
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [targetId]);

  const name = household?.fullName || `Household ${targetId}`;
  const address = [household?.purok, household?.address].filter(Boolean).join(', ') || 'Not specified';
  const status = household?.status ? household.status.toUpperCase() : 'ACTIVE';
  const lastVisit = history[0] ? new Date(history[0].timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'None';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>QR Results</Text>

        {loading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator size="small" color="#1F7A37" />
            <Text style={styles.stateText}>Loading household data...</Text>
          </View>
        ) : error ? (
          <View style={styles.stateBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <>
            <View style={styles.profileCard}>
              <Text style={styles.profileName}>{name}</Text>
              <Text style={styles.profileSubtitle}>{address}</Text>
              <Text style={styles.profileId}>Household ID: {household?.householdId || targetId}</Text>
            </View>

            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Status</Text>
                <Text style={styles.summaryValue}>{status}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Last Visit</Text>
                <Text style={styles.summaryValue}>{lastVisit}</Text>
              </View>
            </View>

            <View style={styles.historyCard}>
              <Text style={styles.historyTitle}>Collection history</Text>
              {history.length === 0 ? (
                <Text style={styles.historyEntry}>No collections recorded yet.</Text>
              ) : (
                history.slice(0, 3).map((item) => (
                  <Text key={item.id} style={styles.historyEntry}>
                    {new Date(item.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ·{' '}
                    {item.segregationStatus === 'segregated' ? 'Segregated' : 'Not segregated'} · {String(item.weightKg)} kg
                  </Text>
                ))
              )}
            </View>

            <Pressable
              style={styles.primaryButton}
              onPress={() =>
                router.push({
                  pathname: '/garbagecollector/garbage-input' as any,
                  params: { householdId: household?.householdId || targetId },
                })
              }
            >
              <Text style={styles.primaryButtonText}>Proceed to Collection Input</Text>
            </Pressable>
          </>
        )}

        <Pressable style={styles.backButton} onPress={() => safeBack(router, '/garbagecollector/quick-scan')}>
          <Text style={styles.backText}>Back to Scan</Text>
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
  profileCard: {
    backgroundColor: '#E8F7E2',
    borderRadius: 20,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1F7A37',
  },
  profileSubtitle: {
    color: '#4A4A4A',
  },
  profileId: {
    color: '#3D6E3F',
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.four,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: '#F7FBF7',
    borderRadius: 18,
    padding: Spacing.three,
  },
  summaryLabel: {
    color: '#4A4A4A',
    marginBottom: Spacing.one,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F7A37',
  },
  historyCard: {
    backgroundColor: '#F2F8F2',
    borderRadius: 20,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  historyTitle: {
    fontWeight: '700',
    color: '#1F7A37',
    marginBottom: Spacing.one,
  },
  historyEntry: {
    color: '#4A4A4A',
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
  stateBox: {
    paddingVertical: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  stateText: {
    color: '#6B7280',
    fontSize: 14,
  },
  errorText: {
    color: '#DC2626',
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
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