'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import Modal from '../../components/Modal';
import { addActivity, formatActivityTimestamp } from '../../lib/activity';
import { adminApi, ApiError } from '../../lib/api';

interface GarbageCollector {
  id: string;
  dbId?: string;
  name: string;
  email: string;
  phone: string;
  zone: string;
  joinDate: string;
  status: 'active' | 'inactive' | 'archived';
  previousStatus?: 'active' | 'inactive' | 'archived';
  password?: string;
  birthdate?: string;
}

interface AdminUser {
  email: string;
  name: string;
}

export default function GarbageCollectorsPage() {
  const router = useRouter();
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [collectors, setCollectors] = useState<GarbageCollector[]>([]);
  const [selectedCollector, setSelectedCollector] = useState<GarbageCollector | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showUpdateSuccess, setShowUpdateSuccess] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    email: '',
    phone: '',
    zone: '',
    birthdate: '',
    password: '',
  });
  const [formErrors, setFormErrors] = useState<{ id?: string; name?: string; zone?: string; birthdate?: string; password?: string }>({});
  const [originalCollectorId, setOriginalCollectorId] = useState<string | null>(null);

  const visibleCollectors = collectors.filter((collector) => collector.status !== 'archived');

  const filteredCollectors = visibleCollectors.filter((collector) => {
    const query = (formData.id || '').trim().toLowerCase();
    const nameMatch = collector.name.toLowerCase().includes(query);
    const idMatch = collector.id.toLowerCase().includes(query);
    const zoneMatch = collector.zone.toLowerCase().includes(query);
    const matchesStatus = statusFilter === 'all' ? true : collector.status === statusFilter;
    return (nameMatch || idMatch || zoneMatch) && matchesStatus;
  });

  const getUniqueCollectorId = () => {
    const existingNumbers = collectors
      .map((collector) => {
        const match = collector.id.match(/^GC-(\d+)$/i);
        return match ? Number(match[1]) : 0;
      })
      .filter((n) => n > 0);

    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    return `GC-${String(nextNumber).padStart(4, '0')}`;
  };

  useEffect(() => {
    const authToken = localStorage.getItem('authToken');
    const userStr = localStorage.getItem('adminUser');

    if (!authToken || !userStr) {
      router.push('/login');
    } else {
      try {
        const user = JSON.parse(userStr);
        setAdminUser(user);
        void adminApi.collectors('?limit=100').then((result: any) => {
          const accounts = (result.items ?? []).map((account: any) => ({
            id: account.collectorId,
            dbId: account.id,
            name: account.fullName,
            email: '',
            phone: account.contactNumber ?? '',
            zone: account.assignedArea,
            birthdate: account.birthdate ?? '',
            password: account.password ?? '',
            joinDate: account.joinDate,
            status: account.status,
          }));
          setCollectors(accounts);
          setSelectedCollector(accounts[0] ?? null);
        });
      } catch {
        router.push('/login');
      }
    }

    setIsLoading(false);
  }, [router]);

  const openCreateCollectorModal = () => {
    resetFormState();
    setShowForm(true);
    setIsEditing(false);
    setOriginalCollectorId(null);
    setFormData({ id: getUniqueCollectorId(), name: '', email: '', phone: '', zone: '', birthdate: '', password: '' });
  };

  useEffect(() => {
    if (showForm && !isEditing && !formData.id) {
      setFormData((prev) => ({ ...prev, id: getUniqueCollectorId() }));
    }
  }, [showForm, isEditing, formData.id, collectors]);

  const resetFormState = () => {
    setShowForm(false);
    setIsEditing(false);
    setOriginalCollectorId(null);
    setShowPassword(false);
    setFormErrors({});
    setFormData({ id: '', name: '', email: '', phone: '', zone: '', birthdate: '', password: '' });
  };

  const handleAddCollector = async (e: FormEvent) => {
    e.preventDefault();

    const idValue = formData.id.trim() || getUniqueCollectorId();
    const nextErrors: { id?: string; name?: string; zone?: string; password?: string } = {};
    if (!idValue) {
      nextErrors.id = 'Collector ID is required';
    } else if (collectors.some((collector) => collector.id.toUpperCase() === idValue.toUpperCase())) {
      nextErrors.id = 'This ID is already in use.';
    }
    if (!formData.name.trim()) {
      nextErrors.name = 'Full name is required';
    }
    if (!formData.zone.trim()) {
      nextErrors.zone = 'Assigned area is required';
    }
    if (formData.password && formData.password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters';
    }

    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const newCollector: GarbageCollector = {
      id: idValue,
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      zone: formData.zone.trim(),
      birthdate: formData.birthdate,
      joinDate: new Date().toISOString().split('T')[0],
      status: 'active',
      ...(formData.password ? { password: formData.password } : {}),
    };

    let account: any;
    try {
      account = await adminApi.createCollector({ collectorId: idValue, fullName: formData.name.trim(), assignedArea: formData.zone.trim(), birthdate: formData.birthdate || undefined, contactNumber: formData.phone.trim() || undefined, password: formData.password });
    } catch (error) {
      if (error instanceof ApiError && error.errors && error.errors.length > 0) {
        const serverErrors: { id?: string; name?: string; zone?: string; password?: string } = {};
        for (const err of error.errors) {
          if (err.field === 'collectorId') serverErrors.id = err.message;
          else if (err.field === 'fullName') serverErrors.name = err.message;
          else if (err.field === 'assignedArea') serverErrors.zone = err.message;
          else if (err.field === 'password') serverErrors.password = err.message;
        }
        setFormErrors(serverErrors);
        setToastMessage('Validation failed. Please correct the highlighted fields.');
      } else {
        setToastMessage(error instanceof Error ? error.message : 'Unable to create collector.');
      }
      return;
    }
    const { password: _password, ...collectorWithoutPassword } = newCollector;
    const savedCollector: GarbageCollector = { ...collectorWithoutPassword, id: account.collectorId, name: account.fullName, phone: account.contactNumber ?? '', zone: account.assignedArea, joinDate: account.joinDate, status: account.status };
    const updatedCollectors = [...collectors.filter((collector) => collector.id !== idValue), savedCollector];
    setCollectors(updatedCollectors);
    setSelectedCollector(savedCollector);

    resetFormState();
    setSelectedCollector(newCollector);
    setToastMessage('Garbage Collector added successfully');
    setTimeout(() => setToastMessage(null), 2200);
  };

  const handleEdit = (collector: GarbageCollector) => {
    setSelectedCollector(collector);
    setOriginalCollectorId(collector.id);
    setFormData({
      id: collector.id,
      name: collector.name,
      email: collector.email,
      phone: collector.phone,
      zone: collector.zone,
      birthdate: collector.birthdate ?? '',
      password: collector.password ?? '',
    });
    setFormErrors({});
    setShowPassword(false);
    setIsEditing(true);
    setShowForm(true);
  };

  const handleEditCollector = async (e: FormEvent) => {
    e.preventDefault();

    if (!selectedCollector) return;

    const currentCollectorId = originalCollectorId ?? selectedCollector.id;
    const nextErrors: { id?: string; name?: string; zone?: string; birthdate?: string; password?: string } = {};
    if (!formData.id.trim()) {
      nextErrors.id = 'Collector ID is required';
    } else if (
      collectors.some(
        (collector) => collector.id.toUpperCase() === formData.id.trim().toUpperCase() && collector.id !== currentCollectorId
      )
    ) {
      nextErrors.id = 'This ID is already in use.';
    }
    if (!formData.name.trim()) {
      nextErrors.name = 'Full name is required';
    }
    if (!formData.zone.trim()) {
      nextErrors.zone = 'Assigned area is required';
    }
    if (formData.password && formData.password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters';
    }

    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const collectorDbId = selectedCollector.dbId || selectedCollector.id;
    try {
      const account: any = await adminApi.updateCollector(collectorDbId, {
        collectorId: formData.id.trim(),
        fullName: formData.name.trim(),
        assignedArea: formData.zone.trim(),
        contactNumber: formData.phone.trim() || undefined,
        birthdate: formData.birthdate || undefined,
        password: formData.password || undefined,
      });

      const updatedCollector: GarbageCollector = {
        ...selectedCollector,
        id: account.collectorId,
        dbId: account.id,
        name: account.fullName,
        phone: account.contactNumber ?? '',
        zone: account.assignedArea,
        birthdate: account.birthdate ?? formData.birthdate,
        password: account.password ?? formData.password,
        status: account.status,
      };

      const updatedCollectors = collectors.map((collector) =>
        collector.id === currentCollectorId ? updatedCollector : collector
      );

      setCollectors(updatedCollectors);
      setSelectedCollector(updatedCollector);
      resetFormState();
      setShowUpdateSuccess(true);
      setToastMessage('Garbage Collector updated successfully');
      setTimeout(() => {
        setToastMessage(null);
        setShowUpdateSuccess(false);
      }, 2200);
    } catch (error) {
      if (error instanceof ApiError && error.errors && error.errors.length > 0) {
        const serverErrors: { id?: string; name?: string; zone?: string; birthdate?: string; password?: string } = {};
        for (const err of error.errors) {
          if (err.field === 'collectorId') serverErrors.id = err.message;
          else if (err.field === 'fullName') serverErrors.name = err.message;
          else if (err.field === 'assignedArea') serverErrors.zone = err.message;
          else if (err.field === 'password') serverErrors.password = err.message;
        }
        setFormErrors(serverErrors);
        setToastMessage('Validation failed. Please correct the highlighted fields.');
      } else {
        setToastMessage(error instanceof Error ? error.message : 'Unable to update collector.');
      }
    }
  };

  const handleArchiveCollector = () => {
    if (!selectedCollector) return;

    const isRestoring = selectedCollector.status === 'archived';
    const nextStatus: GarbageCollector['status'] = isRestoring ? (selectedCollector.previousStatus ?? 'active') : 'archived';
    const nextPreviousStatus: 'active' | 'inactive' | 'archived' | undefined = isRestoring ? (selectedCollector.previousStatus ?? 'active') : selectedCollector.status;

    const updatedCollectors = collectors.map((collector) =>
      collector.id === selectedCollector.id ? { ...collector, status: nextStatus, previousStatus: nextPreviousStatus } : collector
    );

    const updatedSelectedCollector = updatedCollectors.find((collector) => collector.id === selectedCollector.id);

    setCollectors(updatedCollectors);
    localStorage.setItem('garbageCollectors', JSON.stringify(updatedCollectors));
    setSelectedCollector(updatedSelectedCollector ?? { ...selectedCollector, status: nextStatus, previousStatus: nextPreviousStatus });
    setShowArchiveConfirm(false);
    setShowUpdateSuccess(true);
    const message = isRestoring ? 'Garbage Collector restored successfully' : 'Garbage Collector archived successfully';
    setToastMessage(message);
    addActivity(`${adminUser?.name || 'Admin User'} ${isRestoring ? 'restored' : 'archived'} garbage collector ${selectedCollector.name} — ${formatActivityTimestamp(new Date())}`, adminUser?.name || 'Admin User', 'Account Update');
    setTimeout(() => {
      setToastMessage(null);
      setShowUpdateSuccess(false);
    }, 2200);
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 to-green-100">
        <div className="text-center">
          <p className="text-lg text-gray-600">Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 to-green-100">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="mb-2 text-3xl font-bold text-gray-800">Garbage Collectors Management</h2>
            <p className="text-gray-600">Manage and monitor all garbage collector accounts</p>
          </div>
          <button
            onClick={() => {
              if (showForm) {
                resetFormState();
                return;
              }
              openCreateCollectorModal();
            }}
            className="rounded-lg bg-green-600 px-6 py-3 font-semibold text-white transition hover:bg-green-700"
          >
            {showForm ? 'Cancel' : '+ Add Collector'}
          </button>
        </div>

        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="fixed inset-0 bg-black/50" onClick={resetFormState} />
            <div className="relative z-10 w-full max-w-3xl rounded-[28px] bg-white p-6 shadow-2xl sm:p-8">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-semibold text-gray-900">{isEditing ? 'Edit Garbage Collector' : 'Create New Garbage Collector Account'}</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {isEditing ? 'Update the collector profile and account details.' : 'Add a new collector profile and generate access details.'}
                  </p>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-green-100 bg-green-50 text-green-700">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 11c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zM6 20v-1a4 4 0 014-4h4a4 4 0 014 4v1" />
                  </svg>
                </div>
              </div>

              <form onSubmit={isEditing ? handleEditCollector : handleAddCollector} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Collector ID Number</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={formData.id}
                      onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                      className={`w-full rounded-2xl border px-4 py-3 text-sm text-gray-700 outline-none transition ${
                        isEditing
                          ? 'border-green-100 bg-green-50 focus:border-green-400 focus:ring-2 focus:ring-green-100'
                          : 'border-gray-200 bg-gray-100'
                      }`}
                      readOnly={!isEditing}
                      disabled={!isEditing}
                    />
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, id: getUniqueCollectorId() }))}
                        className="rounded-2xl border border-green-100 bg-white px-4 py-2 text-sm font-semibold text-green-700 transition hover:bg-green-50"
                      >
                        Regenerate
                      </button>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-xs text-gray-500">
                    <p>{isEditing ? 'Edit the existing collector ID.' : 'Auto-generated ID.'}</p>
                    {!isEditing && <span>Generated on form open.</span>}
                  </div>
                  {formErrors.id && <p className="mt-2 text-sm text-rose-600">{formErrors.id}</p>}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Full Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-2xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-gray-700 placeholder-gray-400 outline-none transition focus:border-green-400 focus:ring-2 focus:ring-green-100"
                    placeholder="Enter full name"
                  />
                  {formErrors.name && <p className="mt-2 text-sm text-rose-600">{formErrors.name}</p>}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Assigned Purok/Area</label>
                  <input
                    type="text"
                    list="zone-options"
                    value={formData.zone}
                    onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                    className="w-full rounded-2xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-gray-700 placeholder-gray-400 outline-none transition focus:border-green-400 focus:ring-2 focus:ring-green-100"
                    placeholder="Enter assigned purok or area"
                  />
                  <datalist id="zone-options">
                    <option value="Purok 1" />
                    <option value="Purok 2" />
                    <option value="Purok 3" />
                    <option value="Purok 4" />
                    <option value="Route A" />
                    <option value="Route B" />
                  </datalist>
                  {formErrors.zone && <p className="mt-2 text-sm text-rose-600">{formErrors.zone}</p>}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Birthdate</label>
                  <input
                    type="date"
                    value={formData.birthdate}
                    onChange={(e) => setFormData({ ...formData, birthdate: e.target.value })}
                    className="w-full rounded-2xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-gray-700 outline-none transition focus:border-green-400 focus:ring-2 focus:ring-green-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full rounded-2xl border border-green-100 bg-green-50 px-4 py-3 pr-12 text-sm text-gray-700 placeholder-gray-400 outline-none transition focus:border-green-400 focus:ring-2 focus:ring-green-100"
                      placeholder={isEditing ? 'Enter password' : 'Set a password'}
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
                    {isEditing ? 'Save Changes' : 'Create Account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="overflow-hidden rounded-[28px] border border-green-100 bg-white shadow-[0_20px_60px_rgba(20,83,45,0.08)]">
              <div className="border-b border-gray-100 p-6">
                <h3 className="text-xl font-semibold text-gray-900">All Garbage Collectors ({visibleCollectors.length})</h3>
                <p className="mt-1 text-sm text-gray-500">Select a collector to review the full profile.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(['all','active','inactive'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setStatusFilter(filter)}
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
                <table className="w-full min-w-[720px] text-sm text-gray-600">
                  <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-[0.2em] text-gray-500">
                    <tr>
                      <th className="px-4 py-3 sm:px-6">Collector ID</th>
                      <th className="px-4 py-3 sm:px-6">Name</th>
                      <th className="px-4 py-3 sm:px-6">Assigned Area</th>
                      <th className="px-4 py-3 sm:px-6">Status</th>
                      <th className="px-4 py-3 sm:px-6">Join Date</th>
                      <th className="px-4 py-3 sm:px-6">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCollectors.map((collector, index) => (
                      <tr key={collector.id} className={index % 2 === 0 ? 'bg-white' : 'bg-green-50/40'}>
                        <td className="px-4 py-4 text-sm text-gray-600 sm:px-6">{collector.id}</td>
                        <td className="px-4 py-4 text-sm font-semibold text-gray-900 sm:px-6">{collector.name}</td>
                        <td className="px-4 py-4 text-sm text-gray-800 sm:px-6">{collector.zone}</td>
                        <td className="px-4 py-4 text-sm sm:px-6">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                              collector.status === 'active'
                                ? 'bg-green-100 text-green-800'
                                : collector.status === 'archived'
                                ? 'bg-gray-200 text-gray-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {collector.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-800 sm:px-6">{new Date(collector.joinDate).toLocaleDateString()}</td>
                        <td className="px-4 py-4 sm:px-6">
                          <button
                            onClick={() => {
                              setSelectedCollector(collector);
                              setShowQR(false);
                            }}
                            className="inline-flex items-center rounded-full border border-green-200 px-3 py-1.5 text-sm font-semibold text-green-700 transition hover:bg-green-50"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            {selectedCollector ? (
              <div className="rounded-[28px] border border-green-100 bg-white p-6 shadow-[0_20px_60px_rgba(20,83,45,0.08)]">
                <div className="rounded-[24px] border border-green-100 bg-green-50/70 p-4">
                  <h3 className="text-xl font-semibold text-gray-900">{selectedCollector.name}</h3>
                  <p className="mt-1 text-sm text-gray-600">Collector profile overview</p>
                </div>

                <div className="mt-5 space-y-4">
                  <div>
                    <p className="text-sm text-gray-500">Collector ID</p>
                    <p className="mt-1 font-semibold text-gray-900">{selectedCollector.id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Assigned Area</p>
                    <p className="mt-1 font-semibold text-gray-900">{selectedCollector.zone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Contact Number</p>
                    <p className="mt-1 font-semibold text-gray-900">{selectedCollector.phone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Birthdate</p>
                    <p className="mt-1 font-semibold text-gray-900">
                      {selectedCollector.birthdate ? new Date(`${selectedCollector.birthdate}T00:00:00`).toLocaleDateString() : 'Not provided'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Join Date</p>
                    <p className="mt-1 font-semibold text-gray-900">{new Date(selectedCollector.joinDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <span
                      className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        selectedCollector.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : selectedCollector.status === 'archived'
                          ? 'bg-gray-200 text-gray-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {selectedCollector.status}
                    </span>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <button
                    onClick={() => setShowQR(!showQR)}
                    className="w-full rounded-2xl bg-green-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-700"
                  >
                    {showQR ? 'Hide QR Code' : 'Show QR Code'}
                  </button>

                  <button
                    onClick={() => handleEdit(selectedCollector)}
                    className="w-full rounded-2xl border border-green-200 bg-white px-4 py-3 text-sm font-semibold text-green-700 transition hover:bg-green-50"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => setShowArchiveConfirm(true)}
                    className="w-full rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-600"
                  >
                    {selectedCollector.status === 'archived' ? 'Unarchive' : 'Archive'}
                  </button>
                </div>

                {showQR && (
                  <div className="mt-6 flex justify-center rounded-[24px] border border-gray-100 bg-gray-50 p-4">
                    <QRCodeSVG id={`qr-collector-${selectedCollector.id}`} value={`collector-${selectedCollector.id}`} size={180} />
                  </div>
                )}

                <button
                  onClick={() => setShowHistoryModal(true)}
                  className="mt-3 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
                >
                  View History
                </button>
              </div>
            ) : (
              <div className="rounded-[28px] border border-green-100 bg-white p-6 text-center text-sm text-gray-500 shadow-[0_20px_60px_rgba(20,83,45,0.08)]">
                <p>Select a collector to view details.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={showArchiveConfirm}
        title={selectedCollector?.status === 'archived' ? 'Restore Collector?' : 'Archive Collector?'}
        message={
          selectedCollector?.status === 'archived'
            ? `Restore ${selectedCollector.name} to their previous status?`
            : `Are you sure you want to archive ${selectedCollector?.name || 'this collector'}? They will no longer be able to log in, but their records will be preserved.`
        }
        actions={[
          { label: 'Cancel', onClick: () => setShowArchiveConfirm(false) },
          { label: selectedCollector?.status === 'archived' ? 'Restore' : 'Confirm Archive', onClick: handleArchiveCollector, variant: 'primary' },
        ]}
      />

      <Modal
        open={showHistoryModal}
        title="Collector Activity History"
        message="Recent collection and attendance history for this collector."
        actions={[{ label: 'Close', onClick: () => setShowHistoryModal(false) }]}
      >
        <div className="mt-4 rounded-2xl bg-gray-50 p-4 text-sm text-gray-600">
          No historical records available in this demo.
        </div>
      </Modal>

      {toastMessage && (
        <div className="fixed right-4 top-4 z-[60] rounded-2xl border border-green-200 bg-white px-4 py-3 text-sm font-semibold text-green-700 shadow-lg">
          {toastMessage}
        </div>
      )}

      <Modal
        open={showUpdateSuccess}
        title="Collector Updated"
        message="Garbage collector information has been updated successfully."
        actions={[{ label: 'OK', onClick: () => setShowUpdateSuccess(false) }]}
      />
    </main>
  );
}
