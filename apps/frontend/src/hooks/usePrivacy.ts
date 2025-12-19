/**
 * Privacy Hook
 * React hook for Arcium privacy features
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

export interface PrivacyStatus {
  mxeCluster: {
    id: string;
    status: string;
    nodeCount: number;
    threshold: number;
  };
  orderFlow: {
    queueSize: number;
    processedCount: number;
  };
  monitoring: {
    totalPositions: number;
    atRiskCount: number;
  };
  features: {
    privateMonitoring: boolean;
    privateSwaps: boolean;
    darkPool: boolean;
    encryptedOrderFlow: boolean;
  };
}

export interface PrivateHealthCheckResult {
  walletAddress: string;
  riskLevel: 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  requiresAction: boolean;
  proofHash: string;
  timestamp: number;
}

export interface DarkPoolOrder {
  orderId: string;
  status: string;
  createdAt: number;
  expiresAt: number;
}

export function usePrivacy() {
  const [status, setStatus] = useState<PrivacyStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getPrivacyStatus();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch privacy status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    status,
    loading,
    error,
    refresh: fetchStatus,
  };
}

export function usePrivateMonitoring(walletAddress: string | null) {
  const [healthCheck, setHealthCheck] = useState<PrivateHealthCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runHealthCheck = useCallback(async () => {
    if (!walletAddress) return;
    
    try {
      setLoading(true);
      setError(null);
      const result = await api.runPrivateHealthCheck(walletAddress);
      setHealthCheck(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run private health check');
      return null;
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  const encryptPosition = useCallback(async (params: {
    collateralValue: number;
    debtValue: number;
    healthFactor?: number;
    leverage?: number;
  }) => {
    if (!walletAddress) return null;
    
    try {
      setLoading(true);
      setError(null);
      const result = await api.encryptPositionForMonitoring({
        walletAddress,
        ...params,
      });
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to encrypt position');
      return null;
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  return {
    healthCheck,
    loading,
    error,
    runHealthCheck,
    encryptPosition,
  };
}

export function usePrivateSwaps(walletAddress: string | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSwapIntent = useCallback(async (params: {
    fromToken: string;
    toToken: string;
    amount: number;
    minOutput?: number;
    slippage?: number;
  }) => {
    if (!walletAddress) return null;
    
    try {
      setLoading(true);
      setError(null);
      const result = await api.createPrivateSwapIntent({
        walletAddress,
        ...params,
      });
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create swap intent');
      return null;
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  const executeSwap = useCallback(async (intentId: string) => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.executePrivateSwap(intentId);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute private swap');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    createSwapIntent,
    executeSwap,
  };
}

export function useDarkPool(walletAddress: string | null) {
  const [orders, setOrders] = useState<DarkPoolOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!walletAddress) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await api.getDarkPoolOrders(walletAddress);
      setOrders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dark pool orders');
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  const submitOrder = useCallback(async (params: {
    side: 'buy' | 'sell';
    token: string;
    amount: number;
    price: number;
    expiresIn?: number;
  }) => {
    if (!walletAddress) return null;
    
    try {
      setLoading(true);
      setError(null);
      const result = await api.submitDarkPoolOrder({
        walletAddress,
        ...params,
      });
      await fetchOrders();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit dark pool order');
      return null;
    } finally {
      setLoading(false);
    }
  }, [walletAddress, fetchOrders]);

  const cancelOrder = useCallback(async (orderId: string) => {
    if (!walletAddress) return false;
    
    try {
      setLoading(true);
      setError(null);
      const result = await api.cancelDarkPoolOrder(orderId, walletAddress);
      await fetchOrders();
      return result.cancelled;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel order');
      return false;
    } finally {
      setLoading(false);
    }
  }, [walletAddress, fetchOrders]);

  useEffect(() => {
    if (walletAddress) {
      fetchOrders();
    }
  }, [walletAddress, fetchOrders]);

  return {
    orders,
    loading,
    error,
    submitOrder,
    cancelOrder,
    refresh: fetchOrders,
  };
}

export function useEncryptedOrderFlow() {
  const [stats, setStats] = useState<{
    queueSize: number;
    processedCount: number;
    averageProcessingTime: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getOrderFlowStats();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch order flow stats');
    } finally {
      setLoading(false);
    }
  }, []);

  const submitIntent = useCallback(async (params: {
    walletAddress: string;
    action: string;
    params: Record<string, any>;
    priority?: 'low' | 'normal' | 'high';
  }) => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.submitToOrderFlow(params);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit to order flow');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getFlowStatus = useCallback(async (flowId: string) => {
    try {
      const result = await api.getOrderFlowStatus(flowId);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get flow status');
      return null;
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    submitIntent,
    getFlowStatus,
    refresh: fetchStats,
  };
}
