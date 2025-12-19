/**
 * Encrypted Order Flow Panel Component
 * Displays encrypted order flow queue stats - Black & Yellow theme
 */

import React from 'react';
import { useEncryptedOrderFlow } from '../../hooks/usePrivacy';

interface EncryptedOrderFlowPanelProps {
  walletAddress: string | null;
}

export const EncryptedOrderFlowPanel: React.FC<EncryptedOrderFlowPanelProps> = ({ walletAddress }) => {
  const { stats, loading, error, refresh } = useEncryptedOrderFlow();

  return (
    <div className="rounded-lg p-6" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--clr-primary)' }}>
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
          </svg>
          Encrypted Order Flow
        </h3>
        <button
          onClick={refresh}
          disabled={loading}
          className="transition-colors p-1"
          style={{ color: 'var(--text-secondary)' }}
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {error && (
        <div className="rounded-lg p-3 mb-4" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="rounded-lg p-3 text-center" style={{ background: 'var(--bg-hover)' }}>
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{stats?.queueSize || 0}</p>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Queue Size</p>
        </div>
        <div className="rounded-lg p-3 text-center" style={{ background: 'var(--bg-hover)' }}>
          <p className="text-2xl font-bold" style={{ color: 'var(--clr-primary)' }}>{stats?.processedCount || 0}</p>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Processed</p>
        </div>
        <div className="rounded-lg p-3 text-center" style={{ background: 'var(--bg-hover)' }}>
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{stats?.averageProcessingTime || 0}ms</p>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Avg Time</p>
        </div>
      </div>

      <div 
        className="rounded-lg p-3"
        style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.2)' }}
      >
        <div className="flex items-start gap-2">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--clr-primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs" style={{ color: 'var(--clr-primary)' }}>
            Transactions are batched and encrypted before execution, preventing MEV extraction 
            and ensuring fair ordering through Arcium's MXE network.
          </p>
        </div>
      </div>
    </div>
  );
};

export default EncryptedOrderFlowPanel;
