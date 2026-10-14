'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { adminApi, ApiError, type AdminNotification, type NotificationRecipientType } from '../../lib/api';

// ─── Types ──────────────────────────────────────────────────────────────────

type MessageTab = 'inbox' | 'announcements' | 'flagged';

interface RecipientOption { id: string; label: string }

const RECIPIENT_TYPES: { value: NotificationRecipientType; label: string }[] = [
  { value: 'household', label: 'One Household' },
  { value: 'collector', label: 'One Garbage Collector' },
  { value: 'all-households', label: 'All Households' },
  { value: 'all-collectors', label: 'All Garbage Collectors' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isWarning(note: AdminNotification): boolean {
  const l = note.level.toLowerCase();
  return (
    l.includes('warning') ||
    l.startsWith('garbage not segregated') ||
    l.startsWith('first warning') ||
    l.startsWith('second warning') ||
    l.startsWith('final warning')
  );
}

function isAnnouncement(note: AdminNotification): boolean {
  // Admin-originated broadcast or targeted message from the admin portal
  return note.senderRole === 'admin';
}

function isInboxMessage(note: AdminNotification): boolean {
  // Everything sent by non-admin that isn't a warning-style system notification,
  // plus admin replies that are directed at a specific household/collector thread.
  return !isWarning(note) && !isAnnouncement(note);
}

function threadKey(note: AdminNotification): string {
  if (note.recipientType === 'all-households' || note.recipientType === 'all-collectors') {
    return `broadcast-${note.id}`;
  }
  const target = note.householdId ?? note.collectorId ?? note.id;
  return [note.senderId, target].sort().join('|');
}

function isReport(note: AdminNotification): boolean {
  return note.recipientType === 'admin' || note.level.toLowerCase().startsWith('report');
}

function concernLabel(note: AdminNotification): string {
  const match = note.level.match(/^report:\s*(.+)$/i);
  if (match) return match[1].trim();
  return note.level || 'Report';
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  const datePart = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const timePart = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${datePart} • ${timePart}`;
}

function warningBadgeColor(level: string): string {
  const l = level.toLowerCase();
  if (l.includes('final')) return 'bg-red-100 text-red-800';
  if (l.includes('second')) return 'bg-orange-100 text-orange-800';
  return 'bg-amber-100 text-amber-800';
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as MessageTab | null) ?? 'inbox';

  const [activeTab, setActiveTab] = useState<MessageTab>(initialTab);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Inbox state
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedThread, setSelectedThread] = useState<string | null>(null);

  // Compose state (Announcements tab)
  const [recipientType, setRecipientType] = useState<NotificationRecipientType>('household');
  const [targetId, setTargetId] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [level, setLevel] = useState('General');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sendSuccess, setSendSuccess] = useState('');
  const [showComposeForm, setShowComposeForm] = useState(false);

  // Recipient autocomplete
  const [householdOptions, setHouseholdOptions] = useState<RecipientOption[]>([]);
  const [collectorOptions, setCollectorOptions] = useState<RecipientOption[]>([]);

  // Flagged state
  const [flaggedHouseholdFilter, setFlaggedHouseholdFilter] = useState('');

  // Load notifications
  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const result = await adminApi.notifications('?limit=200');
      setNotifications(result.items ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load messages.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const authToken = localStorage.getItem('authToken');
    const userStr = localStorage.getItem('adminUser');
    if (!authToken || !userStr) { router.push('/login'); return; }
    try { JSON.parse(userStr); } catch { router.push('/login'); return; }

    void loadNotifications();
    void adminApi.households('?limit=200').then((result: unknown) => {
      const items = (result as { items?: { householdId: string; fullName: string }[] }).items ?? [];
      setHouseholdOptions(items.map((a) => ({ id: a.householdId, label: `${a.householdId} — ${a.fullName}` })));
    }).catch(() => undefined);
    void adminApi.collectors('?limit=200').then((result: unknown) => {
      const items = (result as { items?: { collectorId: string; fullName: string }[] }).items ?? [];
      setCollectorOptions(items.map((a) => ({ id: a.collectorId, label: `${a.collectorId} — ${a.fullName}` })));
    }).catch(() => undefined);
  }, [router, loadNotifications]);

  // Derived: unread count (total, for sidebar badge context)
  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  // ── Inbox ────────────────────────────────────────────────────────────────

  const inboxNotifications = useMemo(() => notifications.filter(isInboxMessage), [notifications]);

  const filteredInbox = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inboxNotifications.filter((note) => {
      const matchesRole = roleFilter === 'all' || note.senderRole === roleFilter;
      const matchesSearch = !q ||
        note.title.toLowerCase().includes(q) ||
        note.message.toLowerCase().includes(q) ||
        note.senderName.toLowerCase().includes(q) ||
        (note.householdId ?? '').toLowerCase().includes(q) ||
        (note.collectorId ?? '').toLowerCase().includes(q);
      return matchesRole && matchesSearch;
    });
  }, [inboxNotifications, search, roleFilter]);

  const inboxThreads = useMemo(() => {
    const grouped = new Map<string, AdminNotification[]>();
    for (const note of filteredInbox) {
      const key = threadKey(note);
      const list = grouped.get(key) ?? [];
      list.push(note);
      grouped.set(key, list);
    }
    return [...grouped.entries()]
      .map(([key, messages]) => ({
        key,
        messages: [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
      }))
      .sort((a, b) =>
        new Date(b.messages[b.messages.length - 1].createdAt).getTime() -
        new Date(a.messages[a.messages.length - 1].createdAt).getTime()
      );
  }, [filteredInbox]);

  const activeThread = useMemo(
    () => inboxThreads.find((t) => t.key === selectedThread) ?? null,
    [inboxThreads, selectedThread],
  );

  // ── Announcements ─────────────────────────────────────────────────────────

  const announcementHistory = useMemo(
    () =>
      notifications
        .filter(isAnnouncement)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [notifications],
  );

  // ── Flagged / Warnings ────────────────────────────────────────────────────

  const warnings = useMemo(() => notifications.filter(isWarning), [notifications]);

  const flaggedByHousehold = useMemo(() => {
    const grouped = new Map<string, AdminNotification[]>();
    for (const note of warnings) {
      const key = note.householdId ?? note.collectorId ?? 'unknown';
      const list = grouped.get(key) ?? [];
      list.push(note);
      grouped.set(key, list);
    }
    return [...grouped.entries()]
      .map(([id, notes]) => ({ id, notes: [...notes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) }))
      .sort((a, b) => b.notes.length - a.notes.length);
  }, [warnings]);

  const filteredFlagged = useMemo(() => {
    const q = flaggedHouseholdFilter.trim().toLowerCase();
    if (!q) return flaggedByHousehold;
    return flaggedByHousehold.filter((g) => g.id.toLowerCase().includes(q));
  }, [flaggedByHousehold, flaggedHouseholdFilter]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendError('');
    setSendSuccess('');
    if (!title.trim() || !message.trim()) { setSendError('Title and message are required.'); return; }
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
      setSendSuccess('Announcement sent successfully.');
      setShowComposeForm(false);
      void loadNotifications();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Unable to send announcement.');
    } finally {
      setIsSending(false);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await adminApi.markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch (err) {
      if (err instanceof ApiError) setLoadError(err.message);
    }
  };

  const switchTab = (tab: MessageTab) => {
    setActiveTab(tab);
    setSelectedThread(null);
  };

  // ── Render ───────────────────────────────────────────────────────────────

  const tabs: { id: MessageTab; label: string; count?: number }[] = [
    { id: 'inbox', label: 'Inbox', count: inboxThreads.filter((t) => t.messages.some((m) => !m.read)).length || undefined },
    { id: 'announcements', label: 'Announcements', count: announcementHistory.length || undefined },
    { id: 'flagged', label: 'Flagged', count: flaggedByHousehold.length || undefined },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 to-green-100">
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              Messages
              {unreadCount > 0 && (
                <span className="inline-flex items-center rounded-full bg-red-500 px-3 py-1 text-sm font-semibold text-white">
                  {unreadCount} unread
                </span>
              )}
            </h1>
            <p className="mt-1 text-gray-600">Send announcements and talk with households and garbage collectors.</p>
          </div>
          {/* Mobile: "New message" button opens compose form */}
          <button
            type="button"
            onClick={() => { switchTab('announcements'); setShowComposeForm(true); }}
            className="sm:hidden inline-flex items-center gap-2 rounded-2xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-green-700"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
            </svg>
            New message
          </button>
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────────── */}
        <div className="mb-6 flex gap-1 rounded-2xl border border-green-100 bg-white/80 p-1.5 shadow-sm">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? 'bg-green-600 text-white shadow'
                  : 'text-gray-600 hover:bg-green-50 hover:text-green-700'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold ${
                  activeTab === tab.id ? 'bg-white/25 text-white' : 'bg-green-100 text-green-700'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Load error ──────────────────────────────────────────────────── */}
        {loadError && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 flex items-center justify-between gap-3">
            <span>{loadError}</span>
            <button onClick={() => void loadNotifications()} className="shrink-0 rounded-xl bg-red-100 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-200 transition">Retry</button>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            INBOX TAB
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'inbox' && (
          <div className="rounded-[28px] border border-green-100 bg-white/90 p-6 shadow-[0_20px_60px_rgba(20,83,45,0.08)]">
            {/* Search + filter — auto-apply, no "Filter" button */}
            {!activeThread && (
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-bold text-gray-800">Conversations ({inboxThreads.length})</h2>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search messages…"
                    className="rounded-xl border border-green-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-green-500"
                    aria-label="Search messages"
                  />
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="rounded-xl border border-green-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-green-500"
                    aria-label="Filter by sender"
                  >
                    <option value="all">All senders</option>
                    <option value="household">Households</option>
                    <option value="collector">Collectors</option>
                  </select>
                </div>
              </div>
            )}

            {isLoading ? (
              <p className="py-8 text-center text-sm text-gray-500">Loading messages…</p>
            ) : activeThread ? (
              /* Thread view */
              <div>
                <button
                  onClick={() => setSelectedThread(null)}
                  className="mb-4 rounded-xl border border-green-200 px-3 py-1.5 text-sm font-semibold text-green-700 transition hover:bg-green-50"
                >
                  ← Back to conversations
                </button>
                <ul className="max-h-[480px] space-y-3 overflow-auto pr-1">
                  {activeThread.messages.map((msg) => {
                    const isAdmin = msg.senderRole === 'admin';
                    return (
                      <li key={msg.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${isAdmin ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                          <p className={`text-xs font-semibold ${isAdmin ? 'text-green-100' : 'text-gray-500'}`}>
                            {msg.senderName} · {msg.senderRole}
                          </p>
                          <p className="mt-1 text-sm font-semibold">{msg.title}</p>
                          {isReport(msg) && (
                            <span className={`mt-1 inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${isAdmin ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-800'}`}>
                              🚩 {concernLabel(msg)}
                            </span>
                          )}
                          <p className="mt-0.5 text-sm">{msg.message}</p>
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
            ) : inboxThreads.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-base font-semibold text-gray-700">No conversations yet.</p>
                <p className="mt-1 text-sm text-gray-500">Messages from households and collectors will appear here.</p>
              </div>
            ) : (
              /* Thread list */
              <ul className="max-h-[520px] space-y-2 overflow-auto">
                {inboxThreads.map((thread) => {
                  const last = thread.messages[thread.messages.length - 1];
                  const hasUnread = thread.messages.some((m) => !m.read);
                  return (
                    <li key={thread.key}>
                      <button
                        onClick={() => setSelectedThread(thread.key)}
                        className="w-full rounded-2xl border border-gray-100 bg-white px-4 py-3 text-left transition hover:border-green-200 hover:bg-green-50/50"
                      >
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-semibold text-gray-800 ${hasUnread ? 'font-bold' : ''}`}>{last.title}</p>
                          {isReport(last) && (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                              🚩 {concernLabel(last)}
                            </span>
                          )}
                          {hasUnread && <span className="ml-auto inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" aria-label="Unread" />}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-gray-500">
                          {last.senderName} ({last.senderRole}){last.householdId ? ` · ${last.householdId}` : ''}{last.collectorId ? ` · ${last.collectorId}` : ''}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-400">
                          {thread.messages.length} message{thread.messages.length === 1 ? '' : 's'} · {formatDateTime(last.createdAt)}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            ANNOUNCEMENTS TAB
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'announcements' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            {/* Compose panel — hidden on mobile behind "New message" button */}
            <div className={`rounded-[28px] border border-green-100 bg-white/90 p-6 shadow-[0_20px_60px_rgba(20,83,45,0.08)] lg:col-span-2 ${showComposeForm ? 'block' : 'hidden lg:block'}`}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">Send Announcement</h2>
                <button
                  type="button"
                  onClick={() => setShowComposeForm(false)}
                  className="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 lg:hidden"
                  aria-label="Close compose"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6 6 18" /></svg>
                </button>
              </div>
              <form onSubmit={handleSend} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">Recipient type</label>
                  <select
                    value={recipientType}
                    onChange={(e) => { setRecipientType(e.target.value as NotificationRecipientType); setTargetId(''); }}
                    className="w-full rounded-xl border border-green-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-green-500"
                  >
                    {RECIPIENT_TYPES.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {(recipientType === 'household' || recipientType === 'collector') && (
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-gray-700">
                      {recipientType === 'household' ? 'Household ID' : 'Collector ID'}
                    </label>
                    <input
                      type="text"
                      value={targetId}
                      onChange={(e) => setTargetId(e.target.value)}
                      list={recipientType === 'household' ? 'hh-opts' : 'col-opts'}
                      placeholder={recipientType === 'household' ? 'e.g. 202319' : 'e.g. GC-0003'}
                      className="w-full rounded-xl border border-green-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-green-500"
                    />
                    <datalist id={recipientType === 'household' ? 'hh-opts' : 'col-opts'}>
                      {(recipientType === 'household' ? householdOptions : collectorOptions).map((opt) => (
                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                      ))}
                    </datalist>
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Collection schedule change"
                    maxLength={120}
                    className="w-full rounded-xl border border-green-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-green-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">Message</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Write your announcement…"
                    rows={4}
                    maxLength={2000}
                    className="w-full rounded-xl border border-green-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-green-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">Level</label>
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    className="w-full rounded-xl border border-green-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-green-500"
                  >
                    <option>General</option>
                    <option>Reminder</option>
                    <option>Schedule</option>
                    <option>Warning</option>
                    <option>Announcement</option>
                  </select>
                </div>

                {sendError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{sendError}</div>
                )}
                {sendSuccess && (
                  <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">{sendSuccess}</div>
                )}

                <button
                  type="submit"
                  disabled={isSending}
                  className="w-full rounded-2xl bg-green-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSending ? 'Sending…' : 'Send Announcement'}
                </button>
              </form>
            </div>

            {/* Announcement history */}
            <div className={`rounded-[28px] border border-green-100 bg-white/90 p-6 shadow-[0_20px_60px_rgba(20,83,45,0.08)] lg:col-span-3 ${showComposeForm ? 'hidden lg:block' : 'block'}`}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">Sent Announcements ({announcementHistory.length})</h2>
                {/* Mobile: toggle compose */}
                <button
                  type="button"
                  onClick={() => setShowComposeForm(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-green-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-green-700 lg:hidden"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" /></svg>
                  New
                </button>
              </div>

              {isLoading ? (
                <p className="py-8 text-center text-sm text-gray-500">Loading…</p>
              ) : announcementHistory.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm font-semibold text-gray-700">No announcements sent yet.</p>
                  <p className="mt-1 text-xs text-gray-500">Use the form to send your first announcement.</p>
                </div>
              ) : (
                <ul className="max-h-[520px] space-y-2 overflow-auto">
                  {announcementHistory.map((note) => (
                    <li key={note.id} className="rounded-2xl border border-gray-100 bg-white px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-800">{note.title}</p>
                        <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">{note.level}</span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500 line-clamp-2">{note.message}</p>
                      <p className="mt-1.5 text-xs text-gray-400">
                        To: {note.recipientType}{note.householdId ? ` · ${note.householdId}` : ''}{note.collectorId ? ` · ${note.collectorId}` : ''} · {formatDateTime(note.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            FLAGGED TAB
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'flagged' && (
          <div className="rounded-[28px] border border-green-100 bg-white/90 p-6 shadow-[0_20px_60px_rgba(20,83,45,0.08)]">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-bold text-gray-800">
                Flagged — Collector Warnings ({flaggedByHousehold.length} household{flaggedByHousehold.length === 1 ? '' : 's'})
              </h2>
              <input
                type="text"
                value={flaggedHouseholdFilter}
                onChange={(e) => setFlaggedHouseholdFilter(e.target.value)}
                placeholder="Filter by household ID…"
                className="rounded-xl border border-green-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-green-500 sm:w-56"
                aria-label="Filter flagged by household"
              />
            </div>

            {isLoading ? (
              <p className="py-8 text-center text-sm text-gray-500">Loading…</p>
            ) : filteredFlagged.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm font-semibold text-gray-700">No warnings found.</p>
                <p className="mt-1 text-xs text-gray-500">Collector warning notifications will appear here grouped by household.</p>
              </div>
            ) : (
              <div className="max-h-[600px] space-y-4 overflow-auto">
                {filteredFlagged.map(({ id, notes }) => (
                  <div key={id} className="rounded-2xl border border-amber-100 bg-amber-50/60 px-4 py-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-gray-800">Household: {id}</p>
                        <p className="text-xs text-gray-500">{notes.length} warning{notes.length === 1 ? '' : 's'}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${notes.length >= 3 ? 'bg-red-100 text-red-800' : notes.length === 2 ? 'bg-orange-100 text-orange-800' : 'bg-amber-100 text-amber-800'}`}>
                        {notes.length >= 3 ? 'Final Warning' : notes.length === 2 ? '2nd Warning' : '1st Warning'}
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {notes.map((note) => (
                        <li key={note.id} className="rounded-xl border border-amber-200 bg-white px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${warningBadgeColor(note.level)}`}>
                              {note.level}
                            </span>
                            <p className="text-xs font-semibold text-gray-800 truncate">{note.title}</p>
                          </div>
                          <p className="mt-1 text-xs text-gray-500 line-clamp-2">{note.message}</p>
                          <p className="mt-1 text-xs text-gray-400">
                            By {note.senderName} · {formatDateTime(note.createdAt)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
