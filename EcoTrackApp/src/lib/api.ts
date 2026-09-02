const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export type ApiResponse<T> = { success: boolean; data: T; message?: string; errors?: unknown };

export type HouseholdUser = {
  id: string;
  householdId: string;
  fullName: string;
  purok?: string;
  address?: string;
  birthdate?: string;
  status?: 'active' | 'inactive' | 'archived';
  joinDate?: string;
  lastCollection?: string;
};

export type CollectorUser = {
  id: string;
  collectorId: string;
  fullName: string;
  assignedArea?: string;
  contactNumber?: string;
  status?: 'active' | 'inactive' | 'archived';
};

export type CollectionHistoryItem = {
  id: string;
  householdId: string;
  collectorId: string;
  segregationStatus: 'segregated' | 'not_segregated';
  wasteType: 'biodegradable' | 'recyclable' | 'non_biodegradable';
  weightKg: number | string;
  timestamp: string;
  editedAt?: string | null;
};

export type NotificationItem = {
  id: string;
  householdId: string;
  title: string;
  message: string;
  level: string;
  read: boolean;
  createdAt: string;
};

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}), ...authHeader() },
    });
  } catch {
    throw new Error(`Unable to connect to backend server at ${API_URL}. Please make sure the backend is running.`);
  }

  let payload: ApiResponse<T> | null = null;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message ?? `API request failed (${response.status})`);
  }

  return payload.data;
}

let token: string | null = null;
export function setApiToken(value: string | null) { token = value; }
export function getApiToken() { return token; }
function authHeader(): Record<string, string> { return token ? { Authorization: `Bearer ${token}` } : {}; }

export const householdApi = {
  login: (identifier: string, password: string) =>
    apiRequest<{ token: string; account: HouseholdUser }>('/auth/household/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    }),
  profile: () => apiRequest<HouseholdUser>('/households/me'),
  history: () => apiRequest<CollectionHistoryItem[]>('/households/me/history'),
  notifications: () => apiRequest<NotificationItem[]>('/households/me/notifications'),
  forgotPassword: (identifier: string, birthdate: string) =>
    apiRequest<{ resetToken: string; accountId: string }>('/auth/household/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ identifier, birthdate }),
    }),
  resetPassword: (resetToken: string, password: string) =>
    apiRequest<null>('/auth/household/reset-password', {
      method: 'POST',
      body: JSON.stringify({ resetToken, password }),
    }),
};

export const collectorApi = {
  login: (identifier: string, password: string) =>
    apiRequest<{ token: string; account: CollectorUser }>('/auth/collector/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    }),
  forgotPassword: (identifier: string, birthdate: string) =>
    apiRequest<{ resetToken: string }>('/auth/collector/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ identifier, birthdate }),
    }),
  resetPassword: (resetToken: string, password: string) =>
    apiRequest<null>('/auth/collector/reset-password', {
      method: 'POST',
      body: JSON.stringify({ resetToken, password }),
    }),
  householdSummary: (id: string) =>
    apiRequest<{ household: HouseholdUser | null; history: CollectionHistoryItem[] }>(
      `/households/${encodeURIComponent(id)}/summary`
    ),
  submitCollection: (body: unknown) =>
    apiRequest<unknown>('/collections', { method: 'POST', body: JSON.stringify(body) }),
  updateCollection: (id: string, body: unknown) =>
    apiRequest<unknown>(`/collections/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  activityLogs: () => apiRequest<unknown>('/collectors/me/activity-logs'),
  reports: () => apiRequest<unknown>('/collectors/me/reports'),
};
