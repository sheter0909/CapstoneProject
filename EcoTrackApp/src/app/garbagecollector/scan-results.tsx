import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type TextStyle } from 'react-native';
import { Spacing } from '@/constants/theme';
import { AREA_NAME } from '@/constants/area';
import { ApiError, CollectionHistoryItem, collectorApi, HouseholdUser } from '@/lib/api';
import { toWasteTypeLabel } from '@/lib/labels';
import { safeBack } from '@/lib/navigation';

export default function GarbageCollectorScanResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ householdId?: string }>();
  const rawHouseholdId = Array.isArray(params.householdId) ? params.householdId[0] : params.householdId;
  const targetId = rawHouseholdId?.trim() ?? '';

  const [household, setHousehold] = useState<HouseholdUser | null>(null);
  const [history, setHistory] = useState<CollectionHistoryItem[]>([]);
  const [notSegregatedCount, setNotSegregatedCount] = useState(0);
  const [nextWarningLevel, setNextWarningLevel] = useState('a warning');
  const [loading, setLoading] = useState(targetId !== '');
  const [error, setError] = useState(targetId === '' ? 'Missing household. Please scan again.' : '');

  useEffect(() => {
    if (!targetId) return;
    let isMounted = true;
    collectorApi
      .householdSummary(targetId)
      .then((data) => {
        if (isMounted) {
          setHousehold(data.household);
          setHistory(data.history ?? []);
          setNotSegregatedCount(data.notSegregatedCount ?? 0);
          setNextWarningLevel(data.nextWarningLevel?.trim() ? data.nextWarningLevel : 'a warning');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        // Map by status code, not message text: the backend wording may change
        // without breaking the UI, and transport failures must never read as
        // a permissions or credential problem.
        if (err instanceof ApiError && err.status === 404) {
          setError('No household found with that ID.');
        } else if (err instanceof ApiError && err.status === 401) {
          setError('Your session expired. Please log in again.');
          router.replace('/garbagecollector/login');
        } else if (err instanceof ApiError && err.status === 403) {
          setError('Your account is not allowed to look up households.');
        } else if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Cannot reach the server. Check your connection.');
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [router, targetId]);

  const name = household?.fullName || `Household ${targetId}`;
  const address = [AREA_NAME, household?.purok].filter(Boolean).join(' • ') || 'Not specified';
  const status = household?.status ? household.status.toUpperCase() : 'ACTIVE';
  const lastVisit = history[0] ? new Date(history[0].timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  const { width: screenWidth } = useWindowDimensions();
  const stackedStats = screenWidth < 340;
  const mostRecent = history[0];
  const [nowMs] = useState(() => Date.now());
  const collectedThisWeek = Boolean(mostRecent && nowMs - new Date(mostRecent.timestamp).getTime() <= 7 * 24 * 60 * 60 * 1000);
  const editBlocked = collectedThisWeek && mostRecent?.editable !== true;

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

            <View style={[styles.summaryRow, stackedStats && styles.summaryRowStacked]}>
              <View style={[styles.summaryItem, stackedStats && styles.summaryItemStacked]}>
                <Text style={styles.summaryLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                  Status
                </Text>
                <Text style={[styles.summaryValue, styles.noWrap]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {status}
                </Text>
              </View>
              <View style={[styles.summaryItem, stackedStats && styles.summaryItemStacked]}>
                <Text style={styles.summaryLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                  Last Visit
                </Text>
                <Text style={[styles.summaryValue, styles.noWrap]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {lastVisit}
                </Text>
              </View>
              <View style={[styles.summaryItem, stackedStats && styles.summaryItemStacked]}>
                <Text style={styles.summaryLabel} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>
                  Not Segregated
                </Text>
                <Text style={[styles.summaryValue, styles.noWrap]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {notSegregatedCount}
                </Text>
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

            {editBlocked ? (
              <Text style={styles.errorText}>Already collected this week. Editing is closed.</Text>
            ) : (
              <Pressable
                style={styles.primaryButton}
                onPress={() => {
                  const navParams: Record<string, string> = { householdId: household?.householdId || targetId, nextWarningLevel };
                  if (mostRecent?.editable === true) {
                    navParams.entryId = mostRecent.id;
                    navParams.segregated = mostRecent.segregationStatus === 'segregated' ? 'segregated' : 'not-segregated';
                    navParams.wasteType = toWasteTypeLabel(mostRecent.wasteType);
                    navParams.weight = String(mostRecent.weightKg);
                    if (mostRecent.editableUntil) navParams.editableUntil = mostRecent.editableUntil;
                  }
                  router.push({ pathname: '/garbagecollector/garbage-input', params: navParams });
                }}
              >
                <Text style={styles.primaryButtonText}>Proceed to Collection Input</Text>
              </Pressable>
            )}
            <Pressable
              style={styles.flagButton}
              onPress={() => {
                router.push({
                  pathname: '/garbagecollector/contact',
                  params: { householdId: household?.householdId || targetId },
                });
              }}
            >
              <Text style={styles.flagButtonText}>Flag Household (Skip / Report)</Text>
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
    padding: Spacing.three,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: Spacing.three,
    gap: Spacing.four,
    boxShadow: '0px 8px 12px rgba(0,0,0,0.05)',
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
    width: '100%',
    gap: 8,
  },
  summaryRowStacked: {
    flexDirection: 'column',
  },
  summaryItem: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#F7FBF7',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 6,
    minHeight: 78,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryItemStacked: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    minHeight: 0,
    paddingHorizontal: 12,
  },
  summaryLabel: {
    color: '#4A4A4A',
    fontSize: 11,
    marginBottom: Spacing.one,
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F7A37',
    textAlign: 'center',
  },
  noWrap: Platform.select({
    web: { whiteSpace: 'nowrap', wordBreak: 'normal' } as unknown as TextStyle,
    default: {},
  }),
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
  flagButton: {
    marginTop: Spacing.two,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#B45309',
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
  },
  flagButtonText: {
    color: '#B45309',
    fontWeight: '700',
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