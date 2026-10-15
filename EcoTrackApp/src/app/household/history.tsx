import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import CollectionHistory, { HistoryRow } from '@/components/collection-history';
import { HouseholdHistoryRow, householdApi } from '@/lib/api';

function wasteLabel(w: string) {
  if (w === 'mixed') return 'Mixed';
  if (w === 'non_biodegradable') return 'Non-bio';
  return w.charAt(0).toUpperCase() + w.slice(1);
}

const REPORT_LABEL: Record<string, { title: string; tag: string; statusKey: string; tone: HistoryRow['tagTone'] }> = {
  no_garbage_out: { title: 'Skip', tag: 'Missed', statusKey: 'Missed', tone: 'orange' },
  dirty_surroundings: { title: 'Dirty surroundings', tag: 'Violation', statusKey: 'Violations', tone: 'red' },
  other: { title: 'Report filed', tag: 'Report', statusKey: 'Other', tone: 'gray' },
};

const EMPTY_TITLES: Record<string, string> = {
  Completed: 'No completed collections',
  Missed: 'No missed collections',
  Violations: 'No violations',
};

function toRows(items: HouseholdHistoryRow[]): HistoryRow[] {
  return items.map((item) => {
    if (item.kind === 'report') {
      const meta = REPORT_LABEL[item.reason] ?? REPORT_LABEL.other;
      const d = new Date(item.createdAt);
      const timeLabel = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      return {
        id: item.id,
        timestamp: item.createdAt,
        timeLabel,
        title: meta.title,
        subtitle: item.message,
        tag: meta.tag,
        tagTone: meta.tone,
        statusKey: meta.statusKey,
        searchText: `${meta.title} ${meta.tag} ${item.message} ${dateStr} ${d.toLocaleDateString()}`.toLowerCase(),
      };
    }
    const d = new Date(item.timestamp);
    const timeLabel = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const wl = wasteLabel(item.wasteType);
    const violated = item.segregationStatus === 'not_segregated';
    return {
      id: item.id,
      timestamp: item.timestamp,
      timeLabel,
      title: 'Waste Collected',
      subtitle: `${wl} · ${String(item.weightKg)} kg · ${violated ? 'Not segregated' : 'Segregated'}`,
      tag: violated ? `Violation · ${wl}` : `Completed · ${wl}`,
      tagTone: violated ? 'red' : 'green',
      statusKey: violated ? 'Violations' : 'Completed',
      searchText: `waste collected ${wl} ${item.wasteType} ${violated ? 'violation not segregated' : 'completed segregated'} ${dateStr} ${d.toLocaleDateString()}`,
    };
  });
}

export default function HouseholdHistoryScreen() {
  const [items, setItems] = useState<HouseholdHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    householdApi
      .history('?include=reports')
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
      statusFilters={['All', 'Completed', 'Missed', 'Violations']}
      emptyHint="Try a different date, waste type, or status keyword."
      emptyTitleFor={(status) => EMPTY_TITLES[status] ?? 'No records found'}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  muted: { color: '#6B7280' },
  error: { color: '#C62828', fontWeight: '700' },
});
