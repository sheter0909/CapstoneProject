'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi, ApiError, type AdminNotification, type NotificationRecipientType } from '../../lib/api';

interface RecipientOption {
  id: string;
  label: string;
}

const RECIPIENT_TYPES: { value: NotificationRecipientType; label: string }[] = [
  { value: 'household', label: 'One Household' },
  { value: 'collector', label: 'One Garbage Collector' },
  { value: 'all-households', label: 'All Households' },
  { value: 'all-collectors', label: 'All Garbage Collectors (General Purok)' },
];

function threadKey(note: AdminNotification): string {
  if (note.recipientType === 'all-households' || note.recipientType === 'all-collectors') {
    return `broadcast-${note.id}`;
  }
  const target = note.householdId ?? note.collectorId ?? note.id;
  return [note.senderId, target].sort().join('|');
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  const datePart = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const timePart = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${datePart} • ${timePart}`;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedThread, setSelectedThread] = useState<string | null>(null);

  const [recipientType, setRecipientType] = useState<NotificationRecipientType>('household');
  const [targetId, setTargetId] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [level, setLevel] = useState('General');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sendSuccess, setSendSuccess] = useState('');

  const [householdOptions, setHouseholdOptions] = useState<RecipientOption[]>([]);
  const [collectorOptions, setCollectorOptions] = useState<RecipientOption[]>([]);

  const fetchNotifications = async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const params = `?limit=100${roleFilter !== 'all' ? `&role=${encodeURIComponent(roleFilter)}` : ''}${search.trim() ? `&search=${encodeURIComponent(search.trim())}` : ''}`;
      const result = await adminApi.notifications(params);
      setNotifications(result.items ?? []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load notifications.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const authToken = localStorage.getItem('authToken');
    const userStr = localStorage.getItem('adminUser');
    if (!authToken || !userStr) {
      router.push('/login');
      return;
    }
    void fetchNotifications();
    void adminApi.households('?limit=200').then((result: unknown) => {
      const items = (result as { items?: { householdId: string; fullName: string }[] }).items ?? [];
      setHouseholdOptions(items.map((account) => ({ id: account.householdId, label: `${account.householdId} — ${account.fullName}` })));
    }).catch(() => undefined);
    void adminApi.collectors('?limit=200').then((result: unknown) => {
      const items = (result as { items?: { collectorId: string; fullName: string }[] }).items ?? [];
      setCollectorOptions(items.map((account) => ({ id: account.collectorId, label: `${account.collectorId} — ${account.fullName}` })));
    }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const threads = useMemo(() => {
    const grouped = new Map<string, AdminNotification[]>();
    for (const note of notifications) {
      const key = threadKey(note);
      const list = grouped.get(key) ?? [];
      list.push(note);
      grouped.set(key, list);
    }
    return [...grouped.entries()]
      .map(([key, list]) => ({
        key,
        messages: [...list].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
      }))
      .sort((a, b) => new Date(b.messages[b.messages.length - 1].createdAt).getTime() - new Date(a.messages[a.messages.length - 1].createdAt).getTime());
  }, [notifications]);

  const activeThread = threads.find((thread) => thread.key === selectedThread) ?? null;
  const unreadCount = notifications.filter((note) => !note.read).length;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendError('');
    setSendSuccess('');
    if (!title.trim() || !message.trim()) {
      setSendError('Title and message are required.');
      return;
    }
    if ((recipientType === 'household' || recipientType === 'collector') && !targetId.trim()) {
      setSendError(`Please enter the target ${recipientType === 'household' ? 'Household ID' : 'Collector ID'}.`);
      return;
    }
    setIsSending(true);
    try {
      await adminApi.sendNotification({
        title: title.trim(),
        message: message.trim(),
        recipientType,
        householdId: recipientType === 'household' ? targetId.trim() : undefined,
        collectorId: recipientType === 'collector' ? targetId.trim() : undefined,
        level: level.trim() || 'General',
      });
      setTitle('');
      setMessage('');
      setTargetId('');
      setSendSuccess('Notification sent successfully.');
      void fetchNotifications();
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Unable to send notification.');
    } finally {
      setIsSending(false);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await adminApi.markNotificationRead(id);
      setNotifications((current) => current.map((note) => (note.id === id ? { ...note, read: true } : note)));
    } catch (error) {
      if (error instanceof ApiError) setLoadError(error.message);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 to-green-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">
            Notifications {unreadCount > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-red-500 px-3 py-1 text-sm font-semibold text-white">
                {unreadCount} unread
              </span>
            )}
          </h2>
          <p className="text-gray-600">Send announcements and messages to households and garbage collectors</p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
          {/* Compose */}
          <div className="rounded-[28px] border border-green-100 bg-white/90 p-6 shadow-[0_20px_60px_rgba(20,83,45,0.08)] lg:col-span-2">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Send Notification</h3>
            <form onSubmit={handleSend} className="space-y-4">
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1">Recipient type</label>
                <select
                  value={recipientType}
                  onChange={(e) => setRecipientType(e.target.value as NotificationRecipientType)}
                  className="w-full rounded-xl border border-green-200 bg-white px-3 py-2.5 text-base text-gray-800 outline-none focus:border-green-500"
                >
                  {RECIPIENT_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              {(recipientType === 'household' || recipientType === 'collector') && (
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-1">
                    {recipientType === 'household' ? 'Household ID' : 'Collector ID'}
                  </label>
                  <input
                    type="text"
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    list={recipientType === 'household' ? 'household-options' : 'collector-options'}
                    placeholder={recipientType === 'household' ? 'e.g. 202319' : 'e.g. GC-0003'}
                    className="w-full rounded-xl border border-green-200 bg-white px-3 py-2.5 text-base text-gray-800 outline-none focus:border-green-500"
                  />
                  <datalist id={recipientType === 'household' ? 'household-options' : 'collector-options'}>
                    {(recipientType === 'household' ? householdOptions : collectorOptions).map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </datalist>
                </div>
              )}

              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Collection schedule change"
                  maxLength={120}
                  className="w-full rounded-xl border border-green-200 bg-white px-3 py-2.5 text-base text-gray-800 outline-none focus:border-green-500"
                />
              </div>

              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1">Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write your announcement or message..."
                  rows={4}
                  maxLength={2000}
                  className="w-full rounded-xl border border-green-200 bg-white px-3 py-2.5 text-base text-gray-800 outline-none focus:border-green-500"
                />
              </div>

              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1">Level</label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className="w-full rounded-xl border border-green-200 bg-white px-3 py-2.5 text-base text-gray-800 outline-none focus:border-green-500"
                >
                  <option>General</option>
                  <option>Reminder</option>
                  <option>Schedule</option>
                  <option>Warning</option>
                  <option>Announcement</option>
                </select>
              </div>

              {sendError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{sendError}</div>
              )}
              {sendSuccess && (
                <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">{sendSuccess}</div>
              )}

              <button
                type="submit"
                disabled={isSending}
                className="w-full rounded-2xl bg-green-600 px-4 py-3 text-base font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSending ? 'Sending...' : 'Send Notification'}
              </button>
            </form>
          </div>

          {/* Inbox / conversations */}
          <div className="rounded-[28px] border border-green-100 bg-white/90 p-6 shadow-[0_20px_60px_rgba(20,83,45,0.08)] lg:col-span-3">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <h3 className="text-xl font-bold text-gray-800">Conversations ({threads.length})</h3>
              <div className="flex gap-2 sm:ml-auto">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void fetchNotifications(); }}
                  placeholder="Search..."
                  className="rounded-xl border border-green-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-green-500"
                />
                <select
                  value={roleFilter}
                  onChange={(e) => { setRoleFilter(e.target.value); }}
                  className="rounded-xl border border-green-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-green-500"
                >
                  <option value="all">All senders</option>
                  <option value="admin">Admin</option>
                  <option value="collector">Collectors</option>
                  <option value="household">Households</option>
                </select>
                <button
                  onClick={() => void fetchNotifications()}
                  className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
                >
                  Filter
                </button>
              </div>
            </div>

            {isLoading ? (
              <p className="py-8 text-center text-base text-gray-500">Loading notifications...</p>
            ) : loadError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{loadError}</div>
            ) : threads.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-base font-semibold text-gray-700">No conversations yet.</p>
                <p className="mt-1 text-sm text-gray-500">Send the first notification using the compose form.</p>
              </div>
            ) : !activeThread ? (
              <ul className="max-h-[480px] space-y-2 overflow-auto">
                {threads.map((thread) => {
                  const last = thread.messages[thread.messages.length - 1];
                  const unread = thread.messages.some((msg) => !msg.read);
                  return (
                    <li key={thread.key}>
                      <button
                        onClick={() => setSelectedThread(thread.key)}
                        className="w-full rounded-2xl border border-gray-100 bg-white px-4 py-3 text-left transition hover:border-green-200 hover:bg-green-50/50"
                      >
                        <div className="flex items-center gap-2">
                          <p className="text-base font-semibold text-gray-800">{last.title}</p>
                          {unread && <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" aria-label="Unread" />}
                        </div>
                        <p className="mt-0.5 truncate text-sm text-gray-500">
                          {last.senderName} ({last.senderRole}) → {last.recipientType}
                          {last.householdId ? ` • ${last.householdId}` : ''}{last.collectorId ? ` • ${last.collectorId}` : ''}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-400">
                          {thread.messages.length} message{thread.messages.length === 1 ? '' : 's'} • {formatDateTime(last.createdAt)}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div>
                <button
                  onClick={() => setSelectedThread(null)}
                  className="mb-3 rounded-xl border border-green-200 px-3 py-1.5 text-sm font-semibold text-green-700 transition hover:bg-green-50"
                >
                  ← Back to conversations
                </button>
                <ul className="max-h-[420px] space-y-3 overflow-auto pr-1">
                  {activeThread.messages.map((msg) => {
                    const isAdmin = msg.senderRole === 'admin';
                    return (
                      <li key={msg.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${isAdmin ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                          <p className={`text-xs font-semibold ${isAdmin ? 'text-green-100' : 'text-gray-500'}`}>
                            {msg.senderName} • {msg.senderRole}
                          </p>
                          <p className="mt-1 text-base font-semibold">{msg.title}</p>
                          <p className="mt-0.5 text-base">{msg.message}</p>
                          <div className="mt-1.5 flex items-center gap-2">
                            <span className={`text-xs ${isAdmin ? 'text-green-100' : 'text-gray-400'}`}>{formatDateTime(msg.createdAt)}</span>
                            {!msg.read && (
                              <button
                                onClick={() => void handleMarkRead(msg.id)}
                                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${isAdmin ? 'bg-white text-green-700' : 'bg-green-600 text-white'}`}
                              >
                                Mark read
                              </button>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
