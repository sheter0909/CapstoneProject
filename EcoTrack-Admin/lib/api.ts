const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'https://capstoneproject-oksk.onrender.com/api';
const API_URL = configuredApiUrl.replace(/\/+$/, '').endsWith('/api')
  ? configuredApiUrl.replace(/\/+$/, '')
  : `${configuredApiUrl.replace(/\/+$/, '')}/api`;
const REQUEST_TIMEOUT_MS = 90_000;
const RETRY_DELAYS_MS = [5_000, 15_000, 30_000];
const MAX_RETRIES = RETRY_DELAYS_MS.length;
const CONNECT_ERROR_STATUS = 503;

export interface FieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  status: number;
  errors?: FieldError[];

  constructor(message: string, status: number, errors?: FieldError[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

type ApiResponse<T> = { success: boolean; data: T; message?: string; errors?: FieldError[] | unknown };

export type ApiConnectingState = {
  status: 'idle' | 'connecting';
  attempt: number;
  totalRetries: number;
  path: string;
};

export interface CollectorCollectionRecord {
  id: string;
  householdId: string;
  collectorId: string;
  segregationStatus: 'segregated' | 'not_segregated';
  wasteType: 'biodegradable' | 'recyclable' | 'non_biodegradable';
  weightKg: number;
  timestamp: string;
  editedAt?: string | null;
  householdName: string;
  householdPurok: string;
  householdAddress: string;
}

export interface CollectorCollectionHistory {
  collector: { collectorId: string; fullName: string };
  collections: CollectorCollectionRecord[];
}

let connectingState: ApiConnectingState = { status: 'idle', attempt: 0, totalRetries: MAX_RETRIES, path: '' };
const connectingListeners = new Set<(state: ApiConnectingState) => void>();

export function getApiConnectingState(): ApiConnectingState {
  return connectingState;
}

export function subscribeApiConnecting(listener: (state: ApiConnectingState) => void): () => void {
  connectingListeners.add(listener);
  return () => {
    connectingListeners.delete(listener);
  };
}

function setConnectingState(state: ApiConnectingState) {
  connectingState = state;
  connectingListeners.forEach((listener) => listener(state));
}

function idleState(): ApiConnectingState {
  return { status: 'idle', attempt: 0, totalRetries: MAX_RETRIES, path: '' };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestOnce<T>(path: string, options: RequestInit): Promise<T> {
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
    throw new ApiError('Unable to reach the server. Please check your internet connection and try again.', CONNECT_ERROR_STATUS);
  } finally {
    clearTimeout(timeout);
  }

  let payload: ApiResponse<T> | null = null;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    payload = null;
  }

  if (response.status === 401 && !path.startsWith('/auth/') && typeof window !== 'undefined') {
    window.localStorage.removeItem('authToken');
    window.localStorage.removeItem('adminUser');
    window.location.assign(`/login?message=${encodeURIComponent('Your session has expired, please log in again.')}`);
    throw new ApiError('Your session has expired, please log in again.', 401);
  }

  if (!response.ok || !payload?.success) {
    const errorMsg = payload?.message ?? `API request failed (${response.status} ${response.statusText}).`;
    const fieldErrors = Array.isArray(payload?.errors) ? (payload.errors as FieldError[]) : undefined;
    throw new ApiError(errorMsg, response.status, fieldErrors);
  }

  return payload.data;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const data = await requestOnce<T>(path, options);
      setConnectingState(idleState());
      return data;
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError('Unexpected error.', CONNECT_ERROR_STATUS);

      // Validation, auth, and other server responses are final — do not retry.
      if (apiError.status !== CONNECT_ERROR_STATUS) throw error;

      if (attempt >= MAX_RETRIES) {
        setConnectingState(idleState());
        throw new ApiError(
          "We couldn't reach the server after several attempts. Please check your internet connection and try again.",
          CONNECT_ERROR_STATUS,
        );
      }

      setConnectingState({ status: 'connecting', attempt: attempt + 1, totalRetries: MAX_RETRIES, path });
      await delay(RETRY_DELAYS_MS[attempt]);
    }
  }

  throw new ApiError("We couldn't reach the server after several attempts. Please try again.", CONNECT_ERROR_STATUS);
}

function authHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = window.localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const adminApi = {
  apiRequest,
  login: (identifier: string, password: string) => apiRequest<{ token: string; account: unknown }>('/auth/admin/login', { method: 'POST', body: JSON.stringify({ identifier, password }) }),
  createHousehold: (body: unknown) => apiRequest<unknown>('/households', { method: 'POST', body: JSON.stringify(body) }),
  updateHousehold: (id: string, body: unknown) => apiRequest<unknown>(`/households/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(body) }),
  createCollector: (body: unknown) => apiRequest<unknown>('/collectors', { method: 'POST', body: JSON.stringify(body) }),
  updateCollector: (id: string, body: unknown) => apiRequest<unknown>(`/collectors/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(body) }),
  households: (query = '') => apiRequest<unknown>(`/households${query}`),
  collectors: (query = '') => apiRequest<unknown>(`/collectors${query}`),
  dashboardStats: () => apiRequest<unknown>('/dashboard/stats'),
  recentActivity: () => apiRequest<unknown>('/dashboard/recent-activity'),
  householdCollections: (id: string) => apiRequest<unknown[]>(`/households/${encodeURIComponent(id)}/collections`),
  collectorCollections: (id: string) => apiRequest<CollectorCollectionHistory>(`/collectors/${encodeURIComponent(id)}/collections`),
  reportSummary: () => apiRequest<{ totalHouseholds: number; activeCollectors: number; wasteCollected: number; recycledRate: number }>('/reports/summary'),
  reportWeeklyCollection: () => apiRequest<{ _id: string; totalKg: number }[]>('/reports/weekly-collection'),
  reportWasteTypeDistribution: () => apiRequest<{ _id: string; weightKg: number }[]>('/reports/waste-type-distribution'),
  reportMonthlyPerformance: () => apiRequest<{ _id: string; totalKg: number }[]>('/reports/monthly-performance'),
};