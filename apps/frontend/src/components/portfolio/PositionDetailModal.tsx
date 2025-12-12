/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';
import { X, TrendUp, TrendDown, Warning, Clock } from '@phosphor-icons/react';
import ProtocolBadge from '../rates/ProtocolBadge';
import { PortfolioPosition, formatUsd, formatPercent } from '../../hooks/usePortfolio';
import { useClosePosition } from '../../hooks/usePositions';
import { useToast } from '../../contexts/ToastContext';
import { useState } from 'react';

interface PositionDetailModalProps {
  position: PortfolioPosition;
  walletAddress: string;
  onClose: () => void;
}

const PositionDetailModal = ({ position, walletAddress, onClose }: PositionDetailModalProps) => {
  const { mutateAsync: closePosition, isPending } = useClosePosition();
  const { addToast } = useToast();
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const healthColor = position.healthFactor >= 2 ? 'var(--status-success)' :
    position.healthFactor >= 1.5 ? 'var(--status-warning)' : 'var(--status-error)';

  const pnlColor = position.unrealizedPnl >= 0 ? 'var(--status-success)' : 'var(--status-error)';

  const handleClosePosition = async () => {
    try {
      const result = await closePosition({
        positionId: position.id,
        walletAddress,
        slippageBps: 50,
      });

      if (result.success) {
        addToast({
          type: 'success',
          title: 'Position Closed',
          message: `Realized P&L: ${formatUsd(result.realizedPnl)}`,
        });
        onClose();
      } else {
        addToast({
          type: 'error',
          title: 'Failed to Close',
          message: result.error || 'Unknown error',
        });
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to close position',
      });
    }
  };

  return (
    <div
      css={css`
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 1rem;
      `}
      onClick={onClose}
    >
      <div
        css={css`
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: 16px;
          max-width: 500px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
        `}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div css={css`
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.25rem;
          border-bottom: 1px solid var(--border-subtle);
        `}>
          <div css={css`display: flex; align-items: center; gap: 0.75rem;`}>
            <ProtocolBadge protocol={position.protocol} size="md" />
            <span css={css`font-size: 1rem; font-weight: 600; color: var(--text-primary);`}>
              {position.collateralToken}/{position.borrowToken}
            </span>
          </div>
          <button
            onClick={onClose}
            css={css`
              background: transparent;
              border: none;
              color: var(--text-secondary);
              cursor: pointer;
              padding: 0.25rem;
              &:hover { color: var(--text-primary); }
            `}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div css={css`padding: 1.25rem;`}>
          {/* P&L Summary */}
          <div css={css`
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            padding: 1.5rem;
            background: ${position.unrealizedPnl >= 0 ? 'var(--status-success-bg)' : 'var(--status-error-bg)'};
            border-radius: 12px;
            margin-bottom: 1.5rem;
          `}>
            {position.unrealizedPnl >= 0 ? <TrendUp size={24} /> : <TrendDown size={24} />}
            <div css={css`text-align: center;`}>
              <div css={css`font-size: 1.5rem; font-weight: 700; color: ${pnlColor};`}>
                {formatUsd(position.unrealizedPnl)}
              </div>
              <div css={css`font-size: 0.875rem; color: ${pnlColor}; opacity: 0.8;`}>
                {formatPercent(position.unrealizedPnlPercent)} unrealized
              </div>
            </div>
          </div>

          {/* Position Details */}
          <div css={css`
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            margin-bottom: 1.5rem;
          `}>
            <DetailRow label="Leverage" value={`${position.leverage.toFixed(1)}x`} />
            <DetailRow label="Collateral" value={`${position.collateralAmount.toFixed(4)} ${position.collateralToken}`} subvalue={formatUsd(position.collateralValueUsd)} />
            <DetailRow label="Debt" value={`${position.borrowAmount.toFixed(2)} ${position.borrowToken}`} subvalue={formatUsd(position.borrowValueUsd)} />
            <DetailRow label="Health Factor" value={position.healthFactor.toFixed(2)} valueColor={healthColor} />
            <DetailRow label="Liquidation Price" value={`$${position.liquidationPrice.toFixed(2)}`} valueColor="var(--status-error)" />
            <DetailRow label="Entry Price" value={`$${position.entryPrice.toFixed(2)}`} />
            <DetailRow label="Current Price" value={`$${position.currentPrice.toFixed(2)}`} />
            <DetailRow
              label="Opened"
              value={new Date(position.openedAt).toLocaleDateString()}
              icon={<Clock size={14} />}
            />
          </div>

          {/* Warning */}
          {position.healthFactor < 1.5 && (
            <div css={css`
              display: flex;
              align-items: center;
              gap: 0.5rem;
              padding: 0.75rem;
              background: var(--status-warning-bg);
              border: 1px solid var(--status-warning-border);
              border-radius: 8px;
              margin-bottom: 1.5rem;
            `}>
              <Warning size={18} css={css`color: var(--status-warning);`} />
              <span css={css`font-size: 0.75rem; color: var(--status-warning);`}>
                Low health factor - consider adding collateral or closing position
              </span>
            </div>
          )}

          {/* Actions */}
          {position.status === 'OPEN' && (
            <div css={css`display: flex; gap: 0.75rem;`}>
              <button
                onClick={() => setShowCloseConfirm(true)}
                disabled={isPending}
                css={css`
                  flex: 1;
                  padding: 0.75rem;
                  background: var(--status-error-bg);
                  border: 1px solid var(--status-error-border);
                  border-radius: 8px;
                  color: var(--status-error);
                  font-weight: 600;
                  cursor: pointer;
                  &:hover { opacity: 0.9; }
                  &:disabled { opacity: 0.5; cursor: not-allowed; }
                `}
              >
                Close Position
              </button>
            </div>
          )}
        </div>

        {/* Close Confirmation */}
        {showCloseConfirm && (
          <div css={css`
            padding: 1.25rem;
            border-top: 1px solid var(--border-subtle);
            background: var(--bg-header);
          `}>
            <p css={css`font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 1rem;`}>
              Are you sure you want to close this position?
            </p>
            <div css={css`display: flex; gap: 0.75rem;`}>
              <button
                onClick={() => setShowCloseConfirm(false)}
                css={css`
                  flex: 1;
                  padding: 0.5rem;
                  background: transparent;
                  border: 1px solid var(--border-default);
                  border-radius: 6px;
                  color: var(--text-secondary);
                  cursor: pointer;
                `}
              >
                Cancel
              </button>
              <button
                onClick={handleClosePosition}
                disabled={isPending}
                css={css`
                  flex: 1;
                  padding: 0.5rem;
                  background: var(--status-error);
                  border: none;
                  border-radius: 6px;
                  color: white;
                  font-weight: 600;
                  cursor: pointer;
                  &:disabled { opacity: 0.5; }
                `}
              >
                {isPending ? 'Closing...' : 'Confirm Close'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper component
const DetailRow = ({ label, value, subvalue, valueColor, icon }: {
  label: string;
  value: string;
  subvalue?: string;
  valueColor?: string;
  icon?: React.ReactNode;
}) => (
  <div css={css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border-subtle);
  `}>
    <div css={css`display: flex; align-items: center; gap: 0.375rem; color: var(--text-secondary); font-size: 0.875rem;`}>
      {icon}
      {label}
    </div>
    <div css={css`text-align: right;`}>
      <div css={css`font-weight: 600; color: ${valueColor || 'var(--text-primary)'};`}>{value}</div>
      {subvalue && <div css={css`font-size: 0.75rem; color: var(--text-tertiary);`}>{subvalue}</div>}
    </div>
  </div>
);

export default PositionDetailModal;
