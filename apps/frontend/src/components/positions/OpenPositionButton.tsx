/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';
import { useState } from 'react';
import { Rocket, CircleNotch, CheckCircle, Warning } from '@phosphor-icons/react';
import { useOpenPosition, ProtocolQuote, TOKEN_MINTS, positionKeys } from '../../hooks/usePositions';
import { useToast } from '../../contexts/ToastContext';
import { useWallet as useSolanaWallet, useConnection } from '@solana/wallet-adapter-react';
import { Transaction } from '@solana/web3.js';
import { api } from '../../services/api';
import { useQueryClient } from '@tanstack/react-query';

// Helper to create toast-like interface from context
const useToastAdapter = () => {
  const { showToast, showSuccess, showError } = useToast();
  return {
    addToast: ({ type, title, message }: { type: 'success' | 'error' | 'warning' | 'info'; title: string; message?: string }) => {
      if (type === 'success') {
        showSuccess(title, message);
      } else if (type === 'error') {
        showError(title, message);
      } else {
        showToast({ type, title, message });
      }
    }
  };
};

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
  const { addToast } = useToastAdapter();
  const { signTransaction } = useSolanaWallet();
  const { connection: solanaConnection } = useConnection();
  const queryClient = useQueryClient();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canOpen = quote && walletAddress && selectedProtocol && collateralAmount > 0 && !disabled && signTransaction;

  const handleOpenPosition = async () => {
    if (!canOpen || !quote || !signTransaction) return;

    setIsSubmitting(true);
    try {
      // Step 1: Get the unsigned transaction from backend
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

      if (!result.success) {
        addToast({
          type: 'error',
          title: 'Failed to Build Transaction',
          message: result.error || 'Unknown error occurred',
        });
        return;
      }

      if (!result.transaction) {
        addToast({
          type: 'error',
          title: 'No Transaction',
          message: 'Backend did not return a transaction to sign',
        });
        return;
      }

      // Step 2: Decode and sign the transaction
      addToast({
        type: 'info',
        title: 'Signing Transaction',
        message: 'Please approve the transaction in your wallet',
      });

      const txBuffer = Buffer.from(result.transaction, 'base64');
      const transaction = Transaction.from(txBuffer);

      // Sign with wallet adapter's signTransaction
      const signedTx = await signTransaction(transaction);

      // Step 3: Send the signed transaction using the connection from wallet adapter
      const signature = await solanaConnection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      addToast({
        type: 'info',
        title: 'Transaction Submitted',
        message: `Waiting for confirmation... ${signature.slice(0, 8)}...`,
      });

      // Step 4: Wait for confirmation
      const confirmation = await solanaConnection.confirmTransaction(signature, 'confirmed');

      if (confirmation.value.err) {
        addToast({
          type: 'error',
          title: 'Transaction Failed',
          message: 'Transaction was not confirmed',
        });
        return;
      }

      // Step 5: Create position record in database after tx confirmation
      let positionId: string | undefined;
      if (result.positionData) {
        try {
          const confirmResult = await api.confirmPosition({
            ...result.positionData,
            txSignature: signature,
          });
          positionId = confirmResult.data?.id;
          
          // Invalidate queries to refresh UI
          if (walletAddress) {
            queryClient.invalidateQueries({ queryKey: positionKeys.transactions(walletAddress) });
            queryClient.invalidateQueries({ queryKey: positionKeys.list(walletAddress, 'mainnet-beta') });
          }
          
          addToast({
            type: 'success',
            title: 'Position Opened!',
            message: `Transaction confirmed: ${signature.slice(0, 8)}...`,
          });
        } catch (confirmError) {
          console.error('Failed to save position record:', confirmError);
          // Still show success since the on-chain tx succeeded
          addToast({
            type: 'success',
            title: 'Position Opened!',
            message: `Transaction confirmed but position tracking failed. Signature: ${signature.slice(0, 8)}...`,
          });
        }
      } else {
        addToast({
          type: 'success',
          title: 'Transaction Confirmed!',
          message: `Signature: ${signature.slice(0, 8)}...`,
        });
      }

      setShowConfirm(false);
      if (onSuccess && positionId) {
        onSuccess(positionId);
      }
    } catch (error: any) {
      console.error('Error opening position:', error);
      
      // Handle user rejection
      if (error.message?.includes('User rejected') || error.message?.includes('rejected')) {
        addToast({
          type: 'warning',
          title: 'Transaction Cancelled',
          message: 'You cancelled the transaction',
        });
      } else {
        addToast({
          type: 'error',
          title: 'Error',
          message: error instanceof Error ? error.message : 'Failed to open position',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const isLoading = isPending || isSubmitting;

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
        disabled={!canOpen || isLoading}
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
        {isLoading ? (
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
                  disabled={isLoading}
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
                  {isLoading ? (
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
