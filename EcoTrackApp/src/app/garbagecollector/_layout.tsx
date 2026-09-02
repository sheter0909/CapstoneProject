import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import GarbageCollectorLayout from '@/components/garbagecollector-layout';
import { useAuth } from '@/context/auth';

export default function GarbageCollectorShell() {
  const { collectorAuthenticated, hydrated } = useAuth();
  const router = useRouter();
  const segments = useSegments() as string[];
  const isLoginRoute = segments.includes('login');
  const isRecoveryRoute = segments.includes('forgot-password') || segments.includes('reset-password');

  useEffect(() => {
    if (hydrated && !collectorAuthenticated && !isLoginRoute && !isRecoveryRoute) {
      router.replace('/garbagecollector/login');
    }
  }, [collectorAuthenticated, hydrated, isLoginRoute, isRecoveryRoute, router]);

  if (!hydrated || (!collectorAuthenticated && !isLoginRoute && !isRecoveryRoute)) {
    return null;
  }

  if (isLoginRoute || isRecoveryRoute) {
    return <Slot />;
  }

  return <GarbageCollectorLayout />;
}
