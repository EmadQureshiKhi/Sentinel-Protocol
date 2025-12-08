/**
 * WebSocket Hook
 * React hook for WebSocket connection and real-time updates
 */

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { websocket, AccountUpdatePayload, AlertPayload, StatsPayload, PricePayload, HvixPayload } from '../services/websocket';
import { accountKeys } from './useAccounts';
import { alertKeys } from './useAlerts';
import { statsKeys } from './useStats';

interface WebSocketState {
  isConnected: boolean;
  socketId?: string;
  lastUpdate?: number;
}

/**
 * Main WebSocket hook - manages connection and provides state
 */
export function useWebSocket() {
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
  });
  const queryClient = useQueryClient();

  useEffect(() => {
    // Connect on mount
    websocket.connect();

    // Setup connection listeners
    const unsubConnect = websocket.on('connected', (data: { clientId: string }) => {
      setState({
        isConnected: true,
        socketId: data.clientId,
        lastUpdate: Date.now(),
      });
    });

    const unsubDisconnect = websocket.on('disconnected', () => {
      setState((prev) => ({
        ...prev,
        isConnected: false,
      }));
    });

    // Setup data listeners that invalidate React Query cache
    const unsubAccountUpdate = websocket.on<AccountUpdatePayload>('account:update', (data) => {
      queryClient.invalidateQueries({ queryKey: accountKeys.detail(data.walletAddress) });
      queryClient.invalidateQueries({ queryKey: accountKeys.lists() });
      setState((prev) => ({ ...prev, lastUpdate: Date.now() }));
    });

    const unsubAlertNew = websocket.on<AlertPayload>('alert:new', () => {
      queryClient.invalidateQueries({ queryKey: alertKeys.lists() });
      setState((prev) => ({ ...prev, lastUpdate: Date.now() }));
    });

    const unsubAlertResolved = websocket.on<AlertPayload>('alert:resolved', () => {
      queryClient.invalidateQueries({ queryKey: alertKeys.lists() });
      setState((prev) => ({ ...prev, lastUpdate: Date.now() }));
    });

    const unsubStatsUpdate = websocket.on<StatsPayload>('stats:update', () => {
      queryClient.invalidateQueries({ queryKey: statsKeys.overview() });
      setState((prev) => ({ ...prev, lastUpdate: Date.now() }));
    });

    // Cleanup on unmount
    return () => {
      unsubConnect();
      unsubDisconnect();
      unsubAccountUpdate();
      unsubAlertNew();
      unsubAlertResolved();
      unsubStatsUpdate();
      websocket.disconnect();
    };
  }, [queryClient]);

  return state;
}

/**
 * Subscribe to specific account updates
 */
export function useAccountSubscription(walletAddress: string) {
  const [updates, setUpdates] = useState<AccountUpdatePayload[]>([]);

  useEffect(() => {
    if (!walletAddress) return;

    websocket.subscribeToAccount(walletAddress);

    const unsub = websocket.on<AccountUpdatePayload>('account:update', (data) => {
      if (data.walletAddress === walletAddress) {
        setUpdates((prev) => [...prev.slice(-99), data]); // Keep last 100
      }
    });

    return () => {
      websocket.unsubscribeFromAccount(walletAddress);
      unsub();
    };
  }, [walletAddress]);

  return updates;
}

/**
 * Subscribe to alert updates
 */
export function useAlertSubscription() {
  const [alerts, setAlerts] = useState<AlertPayload[]>([]);

  useEffect(() => {
    websocket.subscribeToAlerts();

    const unsubNew = websocket.on<AlertPayload>('alert:new', (data) => {
      setAlerts((prev) => [data, ...prev.slice(0, 49)]); // Keep last 50
    });

    const unsubResolved = websocket.on<AlertPayload>('alert:resolved', (data) => {
      setAlerts((prev) => prev.filter((a) => a.id !== data.id));
    });

    return () => {
      websocket.unsubscribeFromAlerts();
      unsubNew();
      unsubResolved();
    };
  }, []);

  return alerts;
}

/**
 * Subscribe to price updates
 */
export function usePriceSubscription() {
  const [prices, setPrices] = useState<Map<string, PricePayload>>(new Map());

  useEffect(() => {
    websocket.subscribeToPrices();

    const unsub = websocket.on<PricePayload>('price:update', (data) => {
      setPrices((prev) => new Map(prev).set(data.token, data));
    });

    return () => {
      unsub();
    };
  }, []);

  return prices;
}

/**
 * Subscribe to HVIX updates
 */
export function useHvixSubscription() {
  const [hvix, setHvix] = useState<HvixPayload | null>(null);

  useEffect(() => {
    const unsub = websocket.on<HvixPayload>('hvix:update', (data) => {
      setHvix(data);
    });

    return () => {
      unsub();
    };
  }, []);

  return hvix;
}

/**
 * Get WebSocket connection status
 */
export function useWebSocketStatus() {
  const [isConnected, setIsConnected] = useState(websocket.getIsConnected());

  useEffect(() => {
    const unsubConnect = websocket.on('connected', () => {
      setIsConnected(true);
    });

    const unsubDisconnect = websocket.on('disconnected', () => {
      setIsConnected(false);
    });

    return () => {
      unsubConnect();
      unsubDisconnect();
    };
  }, []);

  return isConnected;
}
