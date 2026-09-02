import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { collectorApi, householdApi, CollectorUser, HouseholdUser, setApiToken } from '@/lib/api';

type AuthContextValue = {
  hydrated: boolean;
  householdUser: HouseholdUser | null;
  householdAuthenticated: boolean;
  householdRecoveryVerified: boolean;
  householdResetAccountId: string | null;
  loginHousehold: (householdId: string, password: string) => Promise<{ success: boolean; error?: string }>;
  verifyHouseholdIdentity: (householdId: string, birthdate: string) => Promise<{ success: boolean; error?: string }>;
  resetHouseholdPassword: (password: string) => Promise<{ success: boolean; error?: string }>;
  refreshHouseholdProfile: () => Promise<void>;
  logoutHousehold: () => void;

  collectorAuthenticated: boolean;
  collectorUser: CollectorUser | null;
  collectorRecoveryVerified: boolean;
  collectorResetAccountId: string | null;
  loginCollector: (collectorId: string, password: string) => Promise<boolean>;
  verifyCollectorIdentity: (collectorId: string, birthdate: string) => Promise<boolean>;
  resetCollectorPassword: (password: string) => Promise<{ success: boolean; error?: string }>;
  logoutCollector: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = 'ecotrack.auth.token';
const HOUSEHOLD_KEY = 'ecotrack.auth.household';
const COLLECTOR_KEY = 'ecotrack.auth.collector';

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
        const [storedToken, storedHousehold, storedCollector] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(HOUSEHOLD_KEY),
          AsyncStorage.getItem(COLLECTOR_KEY),
        ]);

        if (storedToken) setApiToken(storedToken);
        if (storedHousehold) {
          setHouseholdUser(JSON.parse(storedHousehold) as HouseholdUser);
          setHouseholdAuthenticated(true);
        }
        if (storedCollector) {
          setCollectorUser(JSON.parse(storedCollector) as CollectorUser);
          setCollectorAuthenticated(true);
        }
      } catch {
        await Promise.all([
          AsyncStorage.removeItem(TOKEN_KEY),
          AsyncStorage.removeItem(HOUSEHOLD_KEY),
          AsyncStorage.removeItem(COLLECTOR_KEY),
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
      setApiToken(result.token);
      await Promise.all([
        AsyncStorage.setItem(TOKEN_KEY, result.token),
        AsyncStorage.setItem(HOUSEHOLD_KEY, JSON.stringify(result.account)),
      ]);

      try {
        const profile = await householdApi.profile();
        setHouseholdUser(profile);
        await AsyncStorage.setItem(HOUSEHOLD_KEY, JSON.stringify(profile));
      } catch {
        setHouseholdUser(result.account);
      }
      setHouseholdAuthenticated(true);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Invalid House ID or password.' };
    }
  };

  const refreshHouseholdProfile = async () => {
    try {
      const profile = await householdApi.profile();
      setHouseholdUser(profile);
    } catch {
      // ignore
    }
  };

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

  const resetHouseholdPassword = async (password: string) => {
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
  };

  const logoutHousehold = () => {
    setHouseholdAuthenticated(false);
    setHouseholdUser(null);
    setApiToken(null);
    Promise.all([
      AsyncStorage.removeItem(TOKEN_KEY),
      AsyncStorage.removeItem(HOUSEHOLD_KEY),
    ]);
  };

  const loginCollector = async (collectorId: string, password: string) => {
    try {
      const result = await collectorApi.login(collectorId, password);
      setApiToken(result.token);
      setCollectorUser(result.account);
      await Promise.all([
        AsyncStorage.setItem(TOKEN_KEY, result.token),
        AsyncStorage.setItem(COLLECTOR_KEY, JSON.stringify(result.account)),
      ]);
      setCollectorAuthenticated(true);
      return true;
    } catch {
      return false;
    }
  };

  const verifyCollectorIdentity = async (collectorId: string, birthdate: string) => {
    try {
      const result = await collectorApi.forgotPassword(collectorId.trim(), birthdate);
      setCollectorResetToken(result.resetToken);
      setCollectorResetAccountId(collectorId.trim().toUpperCase());
      setCollectorRecoveryVerified(true);
      return true;
    } catch {
      setCollectorRecoveryVerified(false);
      return false;
    }
  };

  const resetCollectorPassword = async (password: string) => {
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
  };

  const logoutCollector = () => {
    setCollectorAuthenticated(false);
    setCollectorUser(null);
    setApiToken(null);
    Promise.all([
      AsyncStorage.removeItem(TOKEN_KEY),
      AsyncStorage.removeItem(COLLECTOR_KEY),
    ]);
  };

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
      collectorAuthenticated,
      collectorUser,
      collectorRecoveryVerified,
      collectorResetAccountId,
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
