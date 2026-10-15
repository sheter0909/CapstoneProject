'use client';

import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { adminApi, ApiError, type AdminNotification, type NotificationRecipientType, type Purok, type RecipientOption, type SkipDetail, type SkipEscalation } from '../../lib/api';

// ─── Types ──────────────────────────────────────────────────────────────────

type MessageTab = 'inbox' | 'announcements' | 'flagged' | 'reports' | 'repeated-skips';

const RECIPIENT_TYPES: { value: NotificationRecipientType; label: string }[] = [
  { value: 'household', label: 'One Household' },
  { value: 'collector', label: 'One Garbage Collector' },
  { value: 'all-households', label: 'All Households' },
  { value: 'all-collectors', label: 'All Garbage Collectors' },
  { value: 'purok-households', label: 'One Purok / Area' },
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

// Collector-to-household reports live in the Reports tab (not the Inbox),
// so nothing appears twice. Matches the server-side ?kind=report filter.
function isCollectorHouseholdReport(note: AdminNotification): boolean {
  return (
    note.senderRole === 'collector' &&
    note.recipientType === 'household' &&
    (note.reportReason != null || note.level.toLowerCase().startsWith('report'))
  );
}

const REPORT_REASON_LABELS: Record<string, string> = {
  no_garbage_out: 'Skip',
  dirty_surroundings: 'Dirty surroundings',
  other: 'Other',
};

function reportReasonLabel(note: AdminNotification): string {
  if (note.reportReason && REPORT_REASON_LABELS[note.reportReason]) return REPORT_REASON_LABELS[note.reportReason];
  return concernLabel(note);
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

function getRecipientDisplay(note: AdminNotification): string {
  if (note.recipientType === 'household') {
    return `To: household - ${note.householdId ?? 'unknown'}`;
  }
  if (note.recipientType === 'collector') {
    return `To: collector - ${note.collectorId ?? 'unknown'}`;
  }
  if (note.recipientType === 'purok-households') {
    return `To: purok - ${note.targetPurok ?? 'unknown'}`;
  }
  if (note.recipientType === 'all-households') {
    return 'To: all-households';
  }
  if (note.recipientType === 'all-collectors') {
    return 'To: all-collectors';
  }
  return `To: ${note.recipientType}`;
}

function warningBadgeColor(level: string): string {
  const l = level.toLowerCase();
  if (l.includes('final')) return 'bg-red-100 text-red-800';
  if (l.includes('second')) return 'bg-orange-100 text-orange-800';
  return 'bg-amber-100 text-amber-800';
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function MessagesContent() {
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

  // "Send warning" deep-link (?to=<householdId>): pre-fill the message form.
  useEffect(() => {
    const to = searchParams.get('to')?.trim();
    if (to) {
      setRecipientType('household');
      setTargetId(to);
      setActiveTab('announcements');
      setShowComposeForm(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recipient autocomplete
  const [householdOptions, setHouseholdOptions] = useState<RecipientOption[]>([]);
  const [collectorOptions, setCollectorOptions] = useState<RecipientOption[]>([]);
  const [householdOptionsError, setHouseholdOptionsError] = useState('');
  const [collectorOptionsError, setCollectorOptionsError] = useState('');
  const [purokError, setPurokError] = useState('');

  // Purok picker state
  const [puroks, setPuroks] = useState<Purok[]>([]);
  const [selectedPurok, setSelectedPurok] = useState<Purok | null>(null);
  const [purokSearch, setPurokSearch] = useState('');
  const [purokDropdownOpen, setPurokDropdownOpen] = useState(false);
  const [purokHouseholdCount, setPurokHouseholdCount] = useState<number | null>(null);
  const purokInputRef = useRef<HTMLInputElement>(null);
  const purokDropdownRef = useRef<HTMLDivElement>(null);

  // Flagged state
  const [flaggedHouseholdFilter, setFlaggedHouseholdFilter] = useState('');

  // Reports state (server-side ?kind=report filter with real pagination)
  const [reports, setReports] = useState<AdminNotification[]>([]);
  const [reportsPage, setReportsPage] = useState(1);
  const [reportsTotalPages, setReportsTotalPages] = useState(1);
  const [reportsTotal, setReportsTotal] = useState(0);
  const [reportReasonFilter, setReportReasonFilter] = useState('');
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState('');

  const loadReports = useCallback(async (page: number, reason: string) => {
    setReportsLoading(true);
    setReportsError('');
    try {
      const params = new URLSearchParams({ kind: 'report', page: String(page), limit: '20' });
      if (reason) params.set('reason', reason);
      const result = await adminApi.notifications(`?${params.toString()}`);
      setReports(result.items ?? []);
      setReportsTotalPages(result.totalPages ?? 1);
      setReportsTotal(result.total ?? 0);
    } catch (err) {
      setReportsError(err instanceof Error ? err.message : 'Unable to load reports.');
    } finally {
      setReportsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'reports') void loadReports(reportsPage, reportReasonFilter);
  }, [activeTab, reportsPage, reportReasonFilter, loadReports]);

  // Repeated-skips escalation state (server-fed, read-only except actions)
  const [escalations, setEscalations] = useState<SkipEscalation[]>([]);
  const [escPage, setEscPage] = useState(1);
  const [escTotalPages, setEscTotalPages] = useState(1);
  const [escTotal, setEscTotal] = useState(0);
  const [escStatus, setEscStatus] = useState('open');
  const [escLoading, setEscLoading] = useState(false);
  const [escError, setEscError] = useState('');
  const [escDetail, setEscDetail] = useState<Record<string, { liveStreak: number; skips: SkipDetail[] }>>({});
  const [escActionError, setEscActionError] = useState('');
  const [escNote, setEscNote] = useState<Record<string, string>>({});

  const loadEscalations = useCallback(async (page: number, status: string) => {
    setEscLoading(true);
    setEscError('');
    try {
      const result = await adminApi.escalations(`?status=${encodeURIComponent(status)}&page=${page}&limit=20`);
      setEscalations(result.items ?? []);
      setEscTotalPages(result.totalPages ?? 1);
      setEscTotal(result.total ?? 0);
    } catch (err) {
      setEscError(err instanceof Error ? err.message : 'Unable to load escalations.');
    } finally {
      setEscLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'repeated-skips') void loadEscalations(escPage, escStatus);
  }, [activeTab, escPage, escStatus, loadEscalations]);

  const toggleEscDetail = async (id: string) => {
    if (escDetail[id]) {
      setEscDetail((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }
    try {
      const detail = await adminApi.escalationDetail(id);
      setEscDetail((prev) => ({ ...prev, [id]: { liveStreak: detail.liveStreak, skips: detail.skips ?? [] } }));
    } catch (err) {
      setEscActionError(err instanceof Error ? err.message : 'Unable to load escalation details.');
    }
  };

  const handleResolveEsc = async (id: string) => {
    setEscActionError('');
    try {
      await adminApi.resolveEscalation(id, escNote[id] ?? '');
      setEscNote((prev) => ({ ...prev, [id]: '' }));
      await loadEscalations(escPage, escStatus);
    } catch (err) {
      setEscActionError(err instanceof Error ? err.message : 'Unable to resolve escalation.');
    }
  };

  const handleDismissEsc = async (id: string) => {
    const reason = (escNote[id] ?? '').trim();
    if (!reason) {
      setEscActionError('A dismiss reason is required.');
      return;
    }
    setEscActionError('');
    try {
      await adminApi.dismissEscalation(id, reason);
      setEscNote((prev) => ({ ...prev, [id]: '' }));
      await loadEscalations(escPage, escStatus);
    } catch (err) {
      setEscActionError(err instanceof Error ? err.message : 'Unable to dismiss escalation.');
    }
  };

  // Announcement search & edit state
  const [announcementSearch, setAnnouncementSearch] = useState('');
  const [debouncedAnnouncementSearch, setDebouncedAnnouncementSearch] = useState('');
  const [editingAnnouncement, setEditingAnnouncement] = useState<AdminNotification | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [editLevel, setEditLevel] = useState('General');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccessToast, setEditSuccessToast] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedAnnouncementSearch(announcementSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [announcementSearch]);

  // Load notifications with backend-compliant pagination (max 100 per page)
  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const page1 = await adminApi.notifications('?limit=100&page=1');
      let items = page1.items ?? [];
      if (page1.totalPages && page1.totalPages > 1) {
        try {
          const page2 = await adminApi.notifications('?limit=100&page=2');
          if (page2.items) items = items.concat(page2.items);
        } catch {
          // Soft failure for extra pages: keep first page
        }
      }
      setNotifications(items);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load messages.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadHouseholdOptions = useCallback(async () => {
    setHouseholdOptionsError('');
    try {
      const options = await adminApi.householdOptions();
      setHouseholdOptions(options);
    } catch (err) {
      setHouseholdOptionsError(err instanceof Error ? err.message : 'Unable to load households list.');
    }
  }, []);

  const loadCollectorOptions = useCallback(async () => {
    setCollectorOptionsError('');
    try {
      const options = await adminApi.collectorOptions();
      setCollectorOptions(options);
    } catch (err) {
      setCollectorOptionsError(err instanceof Error ? err.message : 'Unable to load collectors list.');
    }
  }, []);

  const loadPuroks = useCallback(async () => {
    setPurokError('');
    try {
      const data = await adminApi.puroks();
      setPuroks(data);
    } catch (err) {
      setPurokError(err instanceof Error ? err.message : 'Unable to load puroks.');
    }
  }, []);

  const loadAllData = useCallback(async () => {
    await Promise.allSettled([
      loadNotifications(),
      loadHouseholdOptions(),
      loadCollectorOptions(),
      loadPuroks(),
    ]);
  }, [loadNotifications, loadHouseholdOptions, loadCollectorOptions, loadPuroks]);

  useEffect(() => {
    const authToken = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    const userStr = typeof window !== 'undefined' ? localStorage.getItem('adminUser') : null;
    if (!authToken || !userStr) { router.push('/login'); return; }
    try { JSON.parse(userStr); } catch { router.push('/login'); return; }

    void loadAllData();
  }, [router, loadAllData]);

  // Fetch household count when a purok is selected
  useEffect(() => {
    if (!selectedPurok) { setPurokHouseholdCount(null); return; }
    void adminApi.purokHouseholdCount(selectedPurok.id).then((data) => {
      setPurokHouseholdCount(data.activeHouseholds);
    }).catch(() => setPurokHouseholdCount(null));
  }, [selectedPurok]);

  // Close purok dropdown on outside click
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (
        purokDropdownRef.current && !purokDropdownRef.current.contains(e.target as Node) &&
        purokInputRef.current && !purokInputRef.current.contains(e.target as Node)
      ) {
        setPurokDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Derived: unread count (total, for sidebar badge context)
  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  // ── Inbox ────────────────────────────────────────────────────────────────

  const inboxNotifications = useMemo(
    () => notifications.filter((n) => isInboxMessage(n) && !isCollectorHouseholdReport(n)),
    [notifications]
  );

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

  const filteredAnnouncements = useMemo(() => {
    const q = debouncedAnnouncementSearch.trim().toLowerCase();
    if (!q) return announcementHistory;
    return announcementHistory.filter((note) => {
      const titleMatch = note.title.toLowerCase().includes(q);
      const messageMatch = note.message.toLowerCase().includes(q);
      const levelMatch = note.level.toLowerCase().includes(q);
      const recipientTypeMatch = note.recipientType.toLowerCase().includes(q);
      const hhMatch = (note.householdId ?? '').toLowerCase().includes(q);
      const colMatch = (note.collectorId ?? '').toLowerCase().includes(q);
      const purokMatch = (note.targetPurok ?? '').toLowerCase().includes(q);
      const recipientLabelMatch = getRecipientDisplay(note).toLowerCase().includes(q);

      return (
        titleMatch ||
        messageMatch ||
        levelMatch ||
        recipientTypeMatch ||
        hhMatch ||
        colMatch ||
        purokMatch ||
        recipientLabelMatch
      );
    });
  }, [announcementHistory, debouncedAnnouncementSearch]);

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
    if (recipientType === 'purok-households' && !selectedPurok) {
      setSendError('Please select a purok / area from the list.');
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
        targetPurokId: recipientType === 'purok-households' ? selectedPurok?.id : undefined,
        level: level.trim() || 'General',
      });
      setTitle('');
      setMessage('');
      setTargetId('');
      setSelectedPurok(null);
      setPurokSearch('');
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

  const handleOpenEdit = (note: AdminNotification) => {
    setEditingAnnouncement(note);
    setEditTitle(note.title);
    setEditMessage(note.message);
    setEditLevel(note.level || 'General');
    setEditError('');
  };

  const handleCloseEdit = () => {
    if (isSavingEdit) return;
    setEditingAnnouncement(null);
    setEditError('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAnnouncement) return;

    const trimmedTitle = editTitle.trim();
    const trimmedMessage = editMessage.trim();

    if (!trimmedTitle) {
      setEditError('Title is required.');
      return;
    }
    if (trimmedTitle.length > 120) {
      setEditError('Title must be at most 120 characters.');
      return;
    }
    if (!trimmedMessage) {
      setEditError('Message is required.');
      return;
    }
    if (trimmedMessage.length > 2000) {
      setEditError('Message must be at most 2000 characters.');
      return;
    }

    setIsSavingEdit(true);
    setEditError('');
    try {
      const updated = await adminApi.updateAnnouncement(editingAnnouncement.id, {
        title: trimmedTitle,
        message: trimmedMessage,
        level: editLevel.trim() || 'General',
      });

      setNotifications((prev) =>
        prev.map((n) => (n.id === updated.id ? { ...n, ...updated } : n))
      );
      setEditingAnnouncement(null);
      setEditSuccessToast('Announcement updated successfully.');
      setTimeout(() => {
        setEditSuccessToast('');
      }, 4000);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Unable to update announcement.');
    } finally {
      setIsSavingEdit(false);
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
    { id: 'reports', label: 'Reports', count: reportsTotal || undefined },
    { id: 'repeated-skips', label: 'Repeated skips', count: escTotal || undefined },
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
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${activeTab === tab.id
                ? 'bg-green-600 text-white shadow'
                : 'text-gray-600 hover:bg-green-50 hover:text-green-700'
                }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold ${activeTab === tab.id ? 'bg-white/25 text-white' : 'bg-green-100 text-green-700'
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
                <h2 className="text-xl font-bold text-gray-800"> Announcement</h2>
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
                    onChange={(e) => {
                      setRecipientType(e.target.value as NotificationRecipientType);
                      setTargetId('');
                      setSelectedPurok(null);
                      setPurokSearch('');
                      setPurokHouseholdCount(null);
                    }}
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
                    {recipientType === 'household' && householdOptionsError && (
                      <div className="mt-1.5 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-700">
                        <span>{householdOptionsError}</span>
                        <button type="button" onClick={() => void loadHouseholdOptions()} className="font-semibold underline hover:text-rose-900 ml-2">Retry</button>
                      </div>
                    )}
                    {recipientType === 'collector' && collectorOptionsError && (
                      <div className="mt-1.5 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-700">
                        <span>{collectorOptionsError}</span>
                        <button type="button" onClick={() => void loadCollectorOptions()} className="font-semibold underline hover:text-rose-900 ml-2">Retry</button>
                      </div>
                    )}
                  </div>
                )}

                {recipientType === 'purok-households' && (
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-gray-700">Purok / Area</label>
                    {/* Searchable combobox — only allows selecting existing puroks */}
                    <div className="relative">
                      <input
                        ref={purokInputRef}
                        type="text"
                        value={purokSearch}
                        onChange={(e) => {
                          setPurokSearch(e.target.value);
                          setSelectedPurok(null); // clear selection if user types
                          setPurokHouseholdCount(null);
                          setPurokDropdownOpen(true);
                        }}
                        onFocus={() => setPurokDropdownOpen(true)}
                        placeholder="Type to filter puroks…"
                        autoComplete="off"
                        className="w-full rounded-xl border border-green-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-green-500"
                      />
                      {selectedPurok && (
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-green-600 font-semibold">✓</span>
                      )}
                      {purokDropdownOpen && (
                        <div
                          ref={purokDropdownRef}
                          className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-green-100 bg-white shadow-lg"
                        >
                          {puroks
                            .filter((p) => p.isActive && p.name.toLowerCase().includes(purokSearch.toLowerCase()))
                            .map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                className={`w-full px-3 py-2 text-left text-sm hover:bg-green-50 ${selectedPurok?.id === p.id ? 'bg-green-50 font-semibold text-green-700' : 'text-gray-800'
                                  }`}
                                onMouseDown={(e) => {
                                  e.preventDefault(); // prevent input blur
                                  setSelectedPurok(p);
                                  setPurokSearch(p.name);
                                  setPurokDropdownOpen(false);
                                }}
                              >
                                {p.name}
                                {p.collectionDay && <span className="ml-2 text-xs text-gray-400">({p.collectionDay})</span>}
                              </button>
                            ))}
                          {puroks.filter((p) => p.isActive && p.name.toLowerCase().includes(purokSearch.toLowerCase())).length === 0 && (
                            <p className="px-3 py-2 text-xs text-gray-400">No matching puroks found.</p>
                          )}
                        </div>
                      )}
                    </div>
                    {/* Household count preview */}
                    {selectedPurok && purokHouseholdCount !== null && (
                      <p className="mt-1.5 text-xs font-semibold text-green-700">
                        🏠 {purokHouseholdCount} active household{purokHouseholdCount !== 1 ? 's' : ''} will receive this announcement.
                      </p>
                    )}
                    {selectedPurok && purokHouseholdCount === null && (
                      <p className="mt-1.5 text-xs text-gray-400">Checking household count…</p>
                    )}
                    {!selectedPurok && purokSearch && (
                      <p className="mt-1 text-xs text-red-500">Please select a purok from the dropdown — free text is not accepted.</p>
                    )}
                    {purokError && (
                      <div className="mt-1.5 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-700">
                        <span>{purokError}</span>
                        <button type="button" onClick={() => void loadPuroks()} className="font-semibold underline hover:text-rose-900 ml-2">Retry</button>
                      </div>
                    )}
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
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">
                  All Announcements ({debouncedAnnouncementSearch.trim().length > 0 ? `${filteredAnnouncements.length} of ${announcementHistory.length}` : announcementHistory.length})
                </h2>
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

              {/* Search input with debounce and reset button */}
              <div className="relative mb-4">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={announcementSearch}
                  onChange={(e) => setAnnouncementSearch(e.target.value)}
                  placeholder="Search title, message, or recipient..."
                  className="w-full rounded-xl border border-green-200 bg-white py-2 pl-9 pr-9 text-sm text-gray-800 placeholder-gray-400 outline-none transition focus:border-green-500 focus:ring-1 focus:ring-green-500"
                  aria-label="Search announcements"
                />
                {announcementSearch && (
                  <button
                    type="button"
                    onClick={() => setAnnouncementSearch('')}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition"
                    aria-label="Clear search"
                    title="Clear search"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {editSuccessToast && (
                <div className="mb-3 flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">
                  <span>{editSuccessToast}</span>
                  <button type="button" onClick={() => setEditSuccessToast('')} className="ml-2 font-bold text-green-700 hover:text-green-900">✕</button>
                </div>
              )}

              {isLoading ? (
                <p className="py-8 text-center text-sm text-gray-500">Loading…</p>
              ) : announcementHistory.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm font-semibold text-gray-700">No announcements sent yet.</p>
                  <p className="mt-1 text-xs text-gray-500">Use the form to send your first announcement.</p>
                </div>
              ) : filteredAnnouncements.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm font-semibold text-gray-700">No announcements match your search.</p>
                  <p className="mt-1 text-xs text-gray-500">Try searching for a different keyword, recipient, or level.</p>
                  <button
                    type="button"
                    onClick={() => setAnnouncementSearch('')}
                    className="mt-3 inline-flex items-center rounded-xl bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100 transition"
                  >
                    Clear search
                  </button>
                </div>
              ) : (
                <ul className="max-h-[520px] space-y-2 overflow-auto">
                  {filteredAnnouncements.map((note) => (
                    <li key={note.id} className="rounded-2xl border border-gray-100 bg-white px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-gray-800">{note.title}</p>
                            {note.editedAt && (
                              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                                Edited • {formatDateTime(note.editedAt)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">{note.level}</span>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(note)}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-600 transition hover:border-green-300 hover:bg-green-50 hover:text-green-700"
                            title="Edit announcement"
                            aria-label={`Edit announcement: ${note.title}`}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                            </svg>
                            <span>Edit</span>
                          </button>
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-gray-500 line-clamp-2">{note.message}</p>
                      <p className="mt-1.5 text-xs text-gray-400">
                        {getRecipientDisplay(note)} · {formatDateTime(note.createdAt)}
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

        {/* ══════════════════════════════════════════════════════════════════
            REPORTS TAB (read-only collector-to-household reports)
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'reports' && (
          <div className="rounded-[28px] border border-green-100 bg-white/90 p-6 shadow-[0_20px_60px_rgba(20,83,45,0.08)]">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-bold text-gray-800">
                Reports ({reportsTotal} total)
              </h2>
              <select
                value={reportReasonFilter}
                onChange={(e) => { setReportReasonFilter(e.target.value); setReportsPage(1); }}
                className="rounded-xl border border-green-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-green-500 sm:w-56"
                aria-label="Filter reports by reason"
              >
                <option value="">All reasons</option>
                <option value="no_garbage_out">Skip</option>
                <option value="dirty_surroundings">Dirty surroundings</option>
                <option value="other">Other</option>
              </select>
            </div>

            {reportsLoading ? (
              <p className="py-8 text-center text-sm text-gray-500">Loading…</p>
            ) : reportsError ? (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 flex items-center justify-between gap-3">
                <span>{reportsError}</span>
                <button onClick={() => void loadReports(reportsPage, reportReasonFilter)} className="shrink-0 rounded-xl bg-red-100 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-200 transition">Retry</button>
              </div>
            ) : reports.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm font-semibold text-gray-700">No reports found.</p>
                <p className="mt-1 text-xs text-gray-500">Collector reports filed against households will appear here.</p>
              </div>
            ) : (
              <>
                <ul className="space-y-3">
                  {reports.map((note) => (
                    <li key={note.id} className="rounded-2xl border border-green-100 bg-white px-4 py-4 shadow-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                          🚩 {reportReasonLabel(note)}
                        </span>
                        {note.dismissedAt && (
                          <span className="rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-bold text-gray-600">
                            Withdrawn
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm font-bold text-gray-800">{note.title}</p>
                      <p className="mt-1 text-xs text-gray-500 line-clamp-3">{note.message}</p>
                      <p className="mt-1.5 text-xs text-gray-400">
                        Household: {note.householdId ?? '—'} · By {note.senderName} ({note.collectorId ?? note.senderId}) · {formatDateTime(note.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex items-center justify-between">
                  <button
                    type="button"
                    disabled={reportsPage <= 1 || reportsLoading}
                    onClick={() => setReportsPage((p) => Math.max(1, p - 1))}
                    className="rounded-xl border border-green-200 bg-white px-4 py-2 text-sm font-semibold text-green-700 transition hover:bg-green-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <p className="text-xs font-semibold text-gray-500">Page {reportsPage} of {reportsTotalPages}</p>
                  <button
                    type="button"
                    disabled={reportsPage >= reportsTotalPages || reportsLoading}
                    onClick={() => setReportsPage((p) => p + 1)}
                    className="rounded-xl border border-green-200 bg-white px-4 py-2 text-sm font-semibold text-green-700 transition hover:bg-green-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            REPEATED SKIPS TAB (read-only items; resolve/dismiss actions only)
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'repeated-skips' && (
          <div className="rounded-[28px] border border-green-100 bg-white/90 p-6 shadow-[0_20px_60px_rgba(20,83,45,0.08)]">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-bold text-gray-800">
                Repeated skips ({escTotal} open)
              </h2>
              <select
                value={escStatus}
                onChange={(e) => { setEscStatus(e.target.value); setEscPage(1); }}
                className="rounded-xl border border-green-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-green-500 sm:w-56"
                aria-label="Filter escalations by status"
              >
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
                <option value="dismissed">Dismissed</option>
                <option value="all">All</option>
              </select>
            </div>

            {escActionError && (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {escActionError}
              </div>
            )}

            {escLoading ? (
              <p className="py-8 text-center text-sm text-gray-500">Loading…</p>
            ) : escError ? (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 flex items-center justify-between gap-3">
                <span>{escError}</span>
                <button onClick={() => void loadEscalations(escPage, escStatus)} className="shrink-0 rounded-xl bg-red-100 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-200 transition">Retry</button>
              </div>
            ) : escalations.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm font-semibold text-gray-700">No escalations found.</p>
                <p className="mt-1 text-xs text-gray-500">Households with repeated no-garbage-out reports will appear here.</p>
              </div>
            ) : (
              <>
                <ul className="space-y-3">
                  {escalations.map((item) => (
                    <li key={item.id} className="rounded-2xl border border-green-100 bg-white px-4 py-4 shadow-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${item.level === 'follow_up' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                          {item.level === 'follow_up' ? 'Needs follow-up' : 'Review'}
                        </span>
                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-600">
                          Streak: {item.streak}
                        </span>
                        {item.status !== 'open' && (
                          <span className="rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-bold text-gray-600">
                            {item.status}
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm font-bold text-gray-800">Household: {item.householdId}</p>
                      <p className="mt-1 text-xs text-gray-400">
                        Since {new Date(item.streakStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · Filed {formatDateTime(item.createdAt)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void toggleEscDetail(item.id)}
                          className="rounded-xl border border-green-200 bg-white px-3 py-1.5 text-xs font-semibold text-green-700 transition hover:bg-green-50"
                        >
                          {escDetail[item.id] ? 'Hide skips' : 'Show skips'}
                        </button>
                        {item.status === 'open' && (
                          <>
                            <a
                              href={`/messages?tab=announcements&to=${encodeURIComponent(item.householdId)}`}
                              className="rounded-xl border border-green-200 bg-white px-3 py-1.5 text-xs font-semibold text-green-700 transition hover:bg-green-50"
                            >
                              Send warning
                            </a>
                            <button
                              type="button"
                              onClick={() => void handleResolveEsc(item.id)}
                              className="rounded-xl bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-green-700"
                            >
                              Resolve
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDismissEsc(item.id)}
                              className="rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                            >
                              Dismiss
                            </button>
                          </>
                        )}
                      </div>
                      {item.status === 'open' && (
                        <input
                          type="text"
                          value={escNote[item.id] ?? ''}
                          onChange={(e) => setEscNote((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          placeholder="Resolve note / dismiss reason (required to dismiss)…"
                          className="mt-2 w-full rounded-xl border border-green-200 bg-white px-3 py-2 text-xs text-gray-800 outline-none focus:border-green-500"
                          aria-label="Resolve note or dismiss reason"
                        />
                      )}
                      {(item.resolutionNote || item.dismissReason || item.actedBy) && (
                        <p className="mt-1.5 text-xs text-gray-500">
                          {item.resolutionNote ?? item.dismissReason ?? ''}{item.actedBy ? ` — ${item.actedBy}` : ''}
                        </p>
                      )}
                      {escDetail[item.id] && (
                        <ul className="mt-2 space-y-1.5 rounded-xl bg-gray-50 p-3">
                          <li className="text-xs font-bold text-gray-600">Skipped dates (live, streak {escDetail[item.id].liveStreak})</li>
                          {escDetail[item.id].skips.length === 0 ? (
                            <li className="text-xs text-gray-500">No active skips — streak ended.</li>
                          ) : (
                            escDetail[item.id].skips.map((s) => (
                              <li key={s.date} className="text-xs text-gray-600">
                                {new Date(`${s.date}T00:00:00+08:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                {' '}· {s.collectorName ?? s.collectorId ?? 'Unknown collector'}
                              </li>
                            ))
                          )}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex items-center justify-between">
                  <button
                    type="button"
                    disabled={escPage <= 1 || escLoading}
                    onClick={() => setEscPage((p) => Math.max(1, p - 1))}
                    className="rounded-xl border border-green-200 bg-white px-4 py-2 text-sm font-semibold text-green-700 transition hover:bg-green-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <p className="text-xs font-semibold text-gray-500">Page {escPage} of {escTotalPages}</p>
                  <button
                    type="button"
                    disabled={escPage >= escTotalPages || escLoading}
                    onClick={() => setEscPage((p) => p + 1)}
                    className="rounded-xl border border-green-200 bg-white px-4 py-2 text-sm font-semibold text-green-700 transition hover:bg-green-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            EDIT ANNOUNCEMENT MODAL
        ══════════════════════════════════════════════════════════════════ */}
        {editingAnnouncement && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) handleCloseEdit();
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-announcement-title"
              className="w-full max-w-lg rounded-[28px] border border-green-100 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 id="edit-announcement-title" className="text-xl font-bold text-gray-800">
                  Edit Announcement
                </h3>
                <button
                  type="button"
                  onClick={handleCloseEdit}
                  disabled={isSavingEdit}
                  className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
                  aria-label="Close dialog"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-4">
                {/* Read-only recipient */}
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">Recipient</label>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-700 select-none">
                    {getRecipientDisplay(editingAnnouncement)}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Recipient audience is read-only because this announcement has already been delivered.
                  </p>
                </div>

                {/* Title */}
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-sm font-semibold text-gray-700">Title</label>
                    <span className="text-xs text-gray-400">{editTitle.length}/120</span>
                  </div>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    maxLength={120}
                    required
                    placeholder="Announcement title"
                    className="w-full rounded-xl border border-green-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-green-500"
                  />
                </div>

                {/* Message */}
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-sm font-semibold text-gray-700">Message</label>
                    <span className="text-xs text-gray-400">{editMessage.length}/2000</span>
                  </div>
                  <textarea
                    value={editMessage}
                    onChange={(e) => setEditMessage(e.target.value)}
                    rows={4}
                    maxLength={2000}
                    required
                    placeholder="Announcement message"
                    className="w-full rounded-xl border border-green-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-green-500"
                  />
                </div>

                {/* Level / Type */}
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">Level</label>
                  <select
                    value={editLevel}
                    onChange={(e) => setEditLevel(e.target.value)}
                    className="w-full rounded-xl border border-green-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-green-500"
                  >
                    <option>General</option>
                    <option>Reminder</option>
                    <option>Schedule</option>
                    <option>Warning</option>
                    <option>Announcement</option>
                  </select>
                </div>

                {editError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                    {editError}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleCloseEdit}
                    disabled={isSavingEdit}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    className="rounded-xl bg-green-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
                  >
                    {isSavingEdit ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#f7fdf8_0%,#eef9ef_100%)]">
          <p className="text-sm text-gray-500">Loading messages...</p>
        </main>
      }
    >
      <MessagesContent />
    </Suspense>
  );
}
