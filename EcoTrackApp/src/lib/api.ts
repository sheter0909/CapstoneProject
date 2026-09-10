const configuredApiUrl = (process.env.EXPO_PUBLIC_API_URL ?? 'https://capstoneproject-oksk.onrender.com/api').replace(/\/+$/, '');
const API_URL = configuredApiUrl.endsWith('/api') ? configuredApiUrl : `${configuredApiUrl}/api`;

export function getApiBaseUrl(): string {
  return API_URL;
}

let apiBaseLogged = false;
function logApiBaseOnce() {
  if (!apiBaseLogged && (globalThis as { __DEV__?: boolean }).__DEV__) {
    apiBaseLogged = true;
    console.warn(`[EcoTrack] API base URL resolved to: ${API_URL}`);
  }
}
const REQUEST_TIMEOUT_MS = 90_000;

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
  householdId?: string | null;
  collectorId?: string | null;
  senderId: string;
  senderRole: string;
  senderName: string;
  recipientType: string;
  title: string;
  message: string;
  level: string;
  read: boolean;
  createdAt: string;
};

export type SendNotificationBody = {
  title: string;
  message: string;
  recipientType: 'household' | 'collector' | 'all-households' | 'all-collectors';
  householdId?: string;
  collectorId?: string;
  level?: string;
};

const RETRY_DELAYS_MS = [5_000, 15_000, 30_000];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = options.method ?? 'GET';
  let lastError: Error | null = null;
  logApiBaseOnce();

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    let response: Response;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      response = await fetch(`${API_URL}${path}`, {
        ...options,
        signal: options.signal ?? controller.signal,
        headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}), ...authHeader() },
      });
    } catch {
      lastError = new Error(`Unable to connect to backend server at ${API_URL}. Please make sure the backend is running.`);
      if (attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw lastError;
    } finally {
      clearTimeout(timeout);
    }

    let payload: ApiResponse<T> | null = null;
    try {
      payload = (await response.json()) as ApiResponse<T>;
    } catch {
      payload = null;
    }

    if (response.ok && payload?.success) return payload.data;

    // The backend answered with an explicit error — final, do not retry.
    if (payload?.message) throw new Error(payload.message);

    // No usable message (e.g. a proxy/idle-server HTML page): transient, retry.
    lastError = new Error(`API request failed (${response.status} ${method} ${API_URL}${path})`);
    if ((globalThis as { __DEV__?: boolean }).__DEV__) {
      console.warn(`[EcoTrack] ${method} ${API_URL}${path} -> HTTP ${response.status} with non-JSON body. Check EXPO_PUBLIC_API_URL.`);
    }
    if (attempt < RETRY_DELAYS_MS.length) {
      await sleep(RETRY_DELAYS_MS[attempt]);
      continue;
    }
    throw lastError;
  }

  throw lastError ?? new Error('API request failed.');
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
  sendNotification: (body: SendNotificationBody) =>
    apiRequest<NotificationItem>('/notifications', { method: 'POST', body: JSON.stringify(body) }),
  markNotificationRead: (id: string) =>
    apiRequest<NotificationItem>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' }),
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
  notifications: () => apiRequest<NotificationItem[]>('/collectors/me/notifications'),
  sendNotification: (body: SendNotificationBody) =>
    apiRequest<NotificationItem>('/notifications', { method: 'POST', body: JSON.stringify(body) }),
  markNotificationRead: (id: string) =>
    apiRequest<NotificationItem>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' }),
};
