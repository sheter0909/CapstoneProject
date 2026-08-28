import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import GarbageCollectorLayout from '@/components/garbagecollector-layout';
import { useAuth } from '@/context/auth';

export default function GarbageCollectorShell() {
  const { collectorAuthenticated } = useAuth();
  const router = useRouter();
  const segments = useSegments() as string[];
  const isLoginRoute = segments.includes('login');
  const isRecoveryRoute = segments.includes('forgot-password') || segments.includes('reset-password');

  useEffect(() => {
    if (!collectorAuthenticated && !isLoginRoute && !isRecoveryRoute) {
      router.replace('/garbagecollector/login');
    }
  }, [collectorAuthenticated, isLoginRoute, isRecoveryRoute, router]);

  if (!collectorAuthenticated && !isLoginRoute && !isRecoveryRoute) {
    return null;
  }

  if (isLoginRoute || isRecoveryRoute) {
    return <Slot />;
  }

  return <GarbageCollectorLayout />;
}
