import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NotificationCard } from '@/components/notification-card';
import { Spacing } from '@/constants/theme';
import { householdApi, NotificationItem } from '@/lib/api';
import { safeBack } from '@/lib/navigation';

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
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
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
          <View style={styles.list}>
            {notifications.map((item) => (
              <NotificationCard key={item.id} item={item} onMarkRead={handleMarkRead} />
            ))}
          </View>
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
    paddingVertical: Spacing.two,
    paddingHorizontal: 0,
  },
  content: {
    width: '100%',
    gap: Spacing.three,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1F7A37',
  },
  subtitle: {
    color: '#555',
    fontSize: 14,
    marginBottom: Spacing.one,
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
  list: {
    width: '100%',
    gap: Spacing.three,
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
