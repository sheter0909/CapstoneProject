import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import CollectionHistory, { HistoryRow } from '@/components/collection-history';
import { CollectionHistoryItem, collectorApi } from '@/lib/api';

function toWasteTypeLabel(raw: string): string {
  if (raw === 'mixed') return 'Mixed';
  if (raw === 'non_biodegradable') return 'Non-biodegradable';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export default function GarbageCollectorActivityLogsScreen() {
  const router = useRouter();
  const [entries, setEntries] = useState<CollectionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    collectorApi
      .activityLogs()
      .then((result: { items?: CollectionHistoryItem[] }) => {
        if (mounted) setEntries(result.items ?? []);
      })
      .catch((e) => mounted && setError(e instanceof Error ? e.message : 'Unable to load entries.'))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const rows: HistoryRow[] = useMemo(
    () =>
      entries.map((e) => {
        const d = new Date(e.timestamp);
        const timeLabel = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
        const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        const wasteLabel = e.wasteType === 'mixed' ? 'Mixed' : e.wasteType;
        return {
          id: e.id,
          timestamp: e.timestamp,
          timeLabel,
          title: 'Household Collected',
          subtitle: `Household ${e.householdId} · ${wasteLabel} · ${String(e.weightKg)} kg`,
          tag: 'Done',
          tagTone: 'green',
          statusKey: 'Done',
          searchText: `household collected ${e.householdId} ${wasteLabel} ${e.wasteType} done ${dateStr} ${d.toLocaleDateString()}`,
          canEdit: e.editable === true,
        };
      }),
    [entries]
  );

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
      searchPlaceholder="Search by household, address, or zone"
      rows={rows}
      statusFilters={['All', 'Done', 'Skipped', 'Issue']}
      emptyHint="Try a different household, address, zone, or date."
      onEdit={(row) => {
        const entry = entries.find((e) => e.id === row.id);
        if (!entry) return;
        router.push({
          pathname: '/garbagecollector/garbage-input' as any,
          params: {
            entryId: entry.id,
            householdId: entry.householdId,
            segregated: entry.segregationStatus === 'segregated' ? 'segregated' : 'not-segregated',
            wasteType: toWasteTypeLabel(entry.wasteType),
            weight: String(entry.weightKg),
            ...(entry.editableUntil ? { editableUntil: entry.editableUntil } : {}),
          },
        });
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  muted: { color: '#6B7280' },
  error: { color: '#C62828', fontWeight: '700' },
});
