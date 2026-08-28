import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import { collectorApi, householdApi, HouseholdUser, setApiToken } from '@/lib/api';

type AuthContextValue = {
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
  collectorRecoveryVerified: boolean;
  collectorResetAccountId: string | null;
  loginCollector: (collectorId: string, password: string) => Promise<boolean>;
  verifyCollectorIdentity: (collectorId: string, birthdate: string) => Promise<boolean>;
  resetCollectorPassword: (password: string) => Promise<{ success: boolean; error?: string }>;
  logoutCollector: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [householdUser, setHouseholdUser] = useState<HouseholdUser | null>(null);
  const [householdAuthenticated, setHouseholdAuthenticated] = useState(false);
  const [householdRecoveryVerified, setHouseholdRecoveryVerified] = useState(false);
  const [householdResetToken, setHouseholdResetToken] = useState<string | null>(null);
  const [householdResetAccountId, setHouseholdResetAccountId] = useState<string | null>(null);

  const [collectorAuthenticated, setCollectorAuthenticated] = useState(false);
  const [collectorRecoveryVerified, setCollectorRecoveryVerified] = useState(false);
  const [collectorResetToken, setCollectorResetToken] = useState<string | null>(null);
  const [collectorResetAccountId, setCollectorResetAccountId] = useState<string | null>(null);

  const loginHousehold = async (householdId: string, password: string) => {
    try {
      const result = await householdApi.login(householdId.trim(), password);
      setApiToken(result.token);
      try {
        const profile = await householdApi.profile();
        setHouseholdUser(profile);
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
  };

  const loginCollector = async (collectorId: string, password: string) => {
    try {
      const result = await collectorApi.login(collectorId, password);
      setApiToken(result.token);
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
    setApiToken(null);
  };

  const value = useMemo(
    () => ({
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
      collectorRecoveryVerified,
      collectorResetAccountId,
      loginCollector,
      verifyCollectorIdentity,
      resetCollectorPassword,
      logoutCollector,
    }),
    [
      householdUser,
      householdAuthenticated,
      householdRecoveryVerified,
      householdResetAccountId,
      collectorAuthenticated,
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
