/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';
import { useActiveAlerts, useAcknowledgeAlert, useResolveAlert } from '../../hooks/useAlerts';
import { Alert } from '../../services/api';
import { CheckCircle } from '@phosphor-icons/react';

interface AlertItemProps {
  alert: Alert;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function formatWallet(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getSeverityColor(riskScore: number): string {
  if (riskScore >= 80) return '#ff6464';
  if (riskScore >= 60) return '#ffa500';
  return '#ffeb3b';
}

function AlertItem({ alert, onAcknowledge, onResolve }: AlertItemProps) {
  const severityColor = getSeverityColor(alert.riskScore);
  const wallet = alert.account?.walletAddress || 'Unknown';

  return (
    <div
      css={css`
        background: rgba(12, 13, 16, 0.6);
        border-left: 3px solid ${severityColor};
        border-radius: 8px;
        padding: 0.75rem;
        backdrop-filter: blur(20px);
      `}
    >
      <div
        css={css`
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        `}
      >
        <div css={css`flex: 1;`}>
          <div
            css={css`
              display: flex;
              align-items: center;
              gap: 0.5rem;
              margin-bottom: 0.5rem;
            `}
          >
            <span
              css={css`
                font-family: 'Courier New', monospace;
                font-size: 0.875rem;
                font-weight: 600;
                color: #dcfd8f;
              `}
            >
              {formatWallet(wallet)}
            </span>
            <span
              css={css`
                padding: 0.125rem 0.5rem;
                background: ${alert.status === 'ACTIVE' ? 'rgba(255, 100, 100, 0.1)' :
                  alert.status === 'ACKNOWLEDGED' ? 'rgba(255, 165, 0, 0.1)' :
                  'rgba(220, 253, 143, 0.1)'};
                border: 1px solid ${alert.status === 'ACTIVE' ? 'rgba(255, 100, 100, 0.3)' :
                  alert.status === 'ACKNOWLEDGED' ? 'rgba(255, 165, 0, 0.3)' :
                  'rgba(220, 253, 143, 0.3)'};
                border-radius: 4px;
                font-size: 0.625rem;
                font-weight: 600;
                color: ${alert.status === 'ACTIVE' ? '#ff6464' :
                  alert.status === 'ACKNOWLEDGED' ? '#ffa500' :
                  '#dcfd8f'};
                text-transform: uppercase;
              `}
            >
              {alert.status}
            </span>
          </div>
          <p
            css={css`
              font-size: 0.75rem;
              color: #a0a0a0;
              margin-bottom: 0.25rem;
            `}
          >
            Risk: {alert.riskScore}/100 • Cascade: {(alert.cascadeProbability * 100).toFixed(0)}%
          </p>
          <p
            css={css`
              font-size: 0.75rem;
              color: #666;
            `}
          >
            {formatTimeAgo(alert.createdAt)}
          </p>
        </div>
        
        <div
          css={css`
            display: flex;
            flex-direction: column;
            gap: 0.375rem;
          `}
        >
          {alert.status === 'ACTIVE' && (
            <button
              onClick={() => onAcknowledge(alert.id)}
              css={css`
                padding: 0.25rem 0.5rem;
                background: rgba(255, 165, 0, 0.1);
                border: 1px solid rgba(255, 165, 0, 0.3);
                border-radius: 4px;
                font-size: 0.75rem;
                font-weight: 600;
                color: #ffa500;
                cursor: pointer;
                transition: all 0.2s;

                &:hover {
                  background: rgba(255, 165, 0, 0.2);
                }
              `}
            >
              Ack
            </button>
          )}
          {(alert.status === 'ACTIVE' || alert.status === 'ACKNOWLEDGED') && (
            <button
              onClick={() => onResolve(alert.id)}
              css={css`
                padding: 0.25rem 0.5rem;
                background: rgba(220, 253, 143, 0.1);
                border: 1px solid rgba(220, 253, 143, 0.3);
                border-radius: 4px;
                font-size: 0.75rem;
                font-weight: 600;
                color: #dcfd8f;
                cursor: pointer;
                transition: all 0.2s;

                &:hover {
                  background: rgba(220, 253, 143, 0.2);
                }
              `}
            >
              Resolve
            </button>
          )}
        </div>
      </div>
      
      {/* Recommended action */}
      <div
        css={css`
          margin-top: 0.75rem;
          padding-top: 0.75rem;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        `}
      >
        <span
          css={css`
            font-size: 0.75rem;
            font-weight: 600;
            color: ${alert.recommendedAction === 'PROTECT' ? '#ff6464' :
              alert.recommendedAction === 'MONITOR' ? '#ffa500' :
              '#dcfd8f'};
          `}
        >
          ⚡ {alert.recommendedAction}
        </span>
        {alert.estimatedLosses > 0 && (
          <span
            css={css`
              font-size: 0.75rem;
              color: #666;
              margin-left: 0.5rem;
            `}
          >
            Est. loss: ${alert.estimatedLosses.toFixed(2)}
          </span>
        )}
      </div>
    </div>
  );
}

export function AlertFeed() {
  const { data: alerts, isLoading, error } = useActiveAlerts();
  const acknowledgeMutation = useAcknowledgeAlert();
  const resolveMutation = useResolveAlert();

  const handleAcknowledge = (id: string) => {
    acknowledgeMutation.mutate(id);
  };

  const handleResolve = (id: string) => {
    resolveMutation.mutate(id);
  };

  if (isLoading) {
    return (
      <div
        css={css`
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        `}
      >
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            css={css`
              background: rgba(12, 13, 16, 0.6);
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 8px;
              padding: 0.75rem;
              backdrop-filter: blur(20px);
              animation: pulse 2s infinite;

              @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
              }
            `}
          >
            <div css={css`height: 60px;`} />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        css={css`
          text-align: center;
          padding: 2rem;
          color: #ff6464;
        `}
      >
        Failed to load alerts
      </div>
    );
  }

  if (!alerts || alerts.length === 0) {
    return (
      <div
        css={css`
          text-align: center;
          padding: 2rem;
        `}
      >
        <CheckCircle size={48} color="#dcfd8f" weight="thin" />
        <p
          css={css`
            color: #a0a0a0;
            margin-top: 0.75rem;
            margin-bottom: 0.25rem;
          `}
        >
          No active alerts
        </p>
        <p
          css={css`
            font-size: 0.75rem;
            color: #666;
          `}
        >
          All positions are healthy
        </p>
      </div>
    );
  }

  return (
    <div
      css={css`
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        max-height: 400px;
        overflow-y: auto;
        padding-right: 0.5rem;

        &::-webkit-scrollbar {
          width: 6px;
        }

        &::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 3px;
        }

        &::-webkit-scrollbar-thumb {
          background: rgba(220, 253, 143, 0.3);
          border-radius: 3px;

          &:hover {
            background: rgba(220, 253, 143, 0.5);
          }
        }
      `}
    >
      {alerts.map((alert) => (
        <AlertItem
          key={alert.id}
          alert={alert}
          onAcknowledge={handleAcknowledge}
          onResolve={handleResolve}
        />
      ))}
    </div>
  );
}

export default AlertFeed;
