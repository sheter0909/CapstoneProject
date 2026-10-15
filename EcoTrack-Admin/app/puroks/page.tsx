'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi, type Purok } from '../../lib/api';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PuroksPage() {
  const router = useRouter();
  const [puroks, setPuroks] = useState<Purok[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Add form
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState('');
  const [addCollectionDay, setAddCollectionDay] = useState('');
  const [addError, setAddError] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Edit form
  const [editingPurok, setEditingPurok] = useState<Purok | null>(null);
  const [editName, setEditName] = useState('');
  const [editCollectionDay, setEditCollectionDay] = useState('');
  const [editError, setEditError] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Household counts
  const [householdCounts, setHouseholdCounts] = useState<Record<string, number>>({});

  // Activating an already-inactive purok
  const [isActivating, setIsActivating] = useState(false);

  // Toast
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const loadPuroks = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await adminApi.puroks();
      setPuroks(data);
      // Fetch household counts for all puroks in parallel
      const counts = await Promise.all(
        data.map((p) => adminApi.purokHouseholdCount(p.id).catch(() => ({ purokId: p.id, activeHouseholds: 0 })))
      );
      const countMap: Record<string, number> = {};
      for (const c of counts) countMap[c.purokId] = c.activeHouseholds;
      setHouseholdCounts(countMap);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load puroks.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const authToken = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    const userStr = typeof window !== 'undefined' ? localStorage.getItem('adminUser') : null;
    if (!authToken || !userStr) { router.push('/login'); return; }
    try { JSON.parse(userStr); } catch { router.push('/login'); return; }
    void loadPuroks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    if (!addName.trim()) { setAddError('Purok name is required.'); return; }
    setIsAdding(true);
    try {
      await adminApi.createPurok({ name: addName.trim(), collectionDay: addCollectionDay || undefined });
      setAddName('');
      setAddCollectionDay('');
      setShowAddForm(false);
      showToast('Purok created successfully.');
      void loadPuroks();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Unable to create purok.');
    } finally {
      setIsAdding(false);
    }
  };

  const startEdit = (p: Purok) => {
    setEditingPurok(p);
    setEditName(p.name);
    setEditCollectionDay(p.collectionDay ?? '');
    setEditError('');
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPurok) return;
    setEditError('');
    if (!editName.trim()) { setEditError('Purok name is required.'); return; }
    setIsSavingEdit(true);
    try {
      await adminApi.updatePurok(editingPurok.id, {
        name: editName.trim(),
        collectionDay: editCollectionDay || null,
      });
      setEditingPurok(null);
      showToast('Purok updated.');
      void loadPuroks();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Unable to update purok.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleActivate = async (p: Purok) => {
    if (p.isActive || isActivating) return;
    // Activate does not require confirmation
    setIsActivating(true);
    try {
      await adminApi.activatePurok(p.id);
      showToast(`"${p.name}" activated.`);
      void loadPuroks();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setIsActivating(false);
    }
  };

  const activePuroks = puroks.filter((p) => p.isActive);
  const inactivePuroks = puroks.filter((p) => !p.isActive);

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 to-green-100">
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* ── Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-7 w-7 text-green-600" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                <circle cx="12" cy="9" r="2.5" />
              </svg>
              Puroks / Areas
            </h1>
            <p className="mt-1 text-gray-600">
              Manage the named barangay puroks used for household and collector assignments.
            </p>
          </div>
          <button
            type="button"
            id="add-purok-btn"
            onClick={() => { setShowAddForm(true); setAddError(''); }}
            className="inline-flex items-center gap-2 rounded-2xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-green-700"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
            </svg>
            Add Purok
          </button>
        </div>

        {/* ── Toast */}
        {toast && (
          <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700 shadow-sm">
            {toast}
          </div>
        )}

        {/* ── Load error */}
        {loadError && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 flex items-center justify-between gap-3">
            <span>{loadError}</span>
            <button onClick={() => void loadPuroks()} className="shrink-0 rounded-xl bg-red-100 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-200 transition">
              Retry
            </button>
          </div>
        )}

        {/* ── Add form */}
        {showAddForm && (
          <div className="mb-6 rounded-[28px] border border-green-100 bg-white/95 p-6 shadow-[0_20px_60px_rgba(20,83,45,0.08)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">Add New Purok</h2>
              <button
                type="button"
                onClick={() => { setShowAddForm(false); setAddError(''); setAddName(''); setAddCollectionDay(''); }}
                className="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close add form"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>
            <form onSubmit={handleAdd} className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="mb-1 block text-sm font-semibold text-gray-700">Purok name *</label>
                <input
                  id="add-purok-name"
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="e.g. Purok Calan 1"
                  className="w-full rounded-xl border border-green-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-green-500"
                />
              </div>
              <div className="min-w-[180px]">
                <label className="mb-1 block text-sm font-semibold text-gray-700">Collection day</label>
                <select
                  id="add-purok-day"
                  value={addCollectionDay}
                  onChange={(e) => setAddCollectionDay(e.target.value)}
                  className="w-full rounded-xl border border-green-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-green-500"
                >
                  <option value="">— None —</option>
                  {DAYS.map((d) => <option key={d}>{d}</option>)}
                </select>
              </div>
              <button
                type="submit"
                id="add-purok-submit"
                disabled={isAdding}
                className="shrink-0 rounded-2xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isAdding ? 'Adding…' : 'Add Purok'}
              </button>
            </form>
            {addError && <p className="mt-2 text-xs font-semibold text-red-600">{addError}</p>}
          </div>
        )}

        {/* ── Edit form (inline modal) */}
        {editingPurok && (
          <div className="mb-6 rounded-[28px] border border-green-100 bg-white/95 p-6 shadow-[0_20px_60px_rgba(20,83,45,0.08)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">Edit Purok — {editingPurok.name}</h2>
              <button
                type="button"
                onClick={() => setEditingPurok(null)}
                className="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                aria-label="Cancel edit"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>
            <form onSubmit={handleEdit} className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="mb-1 block text-sm font-semibold text-gray-700">Purok name *</label>
                <input
                  id="edit-purok-name"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-green-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-green-500"
                />
              </div>
              <div className="min-w-[180px]">
                <label className="mb-1 block text-sm font-semibold text-gray-700">Collection day</label>
                <select
                  id="edit-purok-day"
                  value={editCollectionDay}
                  onChange={(e) => setEditCollectionDay(e.target.value)}
                  className="w-full rounded-xl border border-green-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-green-500"
                >
                  <option value="">— None —</option>
                  {DAYS.map((d) => <option key={d}>{d}</option>)}
                </select>
              </div>
              <button
                type="submit"
                id="edit-purok-submit"
                disabled={isSavingEdit}
                className="shrink-0 rounded-2xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingEdit ? 'Saving…' : 'Save Changes'}
              </button>
            </form>
            {editError && <p className="mt-2 text-xs font-semibold text-red-600">{editError}</p>}
          </div>
        )}

        {/* ── Purok list */}
        {isLoading ? (
          <div className="rounded-[28px] border border-green-100 bg-white/90 p-12 shadow text-center">
            <p className="text-sm text-gray-500">Loading puroks…</p>
          </div>
        ) : puroks.length === 0 ? (
          <div className="rounded-[28px] border border-green-100 bg-white/90 p-12 shadow text-center">
            <p className="text-base font-semibold text-gray-700">No puroks yet.</p>
            <p className="mt-1 text-sm text-gray-500">Click &quot;Add Purok&quot; to create the first one.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Active */}
            {activePuroks.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-400">Active ({activePuroks.length})</h2>
                <ul className="space-y-3">
                  {activePuroks.map((p) => (
                    <PurokRow
                      key={p.id}
                      purok={p}
                      householdCount={householdCounts[p.id] ?? 0}
                      onEdit={() => startEdit(p)}
                      onToggle={() => void handleActivate(p)}
                    />
                  ))}
                </ul>
              </section>
            )}

            {/* Inactive */}
            {inactivePuroks.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-400">Inactive ({inactivePuroks.length})</h2>
                <ul className="space-y-3 opacity-70">
                  {inactivePuroks.map((p) => (
                    <PurokRow
                      key={p.id}
                      purok={p}
                      householdCount={householdCounts[p.id] ?? 0}
                      onEdit={() => startEdit(p)}
                      onToggle={() => void handleActivate(p)}
                    />
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

// ─── PurokRow component ────────────────────────────────────────────────────────

function PurokRow({
  purok,
  householdCount,
  onEdit,
  onToggle,
}: {
  purok: Purok;
  householdCount: number;
  onEdit: () => void;
  onToggle: () => void;
}) {
  return (
    <li className="rounded-2xl border border-green-100 bg-white px-5 py-4 shadow-sm transition hover:shadow-md">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${purok.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
          </div>
          <div>
            <p className="text-base font-bold text-gray-800">{purok.name}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500">
                🏠 {householdCount} active household{householdCount !== 1 ? 's' : ''}
              </span>
              {purok.collectionDay && (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                  📅 {purok.collectionDay}
                </span>
              )}
              {!purok.isActive && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">Deactivated</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            id={`edit-purok-${purok.id}`}
            onClick={onEdit}
            className="rounded-xl border border-green-200 bg-white px-3 py-1.5 text-xs font-semibold text-green-700 transition hover:bg-green-50"
          >
            Rename
          </button>
          {!purok.isActive && (
            <button
              type="button"
              id={`toggle-purok-${purok.id}`}
              onClick={onToggle}
              className="rounded-xl border border-green-200 bg-white px-3 py-1.5 text-xs font-semibold text-green-700 transition hover:bg-green-50"
            >
              Activate
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
