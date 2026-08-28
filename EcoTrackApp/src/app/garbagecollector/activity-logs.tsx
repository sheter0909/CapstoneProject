import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Spacing } from '@/constants/theme';
import { collectorApi } from '@/lib/api';

type Entry = { id: string; householdId: string; segregationStatus: string; wasteType: string; weightKg: number | string; timestamp: string; editedAt?: string | null };

export default function GarbageCollectorActivityLogsScreen() {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    collectorApi.activityLogs().then((result: any) => setEntries(result.items ?? [])).catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Unable to load entries.'));
  }, []);

  const canEdit = (entry: Entry) => Date.now() - new Date(entry.timestamp).getTime() <= 2 * 60 * 60 * 1000;
  const openEdit = (entry: Entry) => router.push({ pathname: '/garbagecollector/garbage-input' as any, params: { entryId: entry.id, householdId: entry.householdId, segregated: entry.segregationStatus === 'segregated' ? 'segregated' : 'not-segregated', wasteType: entry.wasteType === 'non_biodegradable' ? 'Non-biodegradable' : entry.wasteType.charAt(0).toUpperCase() + entry.wasteType.slice(1), weight: String(entry.weightKg) } });

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Activity Logs</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {entries.length === 0 && !error ? <Text style={styles.empty}>No collection entries yet.</Text> : null}
        {entries.map((entry) => (
          <View key={entry.id} style={styles.logItem}>
            <View style={styles.content}>
              <Text style={styles.logTitle}>Household {entry.householdId}</Text>
              <Text style={styles.subtitle}>{entry.segregationStatus === 'segregated' ? 'Segregated' : 'Not segregated'} · {entry.wasteType} · {entry.weightKg} kg{entry.editedAt ? ' · edited' : ''}</Text>
              <Text style={styles.time}>{new Date(entry.timestamp).toLocaleString()}</Text>
            </View>
            {canEdit(entry) ? <Pressable style={styles.editButton} onPress={() => openEdit(entry)}><Text style={styles.editText}>Edit</Text></Pressable> : <Text style={styles.locked}>Locked</Text>}
          </View>
        ))}
        <Pressable style={styles.primaryButton} onPress={() => router.push('/garbagecollector/reports' as any)}><Text style={styles.primaryText}>View Reports</Text></Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.four },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: Spacing.four, gap: Spacing.four },
  title: { fontSize: 24, fontWeight: '800', color: '#1F7A37' },
  logItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F9F7', borderRadius: 18, padding: Spacing.four, marginBottom: Spacing.two },
  content: { flex: 1, gap: Spacing.one },
  logTitle: { fontWeight: '700', color: '#1F7A37' },
  subtitle: { color: '#4A4A4A' },
  time: { color: '#777', fontSize: 12 },
  editButton: { backgroundColor: '#1F7A37', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  editText: { color: '#FFFFFF', fontWeight: '800' },
  locked: { color: '#999', fontWeight: '700' },
  empty: { color: '#4A4A4A' },
  error: { color: '#A12727', fontWeight: '700' },
  primaryButton: { backgroundColor: '#1F7A37', borderRadius: 18, paddingVertical: 16, alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontWeight: '800' },
});
