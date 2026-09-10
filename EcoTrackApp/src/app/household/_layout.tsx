import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import HouseholdLayout from '@/components/household-layout';
import { useAuth } from '@/context/auth';

export default function HouseholdShell() {
  const { householdAuthenticated, hydrated } = useAuth();
  const router = useRouter();
  const segments = useSegments() as string[];
  const isRecoveryRoute = segments.includes('forgot-password') || segments.includes('reset-password');

  useEffect(() => {
    if (hydrated && !householdAuthenticated && !isRecoveryRoute) {
      router.replace('/');
    }
  }, [householdAuthenticated, hydrated, isRecoveryRoute, router]);

  if (!hydrated || (!householdAuthenticated && !isRecoveryRoute)) {
    return null;
  }

  if (isRecoveryRoute) {
    return <Slot />;
  }

  return <HouseholdLayout />;
}
