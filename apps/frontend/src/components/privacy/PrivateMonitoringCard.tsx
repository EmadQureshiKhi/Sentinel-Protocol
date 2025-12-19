/**
 * Private Monitoring Card Component
 * Shows private health check status for a position - Black & Yellow theme
 */

import React, { useState } from 'react';
import { usePrivateMonitoring } from '../../hooks/usePrivacy';

interface PrivateMonitoringCardProps {
  walletAddress: string | null;
  collateralValue?: number;
  debtValue?: number;
}

export const PrivateMonitoringCard: React.FC<PrivateMonitoringCardProps> = ({
  walletAddress,
  collateralValue,
  debtValue,
}) => {
  const { healthCheck, loading, error, runHealthCheck, encryptPosition } = usePrivateMonitoring(walletAddress);
  const [isEncrypted, setIsEncrypted] = useState(false);

  const handleEncrypt = async () => {
    if (!collateralValue || !debtValue) return;
    
    const result = await encryptPosition({
      collateralValue,
      debtValue,
    });
    
    if (result) {
      setIsEncrypted(true);
    }
  };

  const getRiskStyle = (level: string) => {
    switch (level) {
      case 'SAFE': return { color: 'var(--status-success)', bg: 'rgba(34, 197, 94, 0.1)', border: 'rgba(34, 197, 94, 0.3)' };
      case 'LOW': return { color: 'var(--status-info)', bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.3)' };
      case 'MEDIUM': return { color: 'var(--clr-primary)', bg: 'rgba(234, 179, 8, 0.1)', border: 'rgba(234, 179, 8, 0.3)' };
      case 'HIGH': return { color: 'var(--status-warning)', bg: 'rgba(249, 115, 22, 0.1)', border: 'rgba(249, 115, 22, 0.3)' };
      case 'CRITICAL': return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)' };
      default: return { color: 'var(--text-tertiary)', bg: 'var(--bg-hover)', border: 'var(--border-default)' };
    }
  };

  if (!walletAddress) {
    return null;
  }

  return (
    <div className="rounded-lg p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--clr-primary)' }}>
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
          </svg>
          Private Monitoring
        </h4>
        {isEncrypted && (
          <span 
            className="text-xs px-2 py-0.5 rounded"
            style={{ background: 'rgba(234, 179, 8, 0.2)', color: 'var(--clr-primary)' }}
          >
            Encrypted
          </span>
        )}
      </div>

      {error && (
        <p className="text-xs mb-2" style={{ color: '#ef4444' }}>{error}</p>
      )}

      {!isEncrypted && collateralValue && debtValue && (
        <button
          onClick={handleEncrypt}
          disabled={loading}
          className="w-full text-sm py-2 rounded-lg transition-colors mb-3 disabled:opacity-50"
          style={{ 
            background: 'rgba(234, 179, 8, 0.1)', 
            border: '1px solid rgba(234, 179, 8, 0.3)',
            color: 'var(--clr-primary)'
          }}
        >
          {loading ? 'Encrypting...' : 'Encrypt Position for Private Monitoring'}
        </button>
      )}

      {isEncrypted && (
        <>
          <button
            onClick={runHealthCheck}
            disabled={loading}
            className="w-full text-sm py-2 rounded-lg transition-colors mb-3 disabled:opacity-50"
            style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
          >
            {loading ? 'Checking...' : 'Run Private Health Check'}
          </button>

          {healthCheck && (
            <div 
              className="rounded-lg p-3"
              style={{ 
                background: getRiskStyle(healthCheck.riskLevel).bg,
                border: `1px solid ${getRiskStyle(healthCheck.riskLevel).border}`
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs" style={{ color: getRiskStyle(healthCheck.riskLevel).color, opacity: 0.7 }}>Risk Level</span>
                <span className="font-semibold" style={{ color: getRiskStyle(healthCheck.riskLevel).color }}>{healthCheck.riskLevel}</span>
              </div>
              <div className="flex items-center justify-between text-xs" style={{ color: getRiskStyle(healthCheck.riskLevel).color, opacity: 0.7 }}>
                <span>Proof Hash</span>
                <span className="font-mono truncate max-w-[100px]">{healthCheck.proofHash.slice(0, 12)}...</span>
              </div>
              {healthCheck.requiresAction && (
                <p 
                  className="text-xs mt-2 pt-2"
                  style={{ borderTop: `1px solid ${getRiskStyle(healthCheck.riskLevel).border}`, color: getRiskStyle(healthCheck.riskLevel).color }}
                >
                  ⚠️ Action recommended based on private computation
                </p>
              )}
            </div>
          )}
        </>
      )}

      <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
        Health checks run on encrypted data via MXE
      </p>
    </div>
  );
};

export default PrivateMonitoringCard;
