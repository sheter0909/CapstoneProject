import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { webCursor } from './ui';

export type HistoryRow = {
  id: string;
  timestamp: string;
  timeLabel: string;
  title: string;
  subtitle: string;
  tag: string;
  tagTone: 'green' | 'red' | 'gray' | 'orange';
  searchText: string;
  statusKey: string;
  canEdit?: boolean;
};

type HistorySection = { title: string; data: HistoryRow[] };

const NAVY = '#1B2A4A';
const GRAY = '#6B7280';
const GREEN = '#1F7A37';
const BAND = '#EAF0F6';

function dateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function sectionTitle(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  // Compare local calendar days: today.toISOString() is UTC, which is still
  // "yesterday" during 00:00-07:59 in the Philippines (UTC+8).
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  if (dateKey(iso) === todayKey) return 'Today';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function groupByDate(rows: HistoryRow[]): HistorySection[] {
  const map = new Map<string, HistoryRow[]>();
  const keyToIso = new Map<string, string>();
  for (const row of rows) {
    const k = dateKey(row.timestamp);
    if (!map.has(k)) {
      map.set(k, []);
      keyToIso.set(k, row.timestamp);
    }
    map.get(k)!.push(row);
  }
  return [...map.entries()]
    .sort((a, b) => +new Date(keyToIso.get(b[0])!) - +new Date(keyToIso.get(a[0])!))
    .map(([k, data]) => ({
      title: sectionTitle(keyToIso.get(k)!),
      data: data.sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp)),
    }));
}

export default function CollectionHistory({
  title = 'Collection History',
  searchPlaceholder,
  rows,
  statusFilters,
  emptyHint,
  emptyTitleFor,
  onEdit,
}: {
  title?: string;
  searchPlaceholder: string;
  rows: HistoryRow[];
  statusFilters: string[];
  emptyHint: string;
  // Per-filter empty-state title (e.g. Missed -> "No missed collections").
  // Falls back to the generic "No records yet" wording when omitted.
  emptyTitleFor?: (status: string) => string;
  onEdit?: (row: HistoryRow) => void;
}) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState('All');

  // Effective filter: snaps back to 'All' only when the selected status is no
  // longer in the list (e.g. the caller changes statusFilters). Row reloads
  // never reset it, and no effect is needed since this derives every render.
  const effectiveStatus = statusFilters.includes(status) ? status : 'All';

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (effectiveStatus !== 'All' && r.statusKey !== effectiveStatus) return false;
      if (!debounced) return true;
      return r.searchText.toLowerCase().includes(debounced);
    });
  }, [rows, debounced, effectiveStatus]);

  const sections = useMemo(() => groupByDate(filtered), [filtered]);
  const todayStr = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <View style={styles.wrap}>
      <View style={styles.headerWrap}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
      </View>

      <View style={styles.subHeader}>
        <Text style={styles.asOf}>As of {todayStr}</Text>
        <Pressable
          accessibilityLabel="Cycle status filter"
          style={[webCursor(), styles.iconBtn]}
          onPress={() => {
            const i = statusFilters.indexOf(effectiveStatus);
            setStatus(statusFilters[(i + 1) % statusFilters.length]);
          }}
        >
          <MaterialIcons name="filter-list" size={20} color={NAVY} />
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <MaterialIcons name="search" size={20} color={GRAY} />
          <TextInput
            style={styles.searchInput}
            placeholder={searchPlaceholder}
            placeholderTextColor="#9AA0A6"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query.length > 0 ? (
            <Pressable accessibilityLabel="Clear search" onPress={() => setQuery('')} style={webCursor()}>
              <MaterialIcons name="cancel" size={18} color={GRAY} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chips}
      >
        {statusFilters.map((f) => (
          <Pressable
            key={f}
            onPress={() => setStatus(f)}
            style={[webCursor(), styles.chip, effectiveStatus === f && styles.chipActive]}
          >
            <Text style={[styles.chipText, effectiveStatus === f && styles.chipTextActive]}>{f}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="search-off" size={36} color="#9AA0A6" />
          <Text style={styles.emptyTitle}>
            {query
              ? `No results found for '${query}'`
              : emptyTitleFor
                ? emptyTitleFor(effectiveStatus)
                : 'No records found'}
          </Text>
          <Text style={styles.emptySub}>{emptyHint}</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listContent}
          renderSectionHeader={({ section }) => (
            <View style={styles.bandWrap}>
              <View style={styles.band}>
                <Text style={styles.bandText}>{section.title}</Text>
              </View>
            </View>
          )}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.time}>{item.timeLabel}</Text>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowSub}>{item.subtitle}</Text>
              </View>
              {item.canEdit && onEdit ? (
                <Pressable accessibilityLabel={`Edit entry ${item.id}`} style={[webCursor(), styles.editBtn]} onPress={() => onEdit(item)}>
                  <Text style={styles.editBtnText}>Edit</Text>
                </Pressable>
              ) : null}
              <View style={[styles.tag, styles[`tag_${item.tagTone}`]]}>
                <Text style={[styles.tagText, styles[`tagText_${item.tagTone}`]]}>{item.tag}</Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden' },
  headerWrap: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
    backgroundColor: '#FFFFFF',
  },
  header: {
    backgroundColor: GREEN,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  subHeader: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  asOf: { color: NAVY, fontWeight: '800', fontSize: 15 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F3F4',
  },
  searchRow: { paddingHorizontal: 16, paddingBottom: 10, backgroundColor: '#FFFFFF' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F1F3F4',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: NAVY, padding: 0 },
  chipsScroll: {
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: 8,
  },
  chips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF',
  },
  chip: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#F1F3F4',
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipActive: { backgroundColor: NAVY },
  chipText: { fontSize: 12, fontWeight: '700', color: GRAY },
  chipTextActive: { color: '#FFFFFF' },
  listContent: { paddingBottom: 24 },
  bandWrap: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  band: {
    backgroundColor: BAND,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  bandText: { color: NAVY, fontWeight: '800', fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#EEF0F2',
    backgroundColor: '#FFFFFF',
  },
  rowLeft: { flex: 1, gap: 2, paddingRight: 12 },
  editBtn: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#E8F7E9', marginRight: 8 },
  editBtnText: { color: GREEN, fontWeight: '800', fontSize: 13 },
  time: { color: GRAY, fontSize: 11, fontWeight: '600', marginBottom: 2 },
  rowTitle: { color: NAVY, fontWeight: '800', fontSize: 15, marginBottom: 2 },
  rowSub: { color: GRAY, fontSize: 12, lineHeight: 16 },
  tag: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'center' },
  tag_green: { backgroundColor: '#E8F5E9' },
  tag_red: { backgroundColor: '#FDECEA' },
  tag_orange: { backgroundColor: '#FFF4E5' },
  tag_gray: { backgroundColor: '#F1F3F4' },
  tagText: { fontSize: 12, fontWeight: '800' },
  tagText_green: { color: GREEN },
  tagText_red: { color: '#C62828' },
  tagText_orange: { color: '#E65100' },
  tagText_gray: { color: GRAY },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 48, paddingHorizontal: 24 },
  emptyTitle: { color: NAVY, fontWeight: '800', fontSize: 15, textAlign: 'center' },
  emptySub: { color: GRAY, fontSize: 13, textAlign: 'center' },
});
