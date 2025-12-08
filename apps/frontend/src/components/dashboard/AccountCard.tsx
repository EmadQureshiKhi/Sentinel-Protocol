/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';
import { Account } from '../../services/api';
import { Shield } from '@phosphor-icons/react';

interface AccountCardProps {
  account: Account;
  onClick?: () => void;
}

function getRiskColor(riskScore: number): string {
  if (riskScore >= 80) return '#ff6464';
  if (riskScore >= 60) return '#ffa500';
  if (riskScore >= 40) return '#ffeb3b';
  return '#dcfd8f';
}

function formatWallet(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function AccountCard({ account, onClick }: AccountCardProps) {
  const snapshot = account.snapshots?.[0];
  const hasAlert = account.alerts && account.alerts.length > 0;
  const riskScore = snapshot?.riskScore || 0;
  const riskColor = getRiskColor(riskScore);

  return (
    <div
      onClick={onClick}
      css={css`
        background: rgba(12, 13, 16, 0.8);
        border: 1px solid ${hasAlert ? 'rgba(255, 100, 100, 0.3)' : 'rgba(255, 255, 255, 0.1)'};
        border-radius: 12px;
        padding: 1rem;
        cursor: pointer;
        transition: all 0.2s;

        &:hover {
          transform: translateY(-2px);
          border-color: rgba(220, 253, 143, 0.3);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        }
      `}
    >
      {/* Header */}
      <div
        css={css`
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 0.75rem;
        `}
      >
        <div>
          <p
            css={css`
              font-family: 'Courier New', monospace;
              font-size: 0.875rem;
              color: #dcfd8f;
              margin-bottom: 0.25rem;
            `}
          >
            {formatWallet(account.walletAddress)}
          </p>
          <p
            css={css`
              font-size: 0.75rem;
              color: #a0a0a0;
            `}
          >
            {account.protocol}
          </p>
        </div>
        {hasAlert && (
          <span
            css={css`
              padding: 0.25rem 0.5rem;
              background: rgba(255, 100, 100, 0.1);
              border: 1px solid rgba(255, 100, 100, 0.3);
              border-radius: 6px;
              font-size: 0.75rem;
              font-weight: 600;
              color: #ff6464;
            `}
          >
            Alert
          </span>
        )}
      </div>

      {/* Metrics */}
      {snapshot ? (
        <div
          css={css`
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0.75rem;
            margin-bottom: 0.75rem;
          `}
        >
          <div>
            <p
              css={css`
                font-size: 0.75rem;
                color: #a0a0a0;
                margin-bottom: 0.25rem;
              `}
            >
              Health Factor
            </p>
            <p
              css={css`
                font-size: 1.125rem;
                font-weight: 700;
                color: ${snapshot.healthFactor < 1.5 ? '#ff6464' : '#dcfd8f'};
              `}
            >
              {snapshot.healthFactor.toFixed(2)}
            </p>
          </div>
          <div>
            <p
              css={css`
                font-size: 0.75rem;
                color: #a0a0a0;
                margin-bottom: 0.25rem;
              `}
            >
              Risk Score
            </p>
            <p
              css={css`
                font-size: 1.125rem;
                font-weight: 700;
                color: ${riskColor};
              `}
            >
              {riskScore}
            </p>
          </div>
          <div>
            <p
              css={css`
                font-size: 0.75rem;
                color: #a0a0a0;
                margin-bottom: 0.25rem;
              `}
            >
              Leverage
            </p>
            <p
              css={css`
                font-size: 0.875rem;
                color: #fff;
              `}
            >
              {snapshot.leverage.toFixed(1)}x
            </p>
          </div>
          <div>
            <p
              css={css`
                font-size: 0.75rem;
                color: #a0a0a0;
                margin-bottom: 0.25rem;
              `}
            >
              Collateral
            </p>
            <p
              css={css`
                font-size: 0.875rem;
                color: #fff;
              `}
            >
              ${snapshot.collateralValue.toLocaleString()}
            </p>
          </div>
        </div>
      ) : (
        <div
          css={css`
            text-align: center;
            padding: 1.5rem 0;
            color: #666;
            font-size: 0.875rem;
          `}
        >
          No snapshot data
        </div>
      )}

      {/* Footer */}
      <div
        css={css`
          padding-top: 0.75rem;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          justify-content: space-between;
          align-items: center;
        `}
      >
        <span
          css={css`
            display: flex;
            align-items: center;
            gap: 0.375rem;
            font-size: 0.75rem;
            color: ${account.isActive ? '#dcfd8f' : '#666'};
          `}
        >
          <span
            css={css`
              width: 6px;
              height: 6px;
              border-radius: 50%;
              background: ${account.isActive ? '#dcfd8f' : '#666'};
            `}
          />
          {account.isActive ? 'Active' : 'Inactive'}
        </span>
        {snapshot && (
          <span
            css={css`
              font-size: 0.75rem;
              color: #666;
            `}
          >
            HVIX: {snapshot.hvixValue.toFixed(2)}
          </span>
        )}
      </div>
    </div>
  );
}

export default AccountCard;
