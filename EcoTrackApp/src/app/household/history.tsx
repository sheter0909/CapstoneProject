import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { CollectionHistoryItem, householdApi } from '@/lib/api';
import { safeBack } from '@/lib/navigation';

export default function HouseholdHistoryScreen() {
  const router = useRouter();
  const [historyItems, setHistoryItems] = useState<CollectionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    householdApi
      .history()
      .then((items) => {
        if (isMounted) {
          setHistoryItems(Array.isArray(items) ? items : []);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unable to load collection history.');
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Collection History</Text>
        <Text style={styles.subtitle}>All waste collections recorded for your household.</Text>

        {loading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator size="small" color="#1F7A37" />
            <Text style={styles.stateText}>Loading collection history...</Text>
          </View>
        ) : error ? (
          <View style={styles.stateBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : historyItems.length === 0 ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>No collection records found yet.</Text>
          </View>
        ) : (
          <>
            <View style={styles.headerRow}>
              <Text style={styles.headerLabel}>Date</Text>
              <Text style={styles.headerLabel}>Details</Text>
              <Text style={styles.headerLabel}>Weight</Text>
            </View>
            {historyItems.map((item) => (
              <View key={item.id} style={styles.row}>
                <Text style={styles.date}>
                  {new Date(item.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </Text>
                <View style={styles.detailContainer}>
                  <Text style={styles.detail}>
                    {item.segregationStatus === 'segregated' ? 'Segregated' : 'Not segregated'}
                  </Text>
                  <Text style={styles.wasteType}>{item.wasteType}</Text>
                </View>
                <Text style={styles.weight}>{String(item.weightKg)} kg</Text>
              </View>
            ))}
          </>
        )}

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
    color: '#555',
    fontSize: 14,
    marginBottom: Spacing.two,
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
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: Spacing.one,
    borderBottomWidth: 1,
    borderColor: '#E8E8E8',
  },
  headerLabel: {
    fontWeight: '700',
    color: '#4A4A4A',
    width: '30%',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderColor: '#F0F0F0',
  },
  date: {
    color: '#1F7A37',
    width: '30%',
    fontWeight: '700',
  },
  detailContainer: {
    width: '40%',
  },
  detail: {
    color: '#4A4A4A',
    fontWeight: '600',
  },
  wasteType: {
    color: '#6B7280',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  weight: {
    color: '#4A4A4A',
    width: '30%',
    textAlign: 'right',
    fontWeight: '700',
  },
  backButton: {
    marginTop: Spacing.four,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1F7A37',
    paddingVertical: 14,
    alignItems: 'center',
  },
  backText: {
    color: '#1F7A37',
    fontWeight: '700',
  },
});
