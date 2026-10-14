import { redirect } from 'next/navigation';

// Permanent redirect: /notifications → /messages
// Keeps old links working (household/collector app deep-links, bookmarks).
export default function NotificationsLegacyRedirect() {
  redirect('/messages');
}
