/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';
import { useNavigate } from 'react-router-dom';
import { Bell, Warning, CheckCircle, XCircle } from '@phosphor-icons/react';
import { useAlerts } from '../hooks/useAlerts';
import { LoadingSpinner } from '../components/common';

export default function Alerts() {
  const navigate = useNavigate();
  const { data: alerts, isLoading } = useAlerts({ status: 'ACTIVE' });

  const getSeverityColor = (riskScore: number) => {
    if (riskScore >= 80) return '#ff6464';
    if (riskScore >= 60) return '#ffa500';
    if (riskScore >= 40) return '#ffeb3b';
    return '#dcfd8f';
  };

  const getSeverityIcon = (riskScore: number) => {
    if (riskScore >= 80) return <XCircle size={20} weight="fill" />;
    if (riskScore >= 60) return <Warning size={20} weight="fill" />;
    if (riskScore >= 40) return <Bell size={20} weight="fill" />;
    return <CheckCircle size={20} weight="fill" />;
  };

  const getSeverityLabel = (riskScore: number) => {
    if (riskScore >= 80) return 'CRITICAL';
    if (riskScore >= 60) return 'HIGH';
    if (riskScore >= 40) return 'MEDIUM';
    return 'LOW';
  };

  return (
    <div
      css={css`
        min-height: 100vh;
        padding: 2rem;
      `}
    >
      <div
        css={css`
          max-width: 1400px;
          margin: 0 auto;
        `}
      >
        {/* Header */}
        <div
          css={css`
            margin-bottom: 2rem;
          `}
        >
          <h1
            css={css`
              font-size: 2rem;
              font-weight: 700;
              color: #fff;
              margin-bottom: 0.5rem;
            `}
          >
            Active Alerts
          </h1>
          <p
            css={css`
              color: #a0a0a0;
              font-size: 0.9375rem;
            `}
          >
            Monitor critical alerts and take action to protect your positions
          </p>
        </div>

        {/* Alerts List */}
        {isLoading ? (
          <div
            css={css`
              display: flex;
              justify-content: center;
              align-items: center;
              padding: 4rem;
            `}
          >
            <LoadingSpinner size="lg" />
          </div>
        ) : alerts && alerts.length > 0 ? (
          <div
            css={css`
              display: flex;
              flex-direction: column;
              gap: 1rem;
            `}
          >
            {alerts.map((alert) => {
              const severityColor = getSeverityColor(alert.riskScore);
              const severityLabel = getSeverityLabel(alert.riskScore);
              
              return (
              <div
                key={alert.id}
                onClick={() => navigate(`/account/${alert.account?.walletAddress}`)}
                css={css`
                  background: rgba(12, 13, 16, 0.8);
                  border: 1px solid ${severityColor};
                  border-radius: 16px;
                  padding: 1.5rem;
                  backdrop-filter: blur(20px);
                  cursor: pointer;
                  transition: all 0.2s;

                  &:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
                  }
                `}
              >
                <div
                  css={css`
                    display: flex;
                    gap: 1.5rem;
                    align-items: flex-start;
                  `}
                >
                  {/* Icon */}
                  <div
                    css={css`
                      flex-shrink: 0;
                      width: 48px;
                      height: 48px;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      background: ${severityColor}20;
                      border: 1px solid ${severityColor};
                      border-radius: 12px;
                      color: ${severityColor};
                    `}
                  >
                    {getSeverityIcon(alert.riskScore)}
                  </div>

                  {/* Content */}
                  <div
                    css={css`
                      flex: 1;
                    `}
                  >
                    <div
                      css={css`
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        margin-bottom: 0.5rem;
                      `}
                    >
                      <div>
                        <div
                          css={css`
                            display: inline-block;
                            padding: 0.25rem 0.75rem;
                            background: ${severityColor}20;
                            border: 1px solid ${severityColor};
                            border-radius: 6px;
                            font-size: 0.75rem;
                            font-weight: 700;
                            color: ${severityColor};
                            text-transform: uppercase;
                            margin-bottom: 0.5rem;
                          `}
                        >
                          {severityLabel}
                        </div>
                        <h3
                          css={css`
                            font-size: 1.125rem;
                            font-weight: 600;
                            color: #fff;
                            margin-bottom: 0.25rem;
                          `}
                        >
                          {alert.recommendedAction} - Risk Score: {alert.riskScore}%
                        </h3>
                      </div>
                      <div
                        css={css`
                          text-align: right;
                        `}
                      >
                        <div
                          css={css`
                            font-family: 'Courier New', monospace;
                            font-size: 0.875rem;
                            color: #dcfd8f;
                            margin-bottom: 0.25rem;
                          `}
                        >
                          {alert.account?.walletAddress?.slice(0, 6)}...
                          {alert.account?.walletAddress?.slice(-4)}
                        </div>
                        <div
                          css={css`
                            font-size: 0.75rem;
                            color: #a0a0a0;
                          `}
                        >
                          {new Date(alert.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <p
                      css={css`
                        color: #a0a0a0;
                        font-size: 0.9375rem;
                        line-height: 1.5;
                        margin-bottom: 1rem;
                      `}
                    >
                      Status: {alert.status} • Time to Liquidation: {alert.timeToLiquidation}h
                    </p>

                    {/* Metrics */}
                    <div
                      css={css`
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                        gap: 1rem;
                        padding: 1rem;
                        background: rgba(255, 255, 255, 0.03);
                        border-radius: 8px;
                      `}
                    >
                      <div>
                        <div
                          css={css`
                            font-size: 0.75rem;
                            color: #a0a0a0;
                            margin-bottom: 0.25rem;
                          `}
                        >
                          Cascade Probability
                        </div>
                        <div
                          css={css`
                            font-size: 0.9375rem;
                            font-weight: 600;
                            color: #fff;
                          `}
                        >
                          {(alert.cascadeProbability * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <div
                          css={css`
                            font-size: 0.75rem;
                            color: #a0a0a0;
                            margin-bottom: 0.25rem;
                          `}
                        >
                          Estimated Losses
                        </div>
                        <div
                          css={css`
                            font-size: 0.9375rem;
                            font-weight: 600;
                            color: #fff;
                          `}
                        >
                          ${alert.estimatedLosses.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
            })}
          </div>
        ) : (
          <div
            css={css`
              text-align: center;
              padding: 4rem 2rem;
              background: rgba(12, 13, 16, 0.6);
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 16px;
              backdrop-filter: blur(20px);
            `}
          >
            <CheckCircle size={64} color="#dcfd8f" weight="thin" />
            <h3
              css={css`
                font-size: 1.25rem;
                font-weight: 600;
                color: #fff;
                margin-top: 1rem;
                margin-bottom: 0.5rem;
              `}
            >
              All Clear!
            </h3>
            <p
              css={css`
                color: #a0a0a0;
              `}
            >
              No active alerts at the moment. Your positions are safe.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
