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
  const { showSuccess, showError } = useToast();
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  // Calculate health percentage
  const healthPercent = Math.round((1 - 1 / position.healthFactor) * 100);
  const healthColor = healthPercent >= 50 ? 'var(--status-success)' :
    healthPercent >= 25 ? 'var(--status-warning)' : 'var(--status-error)';

  const pnlColor = position.unrealizedPnl >= 0 ? 'var(--status-success)' : 'var(--status-error)';

  const handleClosePosition = async () => {
    try {
      // Step 1: Get the close transaction from backend
      const result = await closePosition({
        positionId: position.id,
        walletAddress,
        slippageBps: 50,
      });

      if (!result.success || !result.transaction) {
        showError('Failed to Close', result.error || 'No transaction returned');
        return;
      }

      // Step 2: Deserialize the transaction
      const { Connection, Transaction } = await import('@solana/web3.js');
      const connection = new Connection(
        import.meta.env.VITE_MAINNET_RPC_URL || 'https://api.mainnet-beta.solana.com',
        'confirmed'
      );

      // Deserialize transaction (legacy only for now)
      const transaction = Transaction.from(Buffer.from(result.transaction, 'base64'));

      // Step 3: Refresh the blockhash (CRITICAL - prevents "Blockhash not found" error)
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;

      // Step 4: Sign with wallet (Phantom/Solflare)
      const wallet = (window as any).solana || (window as any).solflare;
      if (!wallet) {
        showError('Wallet Not Found', 'Please connect your wallet');
        return;
      }

      const signedTx = await wallet.signTransaction(transaction);
      
      if (!signedTx) {
        showError('Signing Failed', 'Please approve the transaction in your wallet');
        return;
      }

      // Step 5: Send transaction
      const signature = await connection.sendRawTransaction(
        signedTx.serialize(),
        {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        }
      );

      // Step 6: Confirm transaction
      showSuccess('Transaction Sent', 'Confirming...');
      const confirmation = await connection.confirmTransaction(
        {
          signature,
          blockhash,
          lastValidBlockHeight,
        },
        'confirmed'
      );

      if (confirmation.value.err) {
        throw new Error('Transaction failed: ' + JSON.stringify(confirmation.value.err));
      }

      // Step 7: Confirm close in database (update status to CLOSED)
      try {
        const { api } = await import('../../services/api');
        await api.confirmClosePosition(position.id, {
          txSignature: signature,
          realizedPnl: result.realizedPnl || 0,
        });
      } catch (e) {
        console.warn('Failed to confirm close in database:', e);
      }

      // Step 8: Show success
      showSuccess('Position Closed', `Realized P&L: ${formatUsd(result.realizedPnl || 0)}`);
      onClose();
    } catch (error) {
      console.error('Close position error:', error);
      showError('Error', error instanceof Error ? error.message : 'Failed to close position');
    }
  };


  return (
    <div
      css={css`
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.85);
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
          background: var(--bg-base);
          border: 1px solid var(--border-subtle);
          border-radius: 16px;
          max-width: 480px;
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
          background: var(--bg-header);
        `}>
          <div css={css`display: flex; align-items: center; gap: 0.75rem;`}>
            <ProtocolBadge protocol={position.protocol} size="md" />
            <span css={css`font-size: 1rem; font-weight: 600; color: var(--text-primary);`}>
              {position.collateralToken}/{position.borrowToken}
            </span>
            <span css={css`
              padding: 0.125rem 0.5rem;
              background: var(--clr-primary-bg);
              color: var(--clr-primary);
              font-size: 0.75rem;
              font-weight: 700;
              border-radius: 4px;
            `}>
              {position.leverage.toFixed(1)}x
            </span>
          </div>
          <button
            onClick={onClose}
            css={css`
              background: transparent;
              border: none;
              color: var(--text-tertiary);
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
          {/* Summary Cards */}
          <div css={css`
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0.75rem;
            margin-bottom: 1.25rem;
          `}>
            {/* P&L Card */}
            <div css={css`
              padding: 1rem;
              background: var(--bg-surface);
              border: 1px solid var(--border-subtle);
              border-radius: 10px;
            `}>
              <div css={css`display: flex; align-items: center; gap: 0.375rem; margin-bottom: 0.5rem;`}>
                {position.unrealizedPnl >= 0 ? <TrendUp size={14} css={css`color: ${pnlColor};`} /> : <TrendDown size={14} css={css`color: ${pnlColor};`} />}
                <span css={css`font-size: 0.6875rem; color: var(--text-tertiary);`}>Unrealized P&L</span>
              </div>
              <div css={css`font-size: 1.25rem; font-weight: 700; color: ${pnlColor};`}>
                {formatUsd(position.unrealizedPnl)}
              </div>
              <div css={css`font-size: 0.75rem; color: var(--text-tertiary); margin-top: 0.25rem;`}>
                {formatPercent(position.unrealizedPnlPercent)}
              </div>
            </div>

            {/* Health Card */}
            <div css={css`
              padding: 1rem;
              background: var(--bg-surface);
              border: 1px solid var(--border-subtle);
              border-radius: 10px;
            `}>
              <div css={css`font-size: 0.6875rem; color: var(--text-tertiary); margin-bottom: 0.5rem;`}>Health</div>
              <div css={css`font-size: 1.25rem; font-weight: 700; color: ${healthColor};`}>
                {healthPercent}%
              </div>
              <div css={css`font-size: 0.75rem; color: var(--text-tertiary); margin-top: 0.25rem;`}>
                {healthPercent >= 50 ? 'Healthy' : healthPercent >= 25 ? 'Caution' : 'At Risk'}
              </div>
            </div>
          </div>


          {/* Position Details */}
          <div css={css`
            background: var(--bg-surface);
            border: 1px solid var(--border-subtle);
            border-radius: 10px;
            overflow: hidden;
            margin-bottom: 1.25rem;
          `}>
            <DetailRow label="Collateral" value={`${position.collateralAmount.toFixed(4)} ${position.collateralToken}`} subvalue={formatUsd(position.collateralValueUsd)} />
            <DetailRow label="Debt" value={`${position.borrowAmount.toFixed(2)} ${position.borrowToken}`} subvalue={formatUsd(position.borrowValueUsd)} />
            <DetailRow label="Entry Price" value={`$${position.entryPrice.toFixed(2)}`} />
            <DetailRow label="Current Price" value={`$${position.currentPrice.toFixed(2)}`} />
            <DetailRow
              label="Opened"
              value={new Date(position.openedAt).toLocaleDateString()}
              icon={<Clock size={14} />}
              isLast
            />
          </div>

          {/* Warning */}
          {healthPercent < 25 && (
            <div css={css`
              display: flex;
              align-items: center;
              gap: 0.5rem;
              padding: 0.75rem 1rem;
              background: rgba(245, 158, 11, 0.1);
              border: 1px solid rgba(245, 158, 11, 0.3);
              border-radius: 8px;
              margin-bottom: 1.25rem;
            `}>
              <Warning size={16} css={css`color: var(--status-warning);`} />
              <span css={css`font-size: 0.75rem; color: var(--status-warning);`}>
                Low health - consider adding collateral or closing position
              </span>
            </div>
          )}

          {/* Actions */}
          {position.status === 'OPEN' && (
            <button
              onClick={() => setShowCloseConfirm(true)}
              disabled={isPending}
              css={css`
                width: 100%;
                padding: 0.875rem;
                background: transparent;
                border: 1px solid var(--status-error);
                border-radius: 8px;
                color: var(--status-error);
                font-size: 0.875rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.15s;
                &:hover { background: var(--status-error); color: white; }
                &:disabled { opacity: 0.5; cursor: not-allowed; }
              `}
            >
              Close Position
            </button>
          )}
        </div>


        {/* Close Confirmation */}
        {showCloseConfirm && (
          <div css={css`
            padding: 1.25rem;
            border-top: 1px solid var(--border-subtle);
            background: var(--bg-surface);
          `}>
            <p css={css`font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 1rem;`}>
              Are you sure you want to close this position?
            </p>
            <div css={css`display: flex; gap: 0.75rem;`}>
              <button
                onClick={() => setShowCloseConfirm(false)}
                css={css`
                  flex: 1;
                  padding: 0.625rem;
                  background: transparent;
                  border: 1px solid var(--border-default);
                  border-radius: 6px;
                  color: var(--text-secondary);
                  font-size: 0.875rem;
                  cursor: pointer;
                  &:hover { border-color: var(--text-tertiary); }
                `}
              >
                Cancel
              </button>
              <button
                onClick={handleClosePosition}
                disabled={isPending}
                css={css`
                  flex: 1;
                  padding: 0.625rem;
                  background: var(--status-error);
                  border: none;
                  border-radius: 6px;
                  color: white;
                  font-size: 0.875rem;
                  font-weight: 600;
                  cursor: pointer;
                  &:hover { opacity: 0.9; }
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
const DetailRow = ({ label, value, subvalue, valueColor, icon, isLast }: {
  label: string;
  value: string;
  subvalue?: string;
  valueColor?: string;
  icon?: React.ReactNode;
  isLast?: boolean;
}) => (
  <div css={css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    ${!isLast && 'border-bottom: 1px solid var(--border-subtle);'}
  `}>
    <div css={css`display: flex; align-items: center; gap: 0.375rem; color: var(--text-tertiary); font-size: 0.8125rem;`}>
      {icon}
      {label}
    </div>
    <div css={css`text-align: right;`}>
      <div css={css`font-weight: 600; font-size: 0.875rem; color: ${valueColor || 'var(--text-primary)'};`}>{value}</div>
      {subvalue && <div css={css`font-size: 0.75rem; color: var(--text-tertiary);`}>{subvalue}</div>}
    </div>
  </div>
);

export default PositionDetailModal;
