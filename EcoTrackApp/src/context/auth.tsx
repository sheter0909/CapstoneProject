import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError, clearApiToken, collectorApi, decodeTokenRole, householdApi, CollectorUser, HouseholdUser, LoginErrorCode, onUnauthorized, setApiToken, type ApiPortal } from '@/lib/api';

export type LoginResult = { success: boolean; error?: string; code?: LoginErrorCode; status?: number; network?: boolean };

// Normalizes login failures: machine-readable backend codes are preserved so
// screens can switch on them; transport failures (backend unreachable, timeouts,
// unusable 5xx bodies) are flagged as network errors so screens show a safe
// fallback instead of a misleading credential message.
function toLoginFailure(error: unknown, fallback: string): LoginResult {
  if (error instanceof ApiError) {
    const code = error.code === 'WRONG_PASSWORD' || error.code === 'ACCOUNT_NOT_FOUND' ? error.code : undefined;
    return { success: false, error: error.message || fallback, code, status: error.status };
  }
  return { success: false, network: true };
}

type AuthContextValue = {
  hydrated: boolean;
  householdUser: HouseholdUser | null;
  householdAuthenticated: boolean;
  householdRecoveryVerified: boolean;
  householdResetAccountId: string | null;
  loginHousehold: (householdId: string, password: string) => Promise<LoginResult>;
  verifyHouseholdIdentity: (householdId: string, birthdate: string) => Promise<{ success: boolean; error?: string }>;
  resetHouseholdPassword: (password: string) => Promise<{ success: boolean; error?: string }>;
  refreshHouseholdProfile: () => Promise<void>;
  logoutHousehold: () => void;

  collectorAuthenticated: boolean;
  collectorUser: CollectorUser | null;
  collectorRecoveryVerified: boolean;
  collectorResetAccountId: string | null;
  loginCollector: (collectorId: string, password: string) => Promise<LoginResult>;
  verifyCollectorIdentity: (collectorId: string, birthdate: string) => Promise<boolean>;
  resetCollectorPassword: (password: string) => Promise<{ success: boolean; error?: string }>;
  logoutCollector: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Separate session per portal: each portal stores and attaches only its own
// token, so a household JWT can never be sent from a collector screen.
const HOUSEHOLD_TOKEN_KEY = 'ecotrack.household.token';
const HOUSEHOLD_PROFILE_KEY = 'ecotrack.household.profile';
const COLLECTOR_TOKEN_KEY = 'ecotrack.collector.token';
const COLLECTOR_PROFILE_KEY = 'ecotrack.collector.profile';

// Pre-split keys (one shared TOKEN_KEY for both portals). Read once for
// migration, then deleted so no stale shared token can survive an update.
const LEGACY_TOKEN_KEY = 'ecotrack.auth.token';
const LEGACY_HOUSEHOLD_KEY = 'ecotrack.auth.household';
const LEGACY_COLLECTOR_KEY = 'ecotrack.auth.collector';

function tokenKey(portal: ApiPortal) { return portal === 'household' ? HOUSEHOLD_TOKEN_KEY : COLLECTOR_TOKEN_KEY; }
function profileKey(portal: ApiPortal) { return portal === 'household' ? HOUSEHOLD_PROFILE_KEY : COLLECTOR_PROFILE_KEY; }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [householdUser, setHouseholdUser] = useState<HouseholdUser | null>(null);
  const [householdAuthenticated, setHouseholdAuthenticated] = useState(false);
  const [householdRecoveryVerified, setHouseholdRecoveryVerified] = useState(false);
  const [householdResetToken, setHouseholdResetToken] = useState<string | null>(null);
  const [householdResetAccountId, setHouseholdResetAccountId] = useState<string | null>(null);

  const [collectorAuthenticated, setCollectorAuthenticated] = useState(false);
  const [collectorUser, setCollectorUser] = useState<CollectorUser | null>(null);
  const [collectorRecoveryVerified, setCollectorRecoveryVerified] = useState(false);
  const [collectorResetToken, setCollectorResetToken] = useState<string | null>(null);
  const [collectorResetAccountId, setCollectorResetAccountId] = useState<string | null>(null);

  useEffect(() => {
    async function restoreSession() {
      try {
        const stored = await Promise.all([
          AsyncStorage.getItem(HOUSEHOLD_TOKEN_KEY),
          AsyncStorage.getItem(HOUSEHOLD_PROFILE_KEY),
          AsyncStorage.getItem(COLLECTOR_TOKEN_KEY),
          AsyncStorage.getItem(COLLECTOR_PROFILE_KEY),
          AsyncStorage.getItem(LEGACY_TOKEN_KEY),
          AsyncStorage.getItem(LEGACY_HOUSEHOLD_KEY),
          AsyncStorage.getItem(LEGACY_COLLECTOR_KEY),
        ]);
        let [householdToken, householdProfileRaw, collectorToken, collectorProfileRaw, legacyToken, legacyHousehold, legacyCollector] = stored;

        // One-time migration from the shared-token layout: adopt the legacy
        // token under the portal matching its decoded role (filling only empty
        // slots), carry over legacy profiles the same way, then wipe every
        // legacy key so the stale shared token can never be reused.
        if (legacyToken || legacyHousehold || legacyCollector) {
          const legacyRole = legacyToken ? decodeTokenRole(legacyToken) : null;
          if (legacyToken && legacyRole === 'household' && !householdToken) householdToken = legacyToken;
          if (legacyToken && legacyRole === 'collector' && !collectorToken) collectorToken = legacyToken;
          if (legacyHousehold && !householdProfileRaw) householdProfileRaw = legacyHousehold;
          if (legacyCollector && !collectorProfileRaw) collectorProfileRaw = legacyCollector;
          await Promise.all([
            AsyncStorage.removeItem(LEGACY_TOKEN_KEY),
            AsyncStorage.removeItem(LEGACY_HOUSEHOLD_KEY),
            AsyncStorage.removeItem(LEGACY_COLLECTOR_KEY),
          ]);
        }

        // Role-guard every restored token: a token whose role doesn't match its
        // portal slot is discarded (portal shows its login screen) instead of
        // being attached to API calls that would 403.
        const portals: { portal: ApiPortal; token: string | null; profileRaw: string | null }[] = [
          { portal: 'household', token: householdToken, profileRaw: householdProfileRaw },
          { portal: 'collector', token: collectorToken, profileRaw: collectorProfileRaw },
        ];
        for (const { portal, token, profileRaw } of portals) {
          if (!token || decodeTokenRole(token) !== portal) {
            if (token) {
              await Promise.all([AsyncStorage.removeItem(tokenKey(portal)), AsyncStorage.removeItem(profileKey(portal))]);
            }
            continue;
          }
          setApiToken(portal, token);
          await AsyncStorage.setItem(tokenKey(portal), token);
          if (profileRaw) await AsyncStorage.setItem(profileKey(portal), profileRaw);
          if (portal === 'household') {
            setHouseholdUser(JSON.parse(profileRaw ?? 'null') as HouseholdUser | null);
            setHouseholdAuthenticated(true);
          } else {
            setCollectorUser(JSON.parse(profileRaw ?? 'null') as CollectorUser | null);
            setCollectorAuthenticated(true);
          }
        }
      } catch {
        await Promise.all([
          AsyncStorage.removeItem(HOUSEHOLD_TOKEN_KEY),
          AsyncStorage.removeItem(HOUSEHOLD_PROFILE_KEY),
          AsyncStorage.removeItem(COLLECTOR_TOKEN_KEY),
          AsyncStorage.removeItem(COLLECTOR_PROFILE_KEY),
          AsyncStorage.removeItem(LEGACY_TOKEN_KEY),
          AsyncStorage.removeItem(LEGACY_HOUSEHOLD_KEY),
          AsyncStorage.removeItem(LEGACY_COLLECTOR_KEY),
        ]);
      } finally {
        setHydrated(true);
      }
    }

    restoreSession();
  }, []);

  const loginHousehold = async (householdId: string, password: string) => {
    try {
      const result = await householdApi.login(householdId.trim(), password);
      // Independent session: the collector session (if any) is left untouched,
      // and only the household token is stored/attached from here on.
      setApiToken('household', result.token);
      await Promise.all([
        AsyncStorage.setItem(HOUSEHOLD_TOKEN_KEY, result.token),
        AsyncStorage.setItem(HOUSEHOLD_PROFILE_KEY, JSON.stringify(result.account)),
      ]);

      try {
        const profile = await householdApi.profile();
        if (profile?.fullName && profile.householdId) {
          setHouseholdUser(profile);
          await AsyncStorage.setItem(HOUSEHOLD_PROFILE_KEY, JSON.stringify(profile));
        } else {
          setHouseholdUser(result.account);
        }
      } catch {
        setHouseholdUser(result.account);
      }
      setHouseholdAuthenticated(true);
      return { success: true };
    } catch (error) {
      return toLoginFailure(error, 'Invalid House ID or password.');
    }
  };

  const refreshHouseholdProfile = useCallback(async () => {
    try {
      const profile = await householdApi.profile();
      if (profile?.fullName && profile.householdId) {
        setHouseholdUser(profile);
        await AsyncStorage.setItem(HOUSEHOLD_PROFILE_KEY, JSON.stringify(profile));
      }
    } catch {
      // ignore
    }
  }, []);

  const verifyHouseholdIdentity = async (householdId: string, birthdate: string) => {
    try {
      const result = await householdApi.forgotPassword(householdId.trim(), birthdate.trim());
      setHouseholdResetToken(result.resetToken);
      setHouseholdResetAccountId(result.accountId);
      setHouseholdRecoveryVerified(true);
      return { success: true };
    } catch (error) {
      setHouseholdRecoveryVerified(false);
      return { success: false, error: error instanceof Error ? error.message : 'Household ID and birthdate do not match.' };
    }
  };

  const resetHouseholdPassword = useCallback(async (password: string) => {
    if (!householdResetToken) return { success: false, error: 'Reset session expired. Please verify again.' };
    try {
      await householdApi.resetPassword(householdResetToken, password);
      setHouseholdResetToken(null);
      setHouseholdResetAccountId(null);
      setHouseholdRecoveryVerified(false);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unable to reset password.' };
    }
  }, [householdResetToken]);

  const logoutHousehold = useCallback(() => {
    // Clears only the household session: a collector session on this device
    // stays signed in (separate sessions per portal).
    setHouseholdAuthenticated(false);
    setHouseholdUser(null);
    clearApiToken('household');
    void Promise.all([
      AsyncStorage.removeItem(HOUSEHOLD_TOKEN_KEY),
      AsyncStorage.removeItem(HOUSEHOLD_PROFILE_KEY),
    ]).catch(() => undefined);
  }, []);

  const loginCollector = async (collectorId: string, password: string) => {
    try {
      const result = await collectorApi.login(collectorId.trim(), password);
      // Independent session: the household session (if any) is left untouched,
      // and only the collector token is stored/attached from here on.
      setApiToken('collector', result.token);
      await Promise.all([
        AsyncStorage.setItem(COLLECTOR_TOKEN_KEY, result.token),
        AsyncStorage.setItem(COLLECTOR_PROFILE_KEY, JSON.stringify(result.account)),
      ]);
      setCollectorUser(result.account);
      setCollectorAuthenticated(true);
      return { success: true };
    } catch (error) {
      return toLoginFailure(error, 'Invalid Collector ID or Password.');
    }
  };

  const verifyCollectorIdentity = async (collectorId: string, birthdate: string) => {
    try {
      const normalizedId = collectorId.trim().toUpperCase();
      const result = await collectorApi.forgotPassword(normalizedId, birthdate.trim());
      setCollectorResetToken(result.resetToken);
      setCollectorResetAccountId(normalizedId);
      setCollectorRecoveryVerified(true);
      return true;
    } catch {
      setCollectorResetToken(null);
      setCollectorResetAccountId(null);
      setCollectorRecoveryVerified(false);
      return false;
    }
  };

  const resetCollectorPassword = useCallback(async (password: string) => {
    if (!collectorResetToken) return { success: false, error: 'Reset session expired. Please verify again.' };
    try {
      await collectorApi.resetPassword(collectorResetToken, password);
      setCollectorResetToken(null);
      setCollectorResetAccountId(null);
      setCollectorRecoveryVerified(false);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unable to reset password.' };
    }
  }, [collectorResetToken]);

  const logoutCollector = useCallback(() => {
    // Clears only the collector session: a household session on this device
    // stays signed in (separate sessions per portal).
    setCollectorAuthenticated(false);
    setCollectorUser(null);
    clearApiToken('collector');
    void Promise.all([
      AsyncStorage.removeItem(COLLECTOR_TOKEN_KEY),
      AsyncStorage.removeItem(COLLECTOR_PROFILE_KEY),
    ]).catch(() => undefined);
  }, []);

  // A 401 carries the portal whose token failed: only that portal's session is
  // dropped, so one expired token can't sign the other portal out. The portal
  // guards then redirect to that portal's login screen.
  useEffect(() => {
    onUnauthorized((portal) => {
      if (!portal || portal === 'household') logoutHousehold();
      if (!portal || portal === 'collector') logoutCollector();
    });
    return () => onUnauthorized(null);
  }, [logoutHousehold, logoutCollector]);

  const value = useMemo(
    () => ({
      hydrated,
      householdUser,
      householdAuthenticated,
      householdRecoveryVerified,
      householdResetAccountId,
      loginHousehold,
      verifyHouseholdIdentity,
      resetHouseholdPassword,
      refreshHouseholdProfile,
      logoutHousehold,

      collectorAuthenticated,
      collectorUser,
      collectorRecoveryVerified,
      collectorResetAccountId,
      loginCollector,
      verifyCollectorIdentity,
      resetCollectorPassword,
      logoutCollector,
    }),
    [
      hydrated,
      householdUser,
      householdAuthenticated,
      householdRecoveryVerified,
      householdResetAccountId,
      resetHouseholdPassword,
      refreshHouseholdProfile,
      logoutHousehold,
      collectorAuthenticated,
      collectorUser,
      collectorRecoveryVerified,
      collectorResetAccountId,
      resetCollectorPassword,
      logoutCollector,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
