import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import CollectionHistory, { HistoryRow } from '@/components/collection-history';
import { CollectionHistoryItem, householdApi } from '@/lib/api';

function wasteLabel(w: string) {
  if (w === 'non_biodegradable') return 'Non-bio';
  return w.charAt(0).toUpperCase() + w.slice(1);
}

function toRows(items: CollectionHistoryItem[]): HistoryRow[] {
  return items.map((item) => {
    const d = new Date(item.timestamp);
    const timeLabel = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const wl = wasteLabel(item.wasteType);
    return {
      id: item.id,
      timestamp: item.timestamp,
      timeLabel,
      title: 'Waste Collected',
      subtitle: `${wl} · ${String(item.weightKg)} kg · ${item.segregationStatus === 'segregated' ? 'Segregated' : 'Not segregated'}`,
      tag: `Completed · ${wl}`,
      tagTone: 'green',
      statusKey: 'Completed',
      searchText: `waste collected ${wl} ${item.wasteType} completed ${dateStr} ${d.toLocaleDateString()}`,
    };
  });
}

export default function HouseholdHistoryScreen() {
  const [items, setItems] = useState<CollectionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    householdApi
      .history()
      .then((r) => mounted && setItems(Array.isArray(r) ? r : []))
      .catch((e) => mounted && setError(e instanceof Error ? e.message : 'Unable to load collection history.'))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const rows = useMemo(() => toRows(items), [items]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" color="#1F7A37" />
        <Text style={styles.muted}>Loading collection history...</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  return (
    <CollectionHistory
      searchPlaceholder="Search by household, date, or waste type"
      rows={rows}
      statusFilters={['All', 'Completed', 'Missed', 'Pending']}
      emptyHint="Try a different date, waste type, or status keyword."
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  muted: { color: '#6B7280' },
  error: { color: '#C62828', fontWeight: '700' },
});
