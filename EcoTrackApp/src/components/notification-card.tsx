import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NotificationItem } from '@/lib/api';

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  const datePart = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const timePart = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${datePart} • ${timePart}`;
}

type NotificationCardProps = {
  item: NotificationItem;
  onMarkRead?: (id: string) => void;
};

export function NotificationCard({ item, onMarkRead }: NotificationCardProps) {
  const isWarning = (item.level ?? '').toLowerCase().includes('warning');

  return (
    <View style={[styles.card, !item.read ? styles.cardUnread : styles.cardRead]}>
      <View style={styles.headerRow}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        {!item.read ? <View style={styles.unreadDot} /> : null}
      </View>

      {item.senderName || item.senderRole ? (
        <Text style={styles.sender}>
          {[item.senderName, item.senderRole].filter(Boolean).join(' • ')}
        </Text>
      ) : null}

      <Text style={styles.message}>{item.message}</Text>

      <View style={styles.footerRow}>
        <View style={isWarning ? styles.badgeWarning : styles.badgeSecondary}>
          <Text style={isWarning ? styles.badgeTextWarning : styles.badgeTextSecondary} numberOfLines={1}>
            {item.level || 'Announcement'}
          </Text>
        </View>
        <Text style={styles.timestamp} numberOfLines={1}>
          {formatDateTime(item.createdAt)}
        </Text>
      </View>

      {!item.read && onMarkRead ? (
        <View style={styles.actionRow}>
          <Pressable
            style={styles.markReadButton}
            onPress={() => onMarkRead(item.id)}
            accessibilityRole="button"
            accessibilityLabel="Mark as read"
          >
            <Text style={styles.markReadText}>Mark as read</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: '#F6F9F6',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    overflow: 'hidden',
    gap: 8,
  },
  cardUnread: {
    borderColor: '#1F7A37',
    borderWidth: 1.5,
    backgroundColor: '#F4F9F4',
  },
  cardRead: {
    borderColor: '#E5E7EB',
    borderWidth: 1,
    backgroundColor: '#F9FAFB',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    fontWeight: '700',
    color: '#1F7A37',
    fontSize: 16,
    flex: 1,
    flexShrink: 1,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#DC2626',
    flexShrink: 0,
  },
  sender: {
    color: '#6B7280',
    fontSize: 13,
    flexShrink: 1,
  },
  message: {
    color: '#4A4A4A',
    fontSize: 15,
    lineHeight: 22,
    flexShrink: 1,
  },
  footerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
  },
  badgeWarning: {
    backgroundColor: '#FDEBD8',
    alignSelf: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
    flexShrink: 1,
  },
  badgeSecondary: {
    backgroundColor: '#E1F7DF',
    alignSelf: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
    flexShrink: 1,
  },
  badgeTextWarning: {
    color: '#9A5C1B',
    fontWeight: '700',
    fontSize: 12,
  },
  badgeTextSecondary: {
    color: '#1F7A37',
    fontWeight: '700',
    fontSize: 12,
  },
  timestamp: {
    color: '#6B7280',
    fontSize: 12,
    flexShrink: 0,
    textAlign: 'left',
  },
  actionRow: {
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  markReadButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#1F7A37',
  },
  markReadText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
