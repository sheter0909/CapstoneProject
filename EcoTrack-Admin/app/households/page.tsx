"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import Modal from '../../components/Modal';
import Pagination from '../../components/Pagination';
import { adminApi, ApiError, type Purok } from '../../lib/api';

interface Household {
  id: string;
  name: string;
  email: string;
  unit: string;
  joinDate: string;
  status: 'active' | 'inactive' | 'archived';
  previousStatus?: 'active' | 'inactive' | 'archived';
  purok?: string;
  purokId?: string;
  address?: string;
  birthdate?: string;
  password?: string;
  username?: string;
  lastCollection?: string;
  violations?: number;
  skipStreak?: number;
  needsFollowUp?: boolean;
}

interface BackendHouseholdAccount {
  id: string;
  fullName: string;
  householdId: string;
  address?: string | null;
  purok: string;
  purokId?: string | null;
  birthdate?: string | null;
  joinDate: string;
  status: 'active' | 'inactive' | 'archived';
  violationCount?: number;
  skipStreak?: number;
  needsFollowUp?: boolean;
}

interface HouseholdListResult {
  items?: BackendHouseholdAccount[];
  // total is the authoritative non-archived count from the backend
  // (list() helper filters status !== 'archived' and counts that same set).
  total?: number;
  page?: number;
  totalPages?: number;
}

interface CollectionHistoryEntry {
  id: string;
  timestamp: string;
  wasteType: string;
  weightKg: number | string;
  editedAt?: string | null;
}

export default function HouseholdsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHousehold, setSelectedHousehold] = useState<Household | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [puroks, setPuroks] = useState<Purok[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    unit: '',
    password: '',
    purok: '',
    purokId: '',
    address: '',
  });
  const [formErrors, setFormErrors] = useState<{
    name?: string;
    email?: string;
    purok?: string;
    unit?: string;
    password?: string;
  }>({});
  const [showPassword, setShowPassword] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [pendingNewHousehold, setPendingNewHousehold] = useState<Household | null>(null);
  const [showConfirmRegister, setShowConfirmRegister] = useState(false);
  const [showRegisterSuccess, setShowRegisterSuccess] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  // Server-side pagination/search state.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Search is debounced, then applied server-side (no client-side slicing).
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [showMissing, setShowMissing] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showUpdateSuccess, setShowUpdateSuccess] = useState(false);
  const [collectionHistory, setCollectionHistory] = useState<CollectionHistoryEntry[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Authoritative non-archived count from the backend (not visibleHouseholds.length
  // which is a client-side slice and wrong when result has pagination).
  const [totalCount, setTotalCount] = useState<number | null>(null);

  const [hasStoredSession] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return !!window.localStorage.getItem('authToken') && !!JSON.parse(window.localStorage.getItem('adminUser') ?? 'null');
    } catch {
      return false;
    }
  });

  // Reusable loader — called on mount, filter/page change, and after any create/archive/restore.
  const loadHouseholds = useCallback(() => {
    setIsLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(pageSize),
      status: statusFilter,
      ...(debouncedQuery ? { q: debouncedQuery } : {}),
    });
    void (adminApi.households(`?${params.toString()}`) as Promise<HouseholdListResult>)
      .then((result) => {
        setTotalCount(result.total ?? 0);
        setHouseholds(
          (result.items ?? []).map((account) => ({
            id: account.id,
            name: account.fullName,
            email: account.householdId,
            unit: account.birthdate ?? '',
            address: account.address ?? account.purok,
            purok: account.purok,
            purokId: account.purokId ?? undefined,
            birthdate: account.birthdate ?? '',
            joinDate: account.joinDate,
            status: account.status,
            violations: account.violationCount ?? 0,
          }))
        );
      })
      .catch((error: unknown) => setLoadError(error instanceof Error ? error.message : 'Unable to load households.'))
      .finally(() => setIsLoading(false));
  }, [page, pageSize, statusFilter, debouncedQuery]);

  // Check authentication on mount and load households from the backend
  useEffect(() => {
    if (!hasStoredSession) {
      router.push('/login');
      return;
    }
    loadHouseholds();
  }, [router, hasStoredSession, loadHouseholds]);

  const fetchNextHouseholdId = useCallback(async (current?: string) => {
    try {
      const { id } = await adminApi.nextHouseholdId();
      if (current) {
        const cur = Number(current.match(/^HH-(\d+)$/i)?.[1] ?? NaN);
        const got = Number(id.match(/^HH-(\d+)$/i)?.[1] ?? NaN);
        if (Number.isFinite(cur) && Number.isFinite(got) && got <= cur) {
          return `HH-${String(cur + 1).padStart(4, '0')}`;
        }
      }
      return id;
    } catch {
      return current ?? '';
    }
  }, []);

  useEffect(() => {
    if (hasStoredSession) {
      void adminApi.puroks().then((list) => setPuroks(list)).catch(() => {});
    }
  }, [hasStoredSession]);


  const resetFormState = () => {
    setShowForm(false);
    setIsEditing(false);
    setShowPassword(false);
    setFormErrors({});
    setFormData({ name: '', email: '', unit: '', password: '', purok: '', purokId: '', address: '' });
  };

  const handleAddHousehold = (e: React.FormEvent) => {
    e.preventDefault();

    const nextErrors: { name?: string; email?: string; purok?: string; unit?: string; password?: string } = {};
    if (!formData.email.trim()) {
      nextErrors.email = 'Household ID is required.';
    } else if (households.some(h => h.email.toLowerCase() === formData.email.trim().toLowerCase())) {
      nextErrors.email = 'This Household ID is already in use.';
    }
    if (!formData.name.trim()) {
      nextErrors.name = 'Full name is required.';
    }
    if (!formData.purok.trim() && !formData.purokId) {
      nextErrors.purok = 'Purok is required.';
    }
    if (!formData.unit.trim()) {
      nextErrors.unit = 'Birthdate is required.';
    }
    if (!formData.password) {
      nextErrors.password = 'Password is required.';
    } else if (formData.password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters.';
    }

    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const pending: Household = {
      id: formData.email.trim(),
      name: formData.name.trim(),
      email: formData.email.trim(),
      unit: formData.unit.trim(),
      purok: formData.purok.trim(),
      purokId: formData.purokId || undefined,
      address: formData.address.trim() || formData.purok.trim(),
      username: formData.email.trim(),
      password: formData.password,
      joinDate: new Date().toISOString().split('T')[0],
      status: 'active',
    };

    setPendingNewHousehold(pending);
    setShowConfirmRegister(true);
  };

  const handleEditHousehold = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedHousehold) return;

    const nextErrors: { name?: string; email?: string; purok?: string; unit?: string; password?: string } = {};
    if (!formData.name.trim()) {
      nextErrors.name = 'Full name is required';
    }
    if (!formData.purok.trim() && !formData.purokId) {
      nextErrors.purok = 'Purok is required';
    }
    if (!formData.unit.trim()) {
      nextErrors.unit = 'Birthdate is required';
    }
    if (formData.password && formData.password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters';
    }

    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    try {
      const account = await adminApi.updateHousehold(selectedHousehold.id, {
        householdId: selectedHousehold.email,
        fullName: formData.name.trim(),
        purok: formData.purok.trim(),
        purokId: formData.purokId || undefined,
        address: formData.address.trim() || formData.purok.trim(),
        birthdate: formData.unit.trim() || undefined,
        password: formData.password || undefined,
      }) as BackendHouseholdAccount;

      const updatedHousehold: Household = {
        ...selectedHousehold,
        name: account.fullName,
        purok: account.purok,
        purokId: account.purokId ?? formData.purokId ?? undefined,
        address: (account.address ?? formData.address.trim()) || formData.purok.trim(),
        unit: account.birthdate ?? formData.unit.trim(),
        birthdate: account.birthdate ?? formData.unit.trim(),
      };

      const updatedHouseholds = households.map((h) => (h.id === selectedHousehold.id ? updatedHousehold : h));
      setHouseholds(updatedHouseholds);
      setSelectedHousehold(updatedHousehold);
      setShowForm(false);
      setIsEditing(false);
      setShowPassword(false);
      setFormErrors({});
      setFormData({ name: '', email: '', unit: '', password: '', purok: '', purokId: '', address: '' });
      setToastMessage('Household updated successfully');
      setTimeout(() => setToastMessage(null), 2200);
      setShowUpdateSuccess(true);
      setTimeout(() => setShowUpdateSuccess(false), 2200);
    } catch (error) {
      if (error instanceof ApiError && error.errors && error.errors.length > 0) {
        const serverErrors: { name?: string; email?: string; purok?: string; unit?: string; password?: string } = {};
        for (const err of error.errors) {
          if (err.field === 'fullName') serverErrors.name = err.message;
          else if (err.field === 'purok') serverErrors.purok = err.message;
          else if (err.field === 'birthdate') serverErrors.unit = err.message;
          else if (err.field === 'password') serverErrors.password = err.message;
        }
        setFormErrors(serverErrors);
        setToastMessage('Validation failed. Please correct the highlighted fields.');
      } else {
        setToastMessage(error instanceof Error ? error.message : 'Unable to update household.');
      }
    }
  };

  const doCreateHousehold = async () => {
    if (!pendingNewHousehold) return;

    if (!pendingNewHousehold.name || !pendingNewHousehold.email || !pendingNewHousehold.purok || !pendingNewHousehold.unit) {
      setShowMissing(true);
      setShowConfirmRegister(false);
      return;
    }

    if (households.some(h => h.email.toLowerCase() === pendingNewHousehold.email.toLowerCase())) {
      setShowDuplicate(true);
      setShowConfirmRegister(false);
      setFormErrors({ email: 'This Household ID is already in use.' });
      return;
    }

    try {
      const account = await adminApi.createHousehold({
        householdId: pendingNewHousehold.email,
        fullName: pendingNewHousehold.name,
        purok: pendingNewHousehold.purok,
        purokId: pendingNewHousehold.purokId,
        address: pendingNewHousehold.address || pendingNewHousehold.purok,
        birthdate: pendingNewHousehold.unit || undefined,
        password: pendingNewHousehold.password,
      }) as BackendHouseholdAccount;

      const householdWithoutPassword = { ...pendingNewHousehold };
      delete householdWithoutPassword.password;
      const updatedHousehold = {
        ...householdWithoutPassword,
        id: account.id,
        email: account.householdId,
        name: account.fullName,
        unit: account.birthdate ?? pendingNewHousehold.unit,
        purok: account.purok,
        joinDate: account.joinDate,
        status: account.status
      };
      setHouseholds((prev) => [...prev.filter((h) => h.id !== pendingNewHousehold.id), updatedHousehold]);
      setSelectedHousehold(updatedHousehold);
      // Refresh the list + authoritative total from the backend.
      loadHouseholds();

      setFormData({ name: '', email: '', unit: '', password: '', purok: '', purokId: '', address: '' });
      setShowForm(false);
      setShowConfirmRegister(false);
      setShowRegisterSuccess(true);
      setShowQR(true);
      setPendingNewHousehold(null);
      setFormErrors({});
    } catch (error) {
      setShowConfirmRegister(false);
      if (error instanceof ApiError && error.errors && error.errors.length > 0) {
        const serverErrors: { name?: string; email?: string; purok?: string; unit?: string; password?: string } = {};
        for (const err of error.errors) {
          if (err.field === 'householdId') serverErrors.email = err.message;
          else if (err.field === 'fullName') serverErrors.name = err.message;
          else if (err.field === 'purok') serverErrors.purok = err.message;
          else if (err.field === 'birthdate') serverErrors.unit = err.message;
          else if (err.field === 'password') serverErrors.password = err.message;
          else serverErrors.name = err.message;
        }
        setFormErrors(serverErrors);
        setToastMessage('Validation failed. Please correct the highlighted fields.');
      } else {
        setToastMessage(error instanceof Error ? error.message : 'Unable to create household.');
      }
    }
  };

  const handleArchiveHousehold = async () => {
    if (!selectedHousehold) return;

    const isRestoring = selectedHousehold.status === 'archived';
    try {
      const account = await (isRestoring
        ? adminApi.unarchiveHousehold(selectedHousehold.id)
        : adminApi.archiveHousehold(selectedHousehold.id)) as { status: Household['status'] };
      setHouseholds((prev) => prev.map((h) => h.id === selectedHousehold.id ? { ...h, status: account.status } : h));
      setSelectedHousehold({ ...selectedHousehold, status: account.status });
      // Refresh the list + authoritative total from the backend.
      loadHouseholds();
      setShowArchiveConfirm(false);
      setShowUpdateSuccess(true);
      setToastMessage(isRestoring ? 'Household restored successfully' : 'Household archived successfully');
      setTimeout(() => {
        setToastMessage(null);
        setShowUpdateSuccess(false);
      }, 2200);
    } catch (error) {
      setShowArchiveConfirm(false);
      setToastMessage(error instanceof Error ? error.message : 'Unable to update household status.');
    }
  };

  const handleDeactivateHousehold = async () => {
    if (!selectedHousehold || isDeactivating) return;
    setIsDeactivating(true);
    try {
      const account = (await adminApi.archiveHousehold(selectedHousehold.id)) as { status: Household['status'] };
      setHouseholds((prev) => prev.map((h) => (h.id === selectedHousehold.id ? { ...h, status: account.status } : h)));
      setSelectedHousehold({ ...selectedHousehold, status: account.status });
      loadHouseholds();
      setShowDeactivateConfirm(false);
      setToastMessage('Household deactivated successfully');
      setTimeout(() => {
        setToastMessage(null);
      }, 2200);
    } catch (error) {
      setShowDeactivateConfirm(false);
      setToastMessage(error instanceof Error ? error.message : 'Unable to deactivate household.');
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleReactivateHousehold = async () => {
    if (!selectedHousehold || isDeactivating) return;
    setIsDeactivating(true);
    try {
      const account = (await adminApi.unarchiveHousehold(selectedHousehold.id)) as { status: Household['status'] };
      setHouseholds((prev) => prev.map((h) => (h.id === selectedHousehold.id ? { ...h, status: account.status } : h)));
      setSelectedHousehold({ ...selectedHousehold, status: account.status });
      loadHouseholds();
      setToastMessage('Household reactivated successfully');
      setTimeout(() => {
        setToastMessage(null);
      }, 2200);
    } catch (error) {
      setToastMessage(error instanceof Error ? error.message : 'Unable to reactivate household.');
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleEdit = (household: Household) => {
    setSelectedHousehold(household);
    const matchedPurok = puroks.find((p) => p.id === household.purokId || p.name.toLowerCase() === (household.purok || '').toLowerCase());
    setFormData({
      name: household.name,
      email: household.email,
      unit: household.birthdate || '',
      password: '',
      purok: matchedPurok ? matchedPurok.name : (household.purok || ''),
      purokId: matchedPurok ? matchedPurok.id : (household.purokId || ''),
      address: household.address || household.purok || '',
    });
    setFormErrors({});
    setShowPassword(false);
    setIsEditing(true);
    setShowForm(true);
  };

  const openHistory = async (household: Household) => {
    setSelectedHousehold(household);
    try { setCollectionHistory(await adminApi.householdCollections(household.email) as CollectionHistoryEntry[]); } catch { setCollectionHistory([]); }
    setShowHistoryModal(true);
  };

  // Selected-household extras (skip streak + follow-up badge) come from the
  // detail endpoint only, so the list stays free of per-household queries.
  const selectHousehold = (household: Household) => {
    setSelectedHousehold(household);
    setShowQR(false);
    void (adminApi.household(household.id) as Promise<BackendHouseholdAccount>)
      .then((detail) => {
        setSelectedHousehold((prev) =>
          prev && prev.id === household.id
            ? { ...prev, skipStreak: detail.skipStreak ?? 0, needsFollowUp: detail.needsFollowUp ?? false }
            : prev
        );
      })
      .catch(() => {});
  };

  const downloadQRCode = (id?: string) => {
    const targetId = id || (selectedHousehold ? `qr-success-${selectedHousehold.id}` : undefined);
    if (!targetId) return;
    const svg = document.getElementById(targetId) as SVGSVGElement | null;
    if (!svg) return;
    const serializer = new XMLSerializer();
    const source = '<?xml version="1.0" standalone="no"?>\n' + serializer.serializeToString(svg);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${targetId}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const printQRCode = (id?: string) => {
    const targetId = id || (selectedHousehold ? `qr-success-${selectedHousehold.id}` : undefined);
    if (!targetId) return;
    const svg = document.getElementById(targetId) as SVGSVGElement | null;
    if (!svg) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const w = window.open('', '_blank') as Window | null;
    if (!w) return;
    w.document.write(`<html><head><title>Print QR</title></head><body>${source}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
    w.close();
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#f7fdf8_0%,#eef9ef_100%)]">
        <div className="text-center">
          <p className="text-lg text-gray-600">Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#f7fdf8_0%,#eef9ef_100%)]">
      <div className="mx-auto flex max-w-7xl 2xl:max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <section className="rounded-[30px] border border-green-100 bg-white/90 p-6 shadow-[0_20px_60px_rgba(20,83,45,0.08)] backdrop-blur sm:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-green-700">Households</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">Household Management</h2>
              <p className="mt-2 text-sm leading-7 text-gray-600 sm:text-base">
                Manage and monitor all household accounts with a clearer, more approachable view.
              </p>
            </div>
            <button
              onClick={() => {
                if (showForm) { setShowForm(!showForm); return; }
                setShowForm(true);
                setIsEditing(false);
                setFormErrors({});
                void fetchNextHouseholdId().then((id) => {
                  setFormData({ name: '', email: id, unit: '', password: '', purok: '', purokId: '', address: '' });
                });
              }}
              className="inline-flex items-center justify-center rounded-2xl bg-green-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-green-700"
            >
              {showForm ? 'Cancel' : '+ Add Household'}
            </button>
          </div>
        </section>

        {/* Add/Edit Form Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="fixed inset-0 cursor-pointer bg-black/50" onClick={resetFormState} />

            <div className="relative z-10 w-full max-w-3xl rounded-[28px] bg-white p-6 shadow-2xl sm:p-8">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-semibold text-gray-900">{isEditing ? 'Edit Household' : 'Enroll New Household'}</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {isEditing ? 'Update the household profile and account details.' : 'Add a new household profile and generate a QR code.'}
                  </p>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-green-100 bg-green-50 text-green-700">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 11c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zM6 20v-1a4 4 0 014-4h4a4 4 0 014 4v1" />
                  </svg>
                </div>
              </div>

              <form onSubmit={isEditing ? handleEditHousehold : handleAddHousehold} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Household ID Number</label>
                  <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      if (formErrors.email) setFormErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    className={`w-full rounded-2xl border ${formErrors.email ? 'border-rose-400 bg-rose-50/40 focus:border-rose-500' : 'border-green-100 bg-green-50 focus:border-green-400'} px-4 py-3 text-sm text-gray-700 placeholder-gray-400 outline-none transition focus:ring-2 focus:ring-green-100`}
                    placeholder="HH-0001 or custom ID"
                    readOnly={isEditing}
                    disabled={isEditing}
                  />
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={() => void fetchNextHouseholdId(formData.email || undefined).then((id) => { if (id) setFormData((prev) => ({ ...prev, email: id })); })}
                      className="shrink-0 rounded-2xl border border-green-100 bg-white px-4 py-2 text-sm font-semibold text-green-700 transition hover:bg-green-50"
                    >
                      Regenerate
                    </button>
                  )}
                  </div>
                  {formErrors.email && <p className="mt-1.5 text-xs font-semibold text-rose-600">{formErrors.email}</p>}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Full Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value });
                      if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: undefined }));
                    }}
                    className={`w-full rounded-2xl border ${formErrors.name ? 'border-rose-400 bg-rose-50/40 focus:border-rose-500' : 'border-green-100 bg-green-50 focus:border-green-400'} px-4 py-3 text-sm text-gray-700 placeholder-gray-400 outline-none transition focus:ring-2 focus:ring-green-100`}
                    placeholder="Enter full name"
                  />
                  {formErrors.name && <p className="mt-1.5 text-xs font-semibold text-rose-600">{formErrors.name}</p>}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Purok / Area</label>
                  <select
                    value={formData.purokId}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const matched = puroks.find((p) => p.id === selectedId);
                      setFormData({
                        ...formData,
                        purokId: selectedId,
                        purok: matched ? matched.name : '',
                        address: formData.address || (matched ? matched.name : ''),
                      });
                      if (formErrors.purok) setFormErrors((prev) => ({ ...prev, purok: undefined }));
                    }}
                    className={`w-full rounded-2xl border ${formErrors.purok ? 'border-rose-400 bg-rose-50/40 focus:border-rose-500' : 'border-green-100 bg-green-50 focus:border-green-400'} px-4 py-3 text-sm text-gray-700 outline-none transition focus:ring-2 focus:ring-green-100`}
                  >
                    <option value="">Select a purok...</option>
                    {puroks
                      .filter((p) => p.isActive || p.id === formData.purokId)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}{p.collectionDay ? ` (${p.collectionDay})` : ''}
                        </option>
                      ))}
                  </select>
                  {formErrors.purok && <p className="mt-1.5 text-xs font-semibold text-rose-600">{formErrors.purok}</p>}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Address</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => {
                      setFormData({ ...formData, address: e.target.value });
                    }}
                    className="w-full rounded-2xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-gray-700 placeholder-gray-400 outline-none transition focus:border-green-400 focus:ring-2 focus:ring-green-100"
                    placeholder="Street / landmark (defaults to purok)"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Birthdate</label>
                  <input
                    type="date"
                    value={formData.unit}
                    onChange={(e) => {
                      setFormData({ ...formData, unit: e.target.value });
                      if (formErrors.unit) setFormErrors((prev) => ({ ...prev, unit: undefined }));
                    }}
                    className={`w-full rounded-2xl border ${formErrors.unit ? 'border-rose-400 bg-rose-50/40 focus:border-rose-500' : 'border-green-100 bg-green-50 focus:border-green-400'} px-4 py-3 text-sm text-gray-700 placeholder-gray-400 outline-none transition focus:ring-2 focus:ring-green-100`}
                    placeholder="Enter birthdate"
                  />
                  {formErrors.unit && <p className="mt-1.5 text-xs font-semibold text-rose-600">{formErrors.unit}</p>}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => {
                        setFormData({ ...formData, password: e.target.value });
                        if (formErrors.password) setFormErrors((prev) => ({ ...prev, password: undefined }));
                      }}
                      className={`w-full rounded-2xl border ${formErrors.password ? 'border-rose-400 bg-rose-50/40 focus:border-rose-500' : 'border-green-100 bg-green-50 focus:border-green-400'} px-4 py-3 pr-12 text-sm text-gray-700 placeholder-gray-400 outline-none transition focus:ring-2 focus:ring-green-100`}
                      placeholder={isEditing ? 'Enter password' : 'Set a password for household login'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute inset-y-0 right-3 flex items-center text-gray-500 transition hover:text-green-700"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10.58 10.58A2 2 0 0013.42 13.42" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.88 5.08A10.6 10.6 0 0112 5c4.42 0 8.15 2.4 9.8 6a10.8 10.8 0 01-3.2 4.2" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.61 6.61A10.8 10.8 0 002.2 11c1.65 3.6 5.38 6 9.8 6 1.15 0 2.25-.14 3.3-.4" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {formErrors.password && <p className="mt-2 text-sm text-rose-600">{formErrors.password}</p>}
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={resetFormState}
                    className="rounded-2xl bg-green-50 px-5 py-2.5 text-sm font-semibold text-green-700 transition hover:bg-green-100"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="rounded-2xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700"
                  >
                    {isEditing ? 'Save Changes' : 'Generate QR & Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <div className="overflow-hidden rounded-[28px] border border-green-100 bg-white shadow-[0_20px_60px_rgba(20,83,45,0.08)]">
              <div className="border-b border-gray-100 p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">All Households ({totalCount ?? 0})</h3>
                    <p className="mt-1 text-sm text-gray-500">A clear list of active and inactive households.</p>
                  </div>
                  <div className="w-full sm:w-80">
                    <label htmlFor="household-search" className="sr-only">Search households</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                          <path d="M10.5 3a7.5 7.5 0 015.94 12.06l4.75 4.75a1 1 0 01-1.42 1.42l-4.75-4.75A7.5 7.5 0 1110.5 3zm0 2a5.5 5.5 0 100 11 5.5 5.5 0 000-11z" />
                        </svg>
                      </span>
                      <input
                        id="household-search"
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search name or household ID"
                        className="w-full rounded-full border border-gray-200 bg-gray-50 px-4 py-3 pl-12 text-sm text-gray-700 shadow-sm outline-none transition focus:border-green-400 focus:ring-2 focus:ring-green-100"
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(['all','active','inactive'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => {
                        setStatusFilter(filter);
                        setPage(1);
                      }}
                      className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                        statusFilter === filter ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-left text-sm text-gray-600">
                  <colgroup>
                    <col className="w-[120px] min-w-[120px]" />
                    <col className="w-[160px] min-w-[160px]" />
                    <col className="w-[90px] min-w-[90px]" />
                    <col className="w-[90px] min-w-[90px]" />
                    <col className="w-[100px] min-w-[100px]" />
                    <col className="w-[130px] min-w-[130px]" />
                  </colgroup>
                  <thead className="bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-gray-500">
                    <tr>
                      <th className="whitespace-nowrap px-3 py-3">Household ID</th>
                      <th className="whitespace-nowrap px-3 py-3">Head of Household</th>
                      <th className="whitespace-nowrap px-3 py-3">Purok</th>
                      <th className="whitespace-nowrap px-3 py-3">Status</th>
                      <th className="whitespace-nowrap px-3 py-3">Violations</th>
                      <th className="whitespace-nowrap px-3 py-3">Last Collection</th>
                    </tr>
                  </thead>
                  <tbody>
                    {households.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-500">
                          {isLoading ? 'Loading households...' : 'No households found.'}
                        </td>
                      </tr>
                    ) : (
                      households.map((household, index) => (
                        <tr
                          key={household.id}
                          role="button"
                          tabIndex={0}
                          aria-label={`View ${household.name}`}
                          aria-current={selectedHousehold?.id === household.id || undefined}
                          onClick={() => {
                            selectHousehold(household);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              selectHousehold(household);
                            }
                          }}
                          className={`cursor-pointer transition hover:bg-green-100/60 ${
                            selectedHousehold?.id === household.id
                              ? 'bg-green-100/80 outline outline-1 outline-inset outline-green-300'
                              : index % 2 === 0
                                ? 'bg-white'
                                : 'bg-green-50/40'
                          }`}
                        >
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-600">{household.email}</td>
                          <td className="px-3 py-4 text-sm font-semibold text-gray-900">{household.name}</td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-800">{household.purok}</td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                household.status === 'active'
                                  ? 'bg-green-100 text-green-800'
                                  : household.status === 'archived'
                                  ? 'bg-gray-200 text-gray-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {household.status}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                (household.violations ?? 0) > 0
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {household.violations ?? 0}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-800">{new Date(household.joinDate).toLocaleDateString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-gray-100 bg-white px-4 py-5 sm:px-6">
                <Pagination
                  currentPage={page}
                  pageSize={pageSize}
                  totalItems={totalCount ?? 0}
                  onPageChange={setPage}
                  onPageSizeChange={(newSize) => {
                    setPageSize(newSize);
                    setPage(1);
                  }}
                />
              </div>
            </div>
          </div>

          <div className="xl:col-span-1">
            {selectedHousehold ? (
              <div className="rounded-[28px] border border-green-100 bg-white p-6 shadow-[0_20px_60px_rgba(20,83,45,0.08)]">
                <button
                  onClick={() => setSelectedHousehold(null)}
                  className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-gray-500 transition hover:text-green-700"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
                  </svg>
                  Back
                </button>

                <div className="rounded-[24px] border border-green-100 bg-green-50/70 p-4">
                  <h3 className="text-xl font-semibold text-gray-900">{selectedHousehold.name}</h3>
                  <p className="mt-1 text-sm text-gray-600">Household profile overview</p>
                </div>

                <div className="mt-5 space-y-4">
                  <div>
                    <p className="text-sm text-gray-500">Household ID</p>
                    <p className="mt-1 font-semibold text-gray-900">{selectedHousehold.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Unit</p>
                    <p className="mt-1 font-semibold text-gray-900">{selectedHousehold.unit}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Join Date</p>
                    <p className="mt-1 font-semibold text-gray-900">{new Date(selectedHousehold.joinDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <span
                      className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        selectedHousehold.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : selectedHousehold.status === 'archived'
                          ? 'bg-gray-200 text-gray-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {selectedHousehold.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Violations</p>
                    <span
                      className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        (selectedHousehold.violations ?? 0) > 0
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {selectedHousehold.violations ?? 0}
                    </span>
                  </div>
                  {(selectedHousehold.skipStreak ?? 0) > 0 && (
                    <div>
                      <p className="text-sm text-gray-500">Repeated skips</p>
                      <span className="mt-1 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                        {selectedHousehold.skipStreak} consecutive skip{selectedHousehold.skipStreak === 1 ? '' : 's'}
                      </span>
                      {selectedHousehold.needsFollowUp && (
                        <span className="ml-2 mt-1 inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
                          Needs follow-up
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-6 space-y-3">
                  <button
                    onClick={() => setShowQR(!showQR)}
                    className="w-full rounded-2xl bg-green-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-700"
                  >
                    {showQR ? 'Hide QR Code' : 'Show QR Code'}
                  </button>

                  <button
                    onClick={() => handleEdit(selectedHousehold)}
                    className="w-full rounded-2xl border border-green-200 bg-white px-4 py-3 text-sm font-semibold text-green-700 transition hover:bg-green-50"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => {
                      if (selectedHousehold.status === 'archived' || selectedHousehold.status === 'inactive') {
                        void handleReactivateHousehold();
                      } else {
                        setShowDeactivateConfirm(true);
                      }
                    }}
                    disabled={isDeactivating}
                    className="w-full rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
                  >
                    {selectedHousehold.status === 'archived' || selectedHousehold.status === 'inactive' ? 'Reactivate' : 'Deactivate'}
                  </button>

                  <button
                    onClick={() => setShowArchiveConfirm(true)}
                    className="w-full rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-600"
                  >
                    {selectedHousehold.status === 'archived' ? 'Unarchive' : 'Archive'}
                  </button>
                </div>

                {showQR && (
                  <div className="mt-6 flex justify-center rounded-[24px] border border-gray-100 bg-gray-50 p-4">
                    <QRCodeSVG id={`qr-detail-${selectedHousehold.id}`} value={`household-${selectedHousehold.id}-${selectedHousehold.unit}`} size={200} />
                  </div>
                )}

                {showQR && (
                  <div className="mt-3 space-y-2">
                    <button
                      onClick={() => printQRCode(`qr-detail-${selectedHousehold.id}`)}
                      className="w-full rounded-2xl bg-green-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-700"
                    >
                      Print QR
                    </button>
                    <button
                      onClick={() => downloadQRCode(`qr-detail-${selectedHousehold.id}`)}
                      className="w-full rounded-2xl border border-green-200 bg-white px-4 py-3 text-sm font-semibold text-green-700 transition hover:bg-green-50"
                    >
                      Download QR
                    </button>
                  </div>
                )}

                <button
                  onClick={() => openHistory(selectedHousehold)}
                  className="mt-3 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
                >
                  View History
                </button>
              </div>
            ) : (
              <div className="rounded-[28px] border border-green-100 bg-white p-6 text-center text-sm text-gray-500 shadow-[0_20px_60px_rgba(20,83,45,0.08)]">
                <p>Select a household to view details.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Modals / Notifications */}
      <Modal
        open={showConfirmRegister}
        title="Register Household?"
        message="Are you sure you want to register this household? Please verify that all information is correct before proceeding."
        actions={[
          { label: 'Cancel', onClick: () => setShowConfirmRegister(false) },
          { label: 'Register', onClick: doCreateHousehold, variant: 'primary' },
        ]}
      />

      <Modal
        open={showRegisterSuccess}
        title="✅ Household Registered Successfully"
        message="The household has been successfully registered in EcoTrack. A unique Household ID and QR Code have been generated. You can now print or download the QR Code for use during waste collection."
        actions={[
          { label: 'Print QR Code', onClick: () => printQRCode() },
          { label: 'Download QR Code', onClick: () => downloadQRCode() },
          {
            label: 'Register Another Household',
            onClick: () => {
              setShowRegisterSuccess(false);
              setShowForm(true);
            },
            variant: 'default',
          },
        ]}
      >
        <div className="mt-4 flex justify-center">
          {selectedHousehold && (
            <QRCodeSVG
              id={`qr-success-${selectedHousehold.id}`}
              value={`household-${selectedHousehold.id}-${selectedHousehold.unit}`}
              size={200}
            />
          )}
        </div>
      </Modal>

      <Modal
        open={showHistoryModal}
        title="Household Collection History"
        message="Recent collection records for this household"
        actions={[{ label: 'Close', onClick: () => setShowHistoryModal(false) }]}
      >
        <div className="mt-4">
          {collectionHistory.length === 0 ? <p className="text-sm text-gray-600">No historical records available.</p> : <div className="space-y-3">{collectionHistory.map((entry) => <div key={entry.id} className="flex items-center justify-between rounded-xl bg-gray-50 p-3 text-sm"><span>{new Date(entry.timestamp).toLocaleString()} · {entry.wasteType === 'mixed' ? 'Mixed (Not Segregated)' : entry.wasteType} · {String(entry.weightKg)} kg</span>{entry.editedAt ? <span className="font-semibold text-amber-700">(edited)</span> : null}</div>)}</div>}
        </div>
      </Modal>

      <Modal
        open={showDuplicate}
        title="Household Already Exists"
        message="A household with this Household ID already exists. Please use a different ID or allow the system to generate one automatically."
        actions={[{ label: 'OK', onClick: () => setShowDuplicate(false) }]}
      />

      <Modal
        open={showMissing}
        title="Incomplete Information"
        message="Please complete all required fields before registering the household."
        actions={[{ label: 'OK', onClick: () => setShowMissing(false) }]}
      />

      <Modal
        open={showDeactivateConfirm}
        onClose={() => !isDeactivating && setShowDeactivateConfirm(false)}
        title="Deactivate Household?"
        message={`Are you sure you want to deactivate ${selectedHousehold?.name || 'this household'}? They will no longer be able to log in. You can reactivate them later.`}
        actions={[
          {
            label: 'Cancel',
            onClick: () => setShowDeactivateConfirm(false),
            disabled: isDeactivating,
          },
          {
            label: isDeactivating ? 'Deactivating...' : 'Confirm Deactivate',
            onClick: handleDeactivateHousehold,
            variant: 'danger',
            disabled: isDeactivating,
          },
        ]}
      />

      <Modal
        open={showArchiveConfirm}
        onClose={() => setShowArchiveConfirm(false)}
        title={selectedHousehold?.status === 'archived' ? 'Restore Household?' : 'Archive Household?'}
        message={
          selectedHousehold?.status === 'archived'
            ? `Restore ${selectedHousehold.name} to their previous status?`
            : `Are you sure you want to archive ${selectedHousehold?.name || 'this household'}? They will no longer be able to log in, but their records will be preserved.`
        }
        actions={[
          { label: 'Cancel', onClick: () => setShowArchiveConfirm(false) },
          { label: selectedHousehold?.status === 'archived' ? 'Restore' : 'Confirm Archive', onClick: handleArchiveHousehold, variant: 'primary' },
        ]}
      />

      {loadError && (
        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {loadError}
        </div>
      )}

      {toastMessage && (
        <div className="fixed right-4 top-4 z-[60] max-w-[calc(100vw-2rem)] break-words rounded-2xl border border-green-200 bg-white px-4 py-3 text-sm font-semibold text-green-700 shadow-lg sm:max-w-md">
          {toastMessage}
        </div>
      )}

      <Modal
        open={showUpdateSuccess}
        title="Household Updated"
        message="Household information has been updated successfully."
        actions={[{ label: 'OK', onClick: () => setShowUpdateSuccess(false) }]}
      />
    </main>
  );
}
