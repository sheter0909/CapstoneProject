import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Spacing } from '@/constants/theme';
import { AppButton, SectionHeader } from '@/components/ui';
import { useAuth } from '@/context/auth';
import { CollectionHistoryItem, HouseholdHistoryRow, householdApi, NotificationItem } from '@/lib/api';

const COMPLIANT_MESSAGE = {
  title: 'Great job!',
  body: 'Your household is currently compliant. Keep segregating your waste properly.',
};

export default function HouseholdHomeScreen() {
  const router = useRouter();
  const { householdUser, hydrated, refreshHouseholdProfile } = useAuth();
  const [latestHistory, setLatestHistory] = useState<HouseholdHistoryRow | null>(null);
  const [latestCollection, setLatestCollection] = useState<CollectionHistoryItem | null>(null);
  const [latestNotification, setLatestNotification] = useState<NotificationItem | null>(null);
  const compliantMessage = COMPLIANT_MESSAGE;

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [, histories, notifications] = await Promise.all([
          refreshHouseholdProfile().catch(() => undefined),
          // Fetch a small window (not just 1): when the newest row is a
          // report, the latest collection can sit a few rows down. The merge
          // only ever contains non-dismissed reports.
          householdApi.history('?limit=10&include=reports').catch(() => []),
          householdApi.notifications().catch(() => []),
        ]);
        if (isMounted) {
          if (Array.isArray(histories) && histories.length > 0) {
            const rows = histories as HouseholdHistoryRow[];
            setLatestHistory(rows[0]);
            const firstCollection = rows.find((h) => h.kind === 'collection');
            setLatestCollection(firstCollection && firstCollection.kind === 'collection' ? firstCollection : null);
          }
          if (Array.isArray(notifications) && notifications.length > 0) {
            setLatestNotification(notifications[0]);
          }
        }
      } catch {
        // ignore
      }
    }
    if (hydrated) loadData();
    return () => { isMounted = false; };
  }, [hydrated, refreshHouseholdProfile]);

  const displayName = householdUser?.fullName || 'Household Member';
  const displayInitial = (displayName.trim().charAt(0) || 'H').toUpperCase();
  const displaySubtitle =
    [householdUser?.purok, householdUser?.address].filter(Boolean).join(' • ')
    || 'Community Resident';
  const displayId = householdUser?.householdId || 'Pending';
  const latestIsDirtyReport = latestHistory?.kind === 'report' && latestHistory.reason === 'dirty_surroundings';
  const isCompliant =
    !latestCollection || (latestCollection.segregationStatus === 'segregated' && !latestIsDirtyReport);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.profileCard}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarInitial}>{displayInitial}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileSubtitle}>{displaySubtitle}</Text>
          <Text style={styles.profileMeta}>Household ID: {displayId}</Text>
        </View>
      </View>

      <View style={isCompliant ? styles.compliantBanner : styles.attentionBanner}>
        <Text style={isCompliant ? styles.compliantTitle : styles.attentionTitle}>
          {isCompliant ? compliantMessage.title : 'Attention needed'}
        </Text>
        <Text style={isCompliant ? styles.compliantText : styles.attentionText}>
          {isCompliant
            ? compliantMessage.body
            : 'Your latest collection was marked as not properly segregated. Please segregate before the next collection.'}
        </Text>
      </View>

      <View style={styles.sectionCard}>
        <SectionHeader title="Notifications" actionLabel="View all" onAction={() => router.push('/household/notifications')} />
        {latestNotification ? (
          <View style={styles.notificationItem}>
            <Text style={styles.notificationTitle}>{latestNotification.title}</Text>
            <Text style={styles.notificationBody}>{latestNotification.message}</Text>
          </View>
        ) : (
          <View style={styles.emptyItem}>
            <Text style={styles.emptyText}>No notifications yet. You will be alerted when new announcements or collection reminders are posted.</Text>
          </View>
        )}
      </View>

      <View style={styles.sectionCard}>
        <SectionHeader title="Collection History" actionLabel="View all" onAction={() => router.push('/household/history')} />
        {latestCollection ? (
          <View style={styles.historyRow}>
            <View>
              <Text style={styles.historyDate}>
                {new Date(latestCollection.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
              <Text style={styles.historyMeta}>
                {latestCollection.segregationStatus === 'segregated' ? 'Segregated' : 'Not segregated'} · {latestCollection.wasteType === 'mixed' ? 'Mixed' : latestCollection.wasteType}
              </Text>
            </View>
            <View style={styles.historyBadge}>
              <Text style={styles.badgeText}>{String(latestCollection.weightKg)} kg</Text>
            </View>
          </View>
        ) : (
          <View style={styles.emptyItem}>
            <Text style={styles.emptyText}>No waste collection records recorded yet.</Text>
          </View>
        )}
      </View>

      <AppButton title="View your QR code" onPress={() => router.push('/household/qr')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  profileCard: {
    backgroundColor: '#E8F7E9',
    borderRadius: 24,
    padding: Spacing.four,
    flexDirection: 'row',
    gap: Spacing.four,
    alignItems: 'center',
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1F7A37',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F7A37',
  },
  profileSubtitle: {
    marginTop: 4,
    color: '#4A4A4A',
  },
  profileMeta: {
    marginTop: 8,
    color: '#3D6E3F',
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: Spacing.four,
    gap: Spacing.three,
    boxShadow: '0px 8px 12px rgba(0,0,0,0.05)',
    elevation: 3,
  },
  compliantBanner: {
    backgroundColor: '#E8F7E9',
    borderWidth: 1,
    borderColor: '#BBE5C3',
    borderRadius: 24,
    padding: Spacing.four,
    gap: 4,
  },
  compliantTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F7A37',
  },
  compliantText: {
    fontSize: 15,
    color: '#2E6B34',
    lineHeight: 22,
  },
  attentionBanner: {
    backgroundColor: '#FEF6E7',
    borderWidth: 1,
    borderColor: '#F5D9A8',
    borderRadius: 24,
    padding: Spacing.four,
    gap: 4,
  },
  attentionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#9A5C1B',
  },
  attentionText: {
    fontSize: 15,
    color: '#7A4A15',
    lineHeight: 22,
  },
  notificationItem: {
    marginTop: Spacing.two,
    borderRadius: 18,
    backgroundColor: '#F2F8F2',
    padding: Spacing.three,
  },
  notificationTitle: {
    fontWeight: '700',
    color: '#1F7A37',
    marginBottom: 6,
  },
  notificationBody: {
    color: '#4A4A4A',
    lineHeight: 20,
  },
  historyRow: {
    marginTop: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyDate: {
    fontWeight: '700',
    color: '#1F7A37',
  },
  historyMeta: {
    color: '#4A4A4A',
  },
  historyBadge: {
    backgroundColor: '#E8F7E9',
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  badgeText: {
    color: '#1F7A37',
    fontWeight: '700',
  },
  emptyItem: {
    backgroundColor: '#F9FAF9',
    borderRadius: 16,
    padding: Spacing.three,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 13,
    lineHeight: 18,
  },
});
