/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';
import { useNavigate } from 'react-router-dom';
import { Bell, Warning, CheckCircle, XCircle, CaretRight } from '@phosphor-icons/react';
import { useActiveAlerts, useAcknowledgeAlert, useResolveAlert } from '../../hooks/useAlerts';
import { Alert } from '../../services/api';
import { useState } from 'react';
import { Modal } from '../common';

export function AlertFeed() {
  const navigate = useNavigate();
  const { data: alerts, isLoading } = useActiveAlerts();
  const acknowledgeMutation = useAcknowledgeAlert();
  const resolveMutation = useResolveAlert();
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  const getSeverityColor = (riskScore: number) => {
    if (riskScore >= 80) return '#ff6464';
    if (riskScore >= 60) return '#ffa500';
    if (riskScore >= 40) return '#ffeb3b';
    return '#dcfd8f';
  };

  const getSeverityIcon = (riskScore: number) => {
    if (riskScore >= 80) return <XCircle size={16} weight="fill" />;
    if (riskScore >= 60) return <Warning size={16} weight="fill" />;
    if (riskScore >= 40) return <Bell size={16} weight="fill" />;
    return <CheckCircle size={16} weight="fill" />;
  };

  const getSeverityLabel = (riskScore: number) => {
    if (riskScore >= 80) return 'CRITICAL';
    if (riskScore >= 60) return 'HIGH';
    if (riskScore >= 40) return 'MEDIUM';
    return 'LOW';
  };

  const handleAcknowledge = async (alertId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await acknowledgeMutation.mutateAsync(alertId);
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  };

  const handleResolve = async (alertId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await resolveMutation.mutateAsync(alertId);
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  };

  if (isLoading) {
    return (
      <div css={css`
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      `}>
        {[...Array(3)].map((_, i) => (
          <div key={i} css={css`
            background: rgba(255, 255, 255, 0.03);
            border-radius: 10px;
            padding: 0.875rem;
            height: 70px;
            animation: pulse 2s infinite;
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.5; }
            }
          `} />
        ))}
      </div>
    );
  }

  if (!alerts || alerts.length === 0) {
    return (
      <div css={css`
        text-align: center;
        padding: 2rem 1rem;
      `}>
        <CheckCircle size={40} color="#dcfd8f" weight="thin" />
        <p css={css`
          color: #666;
          font-size: 0.8125rem;
          margin-top: 0.75rem;
        `}>
          All clear! No active alerts.
        </p>
      </div>
    );
  }

  return (
    <>
      <div css={css`
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        max-height: 400px;
        overflow-y: auto;
        
        &::-webkit-scrollbar {
          width: 4px;
        }
        &::-webkit-scrollbar-track {
          background: transparent;
        }
        &::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
        }
      `}>
        {alerts.map((alert) => {
          const severityColor = getSeverityColor(alert.riskScore);
          const severityLabel = getSeverityLabel(alert.riskScore);
          
          return (
            <div
              key={alert.id}
              onClick={() => setSelectedAlert(alert)}
              css={css`
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid ${severityColor}40;
                border-left: 3px solid ${severityColor};
                border-radius: 10px;
                padding: 0.875rem;
                cursor: pointer;
                transition: all 0.2s;

                &:hover {
                  background: rgba(255, 255, 255, 0.05);
                  border-color: ${severityColor}60;
                }
              `}
            >
              <div css={css`
                display: flex;
                align-items: flex-start;
                gap: 0.75rem;
              `}>
                <div css={css`
                  color: ${severityColor};
                  flex-shrink: 0;
                  margin-top: 2px;
                `}>
                  {getSeverityIcon(alert.riskScore)}
                </div>
                
                <div css={css`flex: 1; min-width: 0;`}>
                  <div css={css`
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin-bottom: 0.25rem;
                  `}>
                    <span css={css`
                      padding: 0.125rem 0.375rem;
                      background: ${severityColor}20;
                      border-radius: 4px;
                      font-size: 0.625rem;
                      font-weight: 700;
                      color: ${severityColor};
                      text-transform: uppercase;
                    `}>
                      {severityLabel}
                    </span>
                    <span css={css`
                      font-size: 0.6875rem;
                      color: #666;
                    `}>
                      {new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  
                  <div css={css`
                    font-size: 0.8125rem;
                    color: #fff;
                    font-weight: 500;
                    margin-bottom: 0.25rem;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                  `}>
                    Risk: {alert.riskScore}% • TTL: {alert.timeToLiquidation}h
                  </div>
                  
                  <div css={css`
                    font-family: 'SF Mono', 'Fira Code', monospace;
                    font-size: 0.6875rem;
                    color: #a0a0a0;
                  `}>
                    {alert.account?.walletAddress?.slice(0, 6)}...{alert.account?.walletAddress?.slice(-4)}
                  </div>
                </div>
                
                <CaretRight size={14} color="#666" css={css`flex-shrink: 0;`} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Alert Detail Modal */}
      <Modal
        isOpen={!!selectedAlert}
        onClose={() => setSelectedAlert(null)}
        title="Alert Details"
      >
        {selectedAlert && (
          <div css={css`display: flex; flex-direction: column; gap: 1.25rem;`}>
            {/* Severity Badge */}
            <div css={css`
              display: flex;
              align-items: center;
              gap: 0.75rem;
            `}>
              <div css={css`
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: ${getSeverityColor(selectedAlert.riskScore)}20;
                border: 1px solid ${getSeverityColor(selectedAlert.riskScore)};
                border-radius: 10px;
                color: ${getSeverityColor(selectedAlert.riskScore)};
              `}>
                {getSeverityIcon(selectedAlert.riskScore)}
              </div>
              <div>
                <span css={css`
                  display: inline-block;
                  padding: 0.25rem 0.625rem;
                  background: ${getSeverityColor(selectedAlert.riskScore)}20;
                  border: 1px solid ${getSeverityColor(selectedAlert.riskScore)};
                  border-radius: 6px;
                  font-size: 0.6875rem;
                  font-weight: 700;
                  color: ${getSeverityColor(selectedAlert.riskScore)};
                  text-transform: uppercase;
                `}>
                  {getSeverityLabel(selectedAlert.riskScore)}
                </span>
                <div css={css`
                  font-size: 0.75rem;
                  color: #666;
                  margin-top: 0.25rem;
                `}>
                  {new Date(selectedAlert.createdAt).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Wallet */}
            <div css={css`
              padding: 0.75rem 1rem;
              background: rgba(255, 255, 255, 0.03);
              border-radius: 8px;
            `}>
              <div css={css`font-size: 0.6875rem; color: #666; margin-bottom: 0.25rem;`}>
                Wallet Address
              </div>
              <div css={css`
                font-family: 'SF Mono', 'Fira Code', monospace;
                font-size: 0.8125rem;
                color: #dcfd8f;
              `}>
                {selectedAlert.account?.walletAddress}
              </div>
            </div>

            {/* Metrics Grid */}
            <div css={css`
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 0.75rem;
            `}>
              <div css={css`
                padding: 0.75rem;
                background: rgba(255, 255, 255, 0.03);
                border-radius: 8px;
              `}>
                <div css={css`font-size: 0.6875rem; color: #666; margin-bottom: 0.25rem;`}>
                  Risk Score
                </div>
                <div css={css`
                  font-size: 1.125rem;
                  font-weight: 700;
                  color: ${getSeverityColor(selectedAlert.riskScore)};
                `}>
                  {selectedAlert.riskScore}%
                </div>
              </div>
              
              <div css={css`
                padding: 0.75rem;
                background: rgba(255, 255, 255, 0.03);
                border-radius: 8px;
              `}>
                <div css={css`font-size: 0.6875rem; color: #666; margin-bottom: 0.25rem;`}>
                  Time to Liquidation
                </div>
                <div css={css`font-size: 1.125rem; font-weight: 700; color: #fff;`}>
                  {selectedAlert.timeToLiquidation}h
                </div>
              </div>
              
              <div css={css`
                padding: 0.75rem;
                background: rgba(255, 255, 255, 0.03);
                border-radius: 8px;
              `}>
                <div css={css`font-size: 0.6875rem; color: #666; margin-bottom: 0.25rem;`}>
                  Cascade Probability
                </div>
                <div css={css`font-size: 1.125rem; font-weight: 700; color: #fff;`}>
                  {(selectedAlert.cascadeProbability * 100).toFixed(1)}%
                </div>
              </div>
              
              <div css={css`
                padding: 0.75rem;
                background: rgba(255, 255, 255, 0.03);
                border-radius: 8px;
              `}>
                <div css={css`font-size: 0.6875rem; color: #666; margin-bottom: 0.25rem;`}>
                  Estimated Losses
                </div>
                <div css={css`font-size: 1.125rem; font-weight: 700; color: #ff6464;`}>
                  ${selectedAlert.estimatedLosses.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Recommended Action */}
            <div css={css`
              padding: 1rem;
              background: rgba(220, 253, 143, 0.05);
              border: 1px solid rgba(220, 253, 143, 0.2);
              border-radius: 10px;
            `}>
              <div css={css`font-size: 0.6875rem; color: #dcfd8f; margin-bottom: 0.375rem; font-weight: 600;`}>
                Recommended Action
              </div>
              <div css={css`font-size: 0.875rem; color: #fff;`}>
                {selectedAlert.recommendedAction}
              </div>
            </div>

            {/* Action Buttons */}
            <div css={css`display: flex; gap: 0.75rem;`}>
              <button
                onClick={() => {
                  navigate(`/account/${selectedAlert.account?.walletAddress}`);
                  setSelectedAlert(null);
                }}
                css={css`
                  flex: 1;
                  padding: 0.875rem;
                  background: rgba(255, 255, 255, 0.03);
                  border: 1px solid rgba(255, 255, 255, 0.1);
                  border-radius: 10px;
                  color: #a0a0a0;
                  font-weight: 600;
                  font-size: 0.8125rem;
                  cursor: pointer;
                  transition: all 0.2s;

                  &:hover {
                    background: rgba(255, 255, 255, 0.06);
                    color: #fff;
                  }
                `}
              >
                View Account
              </button>
              
              {selectedAlert.status === 'ACTIVE' && (
                <button
                  onClick={(e) => {
                    handleAcknowledge(selectedAlert.id, e);
                    setSelectedAlert(null);
                  }}
                  disabled={acknowledgeMutation.isPending}
                  css={css`
                    flex: 1;
                    padding: 0.875rem;
                    background: rgba(255, 165, 0, 0.15);
                    border: 1px solid rgba(255, 165, 0, 0.3);
                    border-radius: 10px;
                    color: #ffa500;
                    font-weight: 600;
                    font-size: 0.8125rem;
                    cursor: pointer;
                    transition: all 0.2s;

                    &:hover:not(:disabled) {
                      background: rgba(255, 165, 0, 0.25);
                    }
                    &:disabled {
                      opacity: 0.5;
                      cursor: not-allowed;
                    }
                  `}
                >
                  Acknowledge
                </button>
              )}
              
              <button
                onClick={(e) => {
                  handleResolve(selectedAlert.id, e);
                  setSelectedAlert(null);
                }}
                disabled={resolveMutation.isPending}
                css={css`
                  flex: 1;
                  padding: 0.875rem;
                  background: linear-gradient(135deg, #dcfd8f 0%, #b8e063 100%);
                  color: #0a0e27;
                  border: none;
                  border-radius: 10px;
                  font-weight: 600;
                  font-size: 0.8125rem;
                  cursor: pointer;
                  transition: all 0.2s;

                  &:hover:not(:disabled) {
                    transform: translateY(-1px);
                    box-shadow: 0 8px 24px rgba(220, 253, 143, 0.3);
                  }
                  &:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                  }
                `}
              >
                Resolve
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
