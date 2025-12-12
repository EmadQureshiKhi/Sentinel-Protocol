/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';
import { useState } from 'react';
import { Rocket, CircleNotch, CheckCircle, Warning } from '@phosphor-icons/react';
import { useOpenPosition, ProtocolQuote, TOKEN_MINTS } from '../../hooks/usePositions';
import { useToast } from '../../contexts/ToastContext';

interface OpenPositionButtonProps {
  quote: ProtocolQuote | null;
  walletAddress: string | null;
  collateralToken: string;
  collateralAmount: number;
  borrowToken: string;
  selectedProtocol: string | null;
  autoMonitor: boolean;
  enableAlerts: boolean;
  onSuccess?: (positionId: string) => void;
  disabled?: boolean;
}

const OpenPositionButton = ({
  quote,
  walletAddress,
  collateralToken,
  collateralAmount,
  borrowToken,
  selectedProtocol,
  autoMonitor,
  enableAlerts,
  onSuccess,
  disabled,
}: OpenPositionButtonProps) => {
  const { mutateAsync: openPosition, isPending } = useOpenPosition();
  const { addToast } = useToast();
  const [showConfirm, setShowConfirm] = useState(false);

  const canOpen = quote && walletAddress && selectedProtocol && collateralAmount > 0 && !disabled;

  const handleOpenPosition = async () => {
    if (!canOpen || !quote) return;

    try {
      const result = await openPosition({
        walletAddress,
        protocol: selectedProtocol,
        collateralToken,
        collateralMint: TOKEN_MINTS[collateralToken] || collateralToken,
        collateralAmount,
        borrowToken,
        borrowMint: TOKEN_MINTS[borrowToken] || borrowToken,
        borrowAmount: quote.borrowAmount,
        leverage: quote.totalPositionValue / (collateralAmount * (quote.totalPositionValue / quote.borrowAmount - quote.borrowAmount / quote.totalPositionValue + 1)),
        slippageBps: 50,
        autoMonitor,
        enableAlerts,
      });

      if (result.success) {
        addToast({
          type: 'success',
          title: 'Position Created',
          message: `Successfully opened ${selectedProtocol} position`,
        });
        setShowConfirm(false);
        if (onSuccess && result.positionId) {
          onSuccess(result.positionId);
        }
      } else {
        addToast({
          type: 'error',
          title: 'Failed to Open Position',
          message: result.error || 'Unknown error occurred',
        });
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to open position',
      });
    }
  };

  if (!walletAddress) {
    return (
      <button
        disabled
        css={css`
          width: 100%;
          padding: 1rem;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          color: var(--text-tertiary);
          font-size: 0.875rem;
          font-weight: 600;
          cursor: not-allowed;
        `}
      >
        Connect Wallet to Open Position
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        disabled={!canOpen || isPending}
        css={css`
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 1rem;
          background: ${canOpen ? 'var(--clr-primary)' : 'var(--bg-surface)'};
          border: 1px solid ${canOpen ? 'var(--clr-primary)' : 'var(--border-subtle)'};
          border-radius: 12px;
          color: ${canOpen ? 'var(--bg-base)' : 'var(--text-tertiary)'};
          font-size: 0.875rem;
          font-weight: 600;
          cursor: ${canOpen ? 'pointer' : 'not-allowed'};
          transition: all 0.15s;

          &:hover:not(:disabled) {
            opacity: 0.9;
          }
        `}
      >
        {isPending ? (
          <>
            <CircleNotch size={18} css={css`animation: spin 1s linear infinite; @keyframes spin { to { transform: rotate(360deg); } }`} />
            Opening Position...
          </>
        ) : (
          <>
            <Rocket size={18} weight="fill" />
            Open Position
          </>
        )}
      </button>

      {/* Confirmation Modal */}
      {showConfirm && quote && (
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
          onClick={() => setShowConfirm(false)}
        >
          <div
            css={css`
              background: var(--bg-surface);
              border: 1px solid var(--border-subtle);
              border-radius: 16px;
              max-width: 400px;
              width: 100%;
              overflow: hidden;
            `}
            onClick={e => e.stopPropagation()}
          >
            <div css={css`
              padding: 1.25rem;
              border-bottom: 1px solid var(--border-subtle);
            `}>
              <h3 css={css`font-size: 1rem; font-weight: 600; color: var(--text-primary);`}>
                Confirm Position
              </h3>
            </div>

            <div css={css`padding: 1.25rem;`}>
              <div css={css`
                display: flex;
                flex-direction: column;
                gap: 0.75rem;
                margin-bottom: 1rem;
              `}>
                <div css={css`display: flex; justify-content: space-between;`}>
                  <span css={css`color: var(--text-secondary);`}>Protocol</span>
                  <span css={css`font-weight: 600; color: var(--text-primary);`}>{selectedProtocol}</span>
                </div>
                <div css={css`display: flex; justify-content: space-between;`}>
                  <span css={css`color: var(--text-secondary);`}>Deposit</span>
                  <span css={css`font-weight: 600; color: var(--text-primary);`}>{collateralAmount} {collateralToken}</span>
                </div>
                <div css={css`display: flex; justify-content: space-between;`}>
                  <span css={css`color: var(--text-secondary);`}>Borrow</span>
                  <span css={css`font-weight: 600; color: var(--text-primary);`}>{quote.borrowAmount.toFixed(2)} {borrowToken}</span>
                </div>
                <div css={css`display: flex; justify-content: space-between;`}>
                  <span css={css`color: var(--text-secondary);`}>Health Factor</span>
                  <span css={css`
                    font-weight: 600;
                    color: ${quote.healthFactor >= 1.5 ? 'var(--status-success)' : 'var(--status-warning)'};
                  `}>{quote.healthFactor.toFixed(2)}</span>
                </div>
              </div>

              {quote.healthFactor < 1.5 && (
                <div css={css`
                  display: flex;
                  align-items: center;
                  gap: 0.5rem;
                  padding: 0.75rem;
                  background: var(--status-warning-bg);
                  border-radius: 8px;
                  margin-bottom: 1rem;
                `}>
                  <Warning size={16} css={css`color: var(--status-warning);`} />
                  <span css={css`font-size: 0.75rem; color: var(--status-warning);`}>
                    Low health factor - high liquidation risk
                  </span>
                </div>
              )}

              <div css={css`display: flex; gap: 0.75rem;`}>
                <button
                  onClick={() => setShowConfirm(false)}
                  css={css`
                    flex: 1;
                    padding: 0.75rem;
                    background: transparent;
                    border: 1px solid var(--border-default);
                    border-radius: 8px;
                    color: var(--text-secondary);
                    font-weight: 600;
                    cursor: pointer;
                    &:hover { border-color: var(--text-secondary); }
                  `}
                >
                  Cancel
                </button>
                <button
                  onClick={handleOpenPosition}
                  disabled={isPending}
                  css={css`
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.375rem;
                    padding: 0.75rem;
                    background: var(--clr-primary);
                    border: none;
                    border-radius: 8px;
                    color: var(--bg-base);
                    font-weight: 600;
                    cursor: pointer;
                    &:hover { opacity: 0.9; }
                    &:disabled { opacity: 0.5; cursor: not-allowed; }
                  `}
                >
                  {isPending ? (
                    <CircleNotch size={16} css={css`animation: spin 1s linear infinite;`} />
                  ) : (
                    <CheckCircle size={16} weight="fill" />
                  )}
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default OpenPositionButton;
