import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { CollectionHistoryItem, householdApi, NotificationItem } from '@/lib/api';

export default function HouseholdHomeScreen() {
  const router = useRouter();
  const { householdUser, refreshHouseholdProfile } = useAuth();
  const [latestHistory, setLatestHistory] = useState<CollectionHistoryItem | null>(null);
  const [latestNotification, setLatestNotification] = useState<NotificationItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        await refreshHouseholdProfile();
        const [histories, notifications] = await Promise.all([
          householdApi.history().catch(() => []),
          householdApi.notifications().catch(() => []),
        ]);
        if (isMounted) {
          if (Array.isArray(histories) && histories.length > 0) {
            setLatestHistory(histories[0]);
          }
          if (Array.isArray(notifications) && notifications.length > 0) {
            setLatestNotification(notifications[0]);
          }
        }
      } catch {
        // ignore
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => { isMounted = false; };
  }, []);

  const displayName = householdUser?.fullName || 'Household Member';
  const displayInitial = (displayName.trim().charAt(0) || 'H').toUpperCase();
  const displaySubtitle = [householdUser?.purok, householdUser?.address].filter(Boolean).join(' • ') || 'Community Resident';
  const displayId = householdUser?.householdId || 'Pending';

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

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <Pressable onPress={() => router.push('/household/notifications' as any)}>
            <Text style={styles.linkText}>View All</Text>
          </Pressable>
        </View>
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
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Collection History</Text>
          <Pressable onPress={() => router.push('/household/history' as any)}>
            <Text style={styles.linkText}>View All</Text>
          </Pressable>
        </View>
        {latestHistory ? (
          <View style={styles.historyRow}>
            <View>
              <Text style={styles.historyDate}>
                {new Date(latestHistory.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
              <Text style={styles.historyMeta}>
                {latestHistory.segregationStatus === 'segregated' ? 'Segregated' : 'Not segregated'} · {latestHistory.wasteType}
              </Text>
            </View>
            <View style={styles.historyBadge}>
              <Text style={styles.badgeText}>{String(latestHistory.weightKg)} kg</Text>
            </View>
          </View>
        ) : (
          <View style={styles.emptyItem}>
            <Text style={styles.emptyText}>No waste collection records recorded yet.</Text>
          </View>
        )}
      </View>

      <Pressable style={styles.qrButton} onPress={() => router.push('/household/qr' as any)}>
        <Text style={styles.qrButtonText}>VIEW YOUR QR CODE</Text>
      </Pressable>

      <Pressable style={styles.logoutButton} onPress={() => router.push('/household/logout' as any)}>
        <Text style={styles.logoutButtonText}>ACCOUNT & LOGOUT</Text>
      </Pressable>
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
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F7A37',
  },
  linkText: {
    color: '#1F7A37',
    fontWeight: '700',
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
  qrButton: {
    marginTop: Spacing.one,
    backgroundColor: '#1F7A37',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
  },
  qrButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  logoutButton: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1F7A37',
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  logoutButtonText: {
    color: '#1F7A37',
    fontWeight: '700',
    letterSpacing: 0.5,
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
