/**
 * Alert Hooks
 * React Query hooks for alert operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

// Query keys
export const alertKeys = {
  all: ['alerts'] as const,
  lists: () => [...alertKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...alertKeys.lists(), filters] as const,
  details: () => [...alertKeys.all, 'detail'] as const,
  detail: (id: string) => [...alertKeys.details(), id] as const,
};

/**
 * Get all alerts
 */
export function useAlerts(params?: { accountId?: string; status?: string }) {
  return useQuery({
    queryKey: alertKeys.list(params || {}),
    queryFn: () => api.getAlerts(params),
    staleTime: 5000, // 5 seconds
    refetchInterval: 10000, // Refetch every 10 seconds
  });
}

/**
 * Get active alerts only
 */
export function useActiveAlerts() {
  return useAlerts({ status: 'ACTIVE' });
}

/**
 * Get single alert by ID
 */
export function useAlert(id: string) {
  return useQuery({
    queryKey: alertKeys.detail(id),
    queryFn: () => api.getAlert(id),
    enabled: !!id,
    staleTime: 5000,
  });
}

/**
 * Acknowledge an alert
 */
export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.acknowledgeAlert(id),
    onSuccess: (updatedAlert) => {
      // Update the specific alert in cache
      queryClient.setQueryData(alertKeys.detail(updatedAlert.id), updatedAlert);
      // Invalidate alerts list
      queryClient.invalidateQueries({ queryKey: alertKeys.lists() });
    },
  });
}

/**
 * Resolve an alert
 */
export function useResolveAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.resolveAlert(id),
    onSuccess: (updatedAlert) => {
      // Update the specific alert in cache
      queryClient.setQueryData(alertKeys.detail(updatedAlert.id), updatedAlert);
      // Invalidate alerts list
      queryClient.invalidateQueries({ queryKey: alertKeys.lists() });
    },
  });
}

/**
 * Get alert count by status
 */
export function useAlertCounts() {
  const { data: alerts, ...rest } = useAlerts();

  const counts = {
    active: alerts?.filter((a) => a.status === 'ACTIVE').length || 0,
    acknowledged: alerts?.filter((a) => a.status === 'ACKNOWLEDGED').length || 0,
    resolved: alerts?.filter((a) => a.status === 'RESOLVED').length || 0,
    total: alerts?.length || 0,
  };

  return {
    data: counts,
    ...rest,
  };
}
