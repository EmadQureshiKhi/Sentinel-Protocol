/**
 * Privacy Status Component
 * Displays Arcium privacy features status - Black & Yellow theme
 */

import React from 'react';
import { usePrivacy } from '../../hooks/usePrivacy';

interface PrivacyStatusProps {
  compact?: boolean;
}

export const PrivacyStatus: React.FC<PrivacyStatusProps> = ({ compact = false }) => {
  const { status, loading, error, refresh } = usePrivacy();

  if (loading && !status) {
    return (
      <div className="rounded-lg p-4 animate-pulse" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
        <div className="h-4 rounded w-1/3 mb-2" style={{ background: 'var(--bg-hover)' }}></div>
        <div className="h-3 rounded w-1/2" style={{ background: 'var(--bg-hover)' }}></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg p-4" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
        <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>
        <button onClick={refresh} className="mt-2 text-xs hover:underline" style={{ color: '#ef4444' }}>
          Retry
        </button>
      </div>
    );
  }

  if (!status) return null;

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <div className="w-2 h-2 rounded-full" style={{ background: status.mxeCluster.status === 'active' ? 'var(--clr-primary)' : 'var(--status-warning)' }} />
        <span style={{ color: 'var(--text-secondary)' }}>MXE Cluster</span>
        <span style={{ color: 'var(--text-primary)' }}>{status.mxeCluster.nodeCount} nodes</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg p-6" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--clr-primary)' }}>
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
          </svg>
          MXE Status
        </h3>
        <button onClick={refresh} className="transition-colors p-1" style={{ color: 'var(--text-secondary)' }}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-lg p-4" style={{ background: 'var(--bg-hover)' }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full" style={{ background: status.mxeCluster.status === 'active' ? 'var(--clr-primary)' : 'var(--status-warning)' }} />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>MXE Cluster</span>
          </div>
          <p className="font-mono text-sm truncate" style={{ color: 'var(--text-primary)' }}>{status.mxeCluster.id}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
            {status.mxeCluster.nodeCount} nodes • {status.mxeCluster.threshold} threshold
          </p>
        </div>

        <div className="rounded-lg p-4" style={{ background: 'var(--bg-hover)' }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full" style={{ background: 'var(--clr-primary)' }} />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Order Flow</span>
          </div>
          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{status.orderFlow.queueSize} queued</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
            {status.orderFlow.processedCount} processed
          </p>
        </div>
      </div>

      <div className="pt-4" style={{ borderTop: '1px solid var(--border-default)' }}>
        <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>Privacy Features</p>
        <div className="grid grid-cols-2 gap-2">
          <FeatureBadge label="Private Monitoring" enabled={status.features.privateMonitoring} />
          <FeatureBadge label="Private Swaps" enabled={status.features.privateSwaps} />
          <FeatureBadge label="Dark Pool" enabled={status.features.darkPool} />
          <FeatureBadge label="Encrypted Order Flow" enabled={status.features.encryptedOrderFlow} />
        </div>
      </div>
    </div>
  );
};

const FeatureBadge: React.FC<{ label: string; enabled: boolean }> = ({ label, enabled }) => (
  <div 
    className="flex items-center gap-2 px-3 py-2 rounded-lg"
    style={{ 
      background: enabled ? 'rgba(234, 179, 8, 0.1)' : 'var(--bg-hover)',
      border: enabled ? '1px solid rgba(234, 179, 8, 0.2)' : '1px solid var(--border-default)'
    }}
  >
    <div className="w-1.5 h-1.5 rounded-full" style={{ background: enabled ? 'var(--clr-primary)' : 'var(--text-tertiary)' }} />
    <span className="text-xs" style={{ color: enabled ? 'var(--clr-primary)' : 'var(--text-tertiary)' }}>{label}</span>
  </div>
);

export default PrivacyStatus;
