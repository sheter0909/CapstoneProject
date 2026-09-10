'use client';

import { useEffect, useState } from 'react';
import { getApiConnectingState, subscribeApiConnecting, type ApiConnectingState } from './api';

export function useApiConnecting(): ApiConnectingState {
  const [state, setState] = useState<ApiConnectingState>(() => getApiConnectingState());

  useEffect(() => subscribeApiConnecting(setState), []);

  return state;
}