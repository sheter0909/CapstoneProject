const configuredApiUrl = (process.env.EXPO_PUBLIC_API_URL ?? 'https://capstoneproject-oksk.onrender.com/api').replace(/\/+$/, '');
const API_URL = configuredApiUrl.endsWith('/api') ? configuredApiUrl : `${configuredApiUrl}/api`;

let apiBaseLogged = false;
function logApiBaseOnce() {
  if (!apiBaseLogged && (globalThis as { __DEV__?: boolean }).__DEV__) {
    apiBaseLogged = true;
    console.warn(`[EcoTrack] API base URL resolved to: ${API_URL}`);
  }
}
const REQUEST_TIMEOUT_MS = 60_000;
export const API_BASE_URL = API_URL;

export type ApiResponse<T> = { success: boolean; data: T; message?: string; errors?: FieldError[] | unknown; code?: string };

export type LoginErrorCode = 'WRONG_PASSWORD' | 'ACCOUNT_NOT_FOUND';

export type FieldError = {
  field: string;
  message: string;
};

export class ApiError extends Error {
  status: number;
  errors?: FieldError[];
  code?: string;

  constructor(message: string, status: number, errors?: FieldError[], code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
    this.code = code;
  }
}

function toFieldErrors(value: unknown): FieldError[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const parsed = (value as unknown[]).filter(
    (item): item is FieldError =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as { message?: unknown }).message === 'string'
  );
  return parsed.length > 0 ? parsed : undefined;
}

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

export type CollectionWarning = {
  level: string;
  count: number;
};

export type CollectionHistoryItem = {
  id: string;
  householdId: string;
  collectorId: string;
  segregationStatus: 'segregated' | 'not_segregated';
  wasteType: 'biodegradable' | 'recyclable' | 'non_biodegradable' | 'mixed';
  weightKg: number | string;
  timestamp: string;
  editedAt?: string | null;
  warning?: CollectionWarning | null;
  warningRemoved?: boolean;
  editable?: boolean;
  editableUntil?: string;
};

export type HouseholdSummary = {
  household: HouseholdUser | null;
  history: CollectionHistoryItem[];
  notSegregatedCount: number;
  nextWarningLevel: string;
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
  recipientType: 'household' | 'collector' | 'admin' | 'all-households' | 'all-collectors';
  householdId?: string;
  collectorId?: string;
  level?: string;
};

const RETRY_DELAYS_MS = [3_000];

export const SERVER_WAKING_MESSAGE = 'Server is waking up, please try again in a few seconds.';

function toFriendlyNetworkMessage(): string {
  return SERVER_WAKING_MESSAGE;
}

function logRequestError(method: string, url: string, info: string) {
  // Real diagnostics: status code / body / network error for debugging.
  console.warn(`[EcoTrack] ${method} ${url} failed: ${info}`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type ApiRequestOptions = RequestInit & { portal?: ApiPortal };

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const portal = options.portal;
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
        headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}), ...authHeader(portal) },
      });
    } catch (err) {
      const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      logRequestError(method, `${API_URL}${path}`, detail);
      lastError = new Error(toFriendlyNetworkMessage());
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

    const fieldErrors = toFieldErrors(payload?.errors);
    // Client errors (4xx) are final — do not retry.
    if (response.status >= 400 && response.status < 500) {
      const message = fieldErrors?.[0]?.message ?? payload?.message ?? `API request failed (${response.status} ${method} ${path})`;
      logRequestError(method, `${API_URL}${path}`, `HTTP ${response.status}: ${message}`);
      if (response.status === 401) unauthorizedHandler?.(portal);
      throw new ApiError(message, response.status, fieldErrors, payload?.code);
    }

    // The backend answered with an explicit error — final, do not retry.
    // Server message is surfaced as-is so 4xx/5xx show what the server said.
    if (payload?.message) {
      const message = fieldErrors?.[0]?.message ?? payload.message;
      logRequestError(method, `${API_URL}${path}`, `HTTP ${response.status}: ${message}`);
      throw new ApiError(message, response.status, fieldErrors, payload?.code);
    }

    // No usable message (e.g. a proxy/idle-server HTML page): transient, retry once.
    lastError = new Error(toFriendlyNetworkMessage());
    logRequestError(method, `${API_URL}${path}`, `HTTP ${response.status} with non-JSON body`);
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

// One token slot per portal: a household JWT must never be attached to a
// collector request (or vice versa), even though both portals share one origin
// and one AsyncStorage on web.
export type ApiPortal = 'household' | 'collector';

const portalTokens: Record<ApiPortal, string | null> = { household: null, collector: null };

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (padded.length % 4)) % 4;
  return atob(padded + '='.repeat(padLength));
}

// Reads the `role` claim without verifying (verification stays server-side).
// Returns null for malformed tokens or non-portal roles (e.g. admin).
export function decodeTokenRole(token: string): ApiPortal | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(base64UrlDecode(parts[1])) as { role?: unknown };
    return payload.role === 'household' || payload.role === 'collector' ? payload.role : null;
  } catch {
    return null;
  }
}

export function setApiToken(portal: ApiPortal, value: string | null) {
  // Defense in depth: refuse to store a token whose role belongs to the other
  // portal, so a mix-up at the call site can never leak across portals.
  if (value && decodeTokenRole(value) !== null && decodeTokenRole(value) !== portal) return;
  portalTokens[portal] = value;
}
export function clearApiToken(portal: ApiPortal) { portalTokens[portal] = null; }
function authHeader(portal: ApiPortal | undefined): Record<string, string> {
  const token = portal ? portalTokens[portal] : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Central 401 hook: the auth context registers a per-portal logout here so an
// expired or revoked token can't leave a portal in a fake-authenticated state.
// Only the portal whose token failed is logged out; the other portal's session
// is left untouched.
let unauthorizedHandler: ((portal: ApiPortal | undefined) => void) | null = null;
export function onUnauthorized(handler: ((portal: ApiPortal | undefined) => void) | null) { unauthorizedHandler = handler; }

// Portal-scoped request helpers: every call through householdApi attaches only
// the household token, every call through collectorApi only the collector token.
function householdRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  return apiRequest<T>(path, { ...options, portal: 'household' });
}
function collectorRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  return apiRequest<T>(path, { ...options, portal: 'collector' });
}

export const householdApi = {
  login: (identifier: string, password: string) =>
    householdRequest<{ token: string; account: HouseholdUser }>('/auth/household/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    }),
  profile: () => householdRequest<HouseholdUser>('/households/me'),
  history: () => householdRequest<CollectionHistoryItem[]>('/households/me/history'),
  notifications: () => householdRequest<NotificationItem[]>('/households/me/notifications'),
  sendNotification: (body: SendNotificationBody) =>
    householdRequest<NotificationItem>('/notifications', { method: 'POST', body: JSON.stringify(body) }),
  markNotificationRead: (id: string) =>
    householdRequest<NotificationItem>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' }),
  forgotPassword: (identifier: string, birthdate: string) =>
    householdRequest<{ resetToken: string; accountId: string }>('/auth/household/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ identifier, birthdate }),
    }),
  resetPassword: (resetToken: string, password: string) =>
    householdRequest<null>('/auth/household/reset-password', {
      method: 'POST',
      body: JSON.stringify({ resetToken, password }),
    }),
};

export const collectorApi = {
  login: (identifier: string, password: string) =>
    collectorRequest<{ token: string; account: CollectorUser }>('/auth/collector/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    }),
  forgotPassword: (identifier: string, birthdate: string) =>
    collectorRequest<{ resetToken: string }>('/auth/collector/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ identifier, birthdate }),
    }),
  resetPassword: (resetToken: string, password: string) =>
    collectorRequest<null>('/auth/collector/reset-password', {
      method: 'POST',
      body: JSON.stringify({ resetToken, password }),
    }),
  // Shared by the QR scan flow and the manual Household ID flow: one endpoint,
  // one shape. The ID stays a string end-to-end — never Number() it, or
  // leading zeros ("011704") would be destroyed before the request is sent.
  householdSummary: (id: string) =>
    collectorRequest<HouseholdSummary>(
      `/collector/households/lookup?householdId=${encodeURIComponent(id.trim())}`
    ),
  submitCollection: (body: unknown) =>
    collectorRequest<CollectionHistoryItem>('/collections', { method: 'POST', body: JSON.stringify(body) }),
  updateCollection: (id: string, body: unknown) =>
    collectorRequest<CollectionHistoryItem>(`/collections/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  activityLogs: () => collectorRequest<{ items: CollectionHistoryItem[]; total: number; page: number; totalPages: number }>('/collectors/me/activity-logs'),
  reports: () => collectorRequest<{ _id: string; totalKg: number; entries: number }[]>('/collectors/me/reports'),
  notifications: () => collectorRequest<NotificationItem[]>('/collectors/me/notifications'),
  sendNotification: (body: SendNotificationBody) =>
    collectorRequest<NotificationItem>('/notifications', { method: 'POST', body: JSON.stringify(body) }),
  markNotificationRead: (id: string) =>
    collectorRequest<NotificationItem>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' }),
};
