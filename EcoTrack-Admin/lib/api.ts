const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'https://capstoneproject-oksk.onrender.com/api';
const API_URL = configuredApiUrl.replace(/\/+$/, '').endsWith('/api')
  ? configuredApiUrl.replace(/\/+$/, '')
  : `${configuredApiUrl.replace(/\/+$/, '')}/api`;
const REQUEST_TIMEOUT_MS = 90_000;

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

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
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
    throw new ApiError(
      `Unable to connect to backend server (${API_URL}). The server may be waking up from an idle state — please wait up to 60 seconds and try again. If the problem persists, verify that the backend is running.`,
      503,
    );
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
};
