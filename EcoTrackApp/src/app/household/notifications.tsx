import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Spacing } from '@/constants/theme';
import { householdApi, NotificationItem } from '@/lib/api';
import { safeBack } from '@/lib/navigation';

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  const datePart = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const timePart = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${datePart} • ${timePart}`;
}

export default function HouseholdNotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    householdApi
      .notifications()
      .then((items) => {
        if (isMounted) setNotifications(Array.isArray(items) ? items : []);
      })
      .catch((err) => {
        if (isMounted) setError(err instanceof Error ? err.message : 'Unable to load notifications.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await householdApi.markNotificationRead(id);
      setNotifications((current) => current.map((item) => (item.id === id ? { ...item, read: true } : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to mark notification as read.');
    }
  };

  const unreadCount = notifications.filter((item) => !item.read).length;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>
          Notifications{unreadCount > 0 ? ` (${unreadCount} unread)` : ''}
        </Text>
        <Text style={styles.subtitle}>Important updates, reminders, and alerts regarding waste collection.</Text>

        {loading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator size="small" color="#1F7A37" />
            <Text style={styles.stateText}>Loading notifications...</Text>
          </View>
        ) : error ? (
          <View style={styles.stateBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>No notifications found.</Text>
          </View>
        ) : (
          notifications.map((item) => (
            <View key={item.id} style={[styles.notificationItem, !item.read && styles.notificationUnread]}>
              <View style={styles.notificationHeader}>
                <Text style={styles.notificationLabel}>{item.title}</Text>
                {!item.read ? <View style={styles.unreadDot} /> : null}
              </View>
              <Text style={styles.notificationSender}>
                {item.senderName} • {item.senderRole}
              </Text>
              <Text style={styles.notificationDescription}>{item.message}</Text>
              <View style={styles.notificationFooter}>
                <View style={(item.level ?? '').toLowerCase().includes('warning') ? styles.notificationBadge : styles.notificationBadgeSecondary}>
                  <Text style={(item.level ?? '').toLowerCase().includes('warning') ? styles.badgeText : styles.badgeTextSecondary}>
                    {item.level || 'Announcement'}
                  </Text>
                </View>
                <Text style={styles.dateText}>{formatDateTime(item.createdAt)}</Text>
              </View>
              {!item.read ? (
                <Pressable style={styles.markReadButton} onPress={() => void handleMarkRead(item.id)}>
                  <Text style={styles.markReadText}>Mark as read</Text>
                </Pressable>
              ) : null}
            </View>
          ))
        )}

        <Pressable style={styles.backButton} onPress={() => safeBack(router, '/household')}>
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
  successText: {
    color: '#1F7A37',
    fontWeight: '600',
    fontSize: 14,
  },
  notificationItem: {
    backgroundColor: '#F6F9F6',
    borderRadius: 18,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  notificationUnread: {
    borderWidth: 1,
    borderColor: '#1F7A37',
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notificationLabel: {
    fontWeight: '700',
    color: '#1F7A37',
    fontSize: 16,
    flex: 1,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#DC2626',
  },
  notificationSender: {
    color: '#6B7280',
    fontSize: 13,
  },
  notificationDescription: {
    color: '#4A4A4A',
    fontSize: 15,
    lineHeight: 22,
  },
  notificationFooter: {
    marginTop: Spacing.two,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  notificationBadge: {
    backgroundColor: '#FDEBD8',
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  badgeText: {
    color: '#9A5C1B',
    fontWeight: '700',
  },
  notificationBadgeSecondary: {
    backgroundColor: '#E1F7DF',
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  badgeTextSecondary: {
    color: '#1F7A37',
    fontWeight: '700',
  },
  markReadButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#1F7A37',
  },
  markReadText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
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
