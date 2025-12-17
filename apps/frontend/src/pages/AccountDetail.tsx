/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Shield,
  AlertTriangle,
  TrendingUp,
  Clock,
  Activity,
  ExternalLink,
} from 'lucide-react';
import { useAccount, useAccountHistory } from '../hooks/useAccounts';
import { useProtectionQuote, useExecuteProtection } from '../hooks/useProtection';
import { useWebSocket, useAccountSubscription } from '../hooks/useWebSocket';
import { RiskGauge } from '../components/dashboard';
import { SwapPreview, TransactionStatus } from '../components/protection';
import { LoadingSpinner, Modal } from '../components/common';

type TransactionStep = 'quote' | 'build' | 'simulate' | 'submit' | 'confirm';

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

export default function AccountDetail() {
  const { wallet } = useParams<{ wallet: string }>();
  const navigate = useNavigate();
  
  const { data: account, isLoading, refetch } = useAccount(wallet || '');
  const { data: history } = useAccountHistory(wallet || '', { limit: 50 });
  useWebSocket();
  const accountUpdates = useAccountSubscription(wallet || '');
  
  const [isProtectModalOpen, setIsProtectModalOpen] = useState(false);
  const [swapAmount, setSwapAmount] = useState(1);
  const [txStep, setTxStep] = useState<TransactionStep>('quote');
  const [txStatus, setTxStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [txError, setTxError] = useState<string>();
  const [txSignature, setTxSignature] = useState<string>();
  const [quoteData, setQuoteData] = useState<any>(null);

  const { refetch: refetchQuote, isFetching: isQuoteFetching } = useProtectionQuote(
    SOL_MINT,
    USDC_MINT,
    swapAmount * 1e9,
    100,
    false
  );
  const executeProtection = useExecuteProtection();

  useEffect(() => {
    if (accountUpdates.length > 0) {
      refetch();
    }
  }, [accountUpdates, refetch]);

  const latestSnapshot = account?.snapshots?.[0];

  const handleGetQuote = async () => {
    if (!wallet) return;
    
    setTxStatus('processing');
    setTxStep('quote');
    setTxError(undefined);

    try {
      const result = await refetchQuote();
      if (result.data) {
        setQuoteData(result.data);
        setTxStep('build');
        setTxStatus('idle');
      }
    } catch (error) {
      setTxStatus('error');
      setTxError(error instanceof Error ? error.message : 'Failed to get quote');
    }
  };

  const handleExecuteProtection = async () => {
    if (!wallet) return;

    setTxStatus('processing');
    setTxStep('simulate');

    try {
      await new Promise((r) => setTimeout(r, 1000));
      setTxStep('submit');

      const result = await executeProtection.mutateAsync({
        walletAddress: wallet,
        inputMint: SOL_MINT,
        outputMint: USDC_MINT,
        amount: swapAmount * 1e9,
        useJito: true,
      });

      setTxStep('confirm');
      await new Promise((r) => setTimeout(r, 1500));
      
      setTxStatus('success');
      setTxSignature(result.swapId);
      refetch();
    } catch (error) {
      setTxStatus('error');
      setTxError(error instanceof Error ? error.message : 'Transaction failed');
    }
  };

  if (isLoading) {
    return (
      <div css={css`min-height: 100vh; display: flex; align-items: center; justify-content: center;`}>
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!account) {
    return (
      <div css={css`min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 2rem;`}>
        <div css={css`text-align: center;`}>
          <AlertTriangle css={css`width: 4rem; height: 4rem; color: var(--clr-primary); margin: 0 auto 1rem;`} />
          <h2 css={css`font-size: 1.5rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem;`}>
            Account Not Found
          </h2>
          <p css={css`color: var(--text-secondary); margin-bottom: 1.5rem;`}>
            The requested account could not be found.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            css={css`
              padding: 0.75rem 1.5rem;
              background: var(--clr-primary);
              color: var(--clr-black);
              border: none;
              border-radius: 0.5rem;
              font-weight: 600;
              cursor: pointer;
              &:hover { opacity: 0.9; }
            `}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div css={css`min-height: 100vh; padding: 1.5rem 2rem;`}>
      <div css={css`max-width: 1600px; margin: 0 auto;`}>
        
        {/* Header */}
        <div css={css`display: flex; align-items: center; gap: 1rem; margin-bottom: 2rem;`}>
          <button
            onClick={() => navigate('/dashboard')}
            css={css`
              padding: 0.5rem;
              background: transparent;
              border: none;
              cursor: pointer;
              color: var(--text-secondary);
              display: flex;
              align-items: center;
              border-radius: 0.5rem;
              transition: all 0.2s;
              &:hover { background: var(--bg-surface-hover); }
            `}
          >
            <ArrowLeft size={20} />
          </button>
          <div css={css`flex: 1;`}>
            <h1 css={css`font-size: 1.5rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem; font-family: monospace;`}>
              {wallet?.slice(0, 8)}...{wallet?.slice(-8)}
            </h1>
            <div css={css`display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;`}>
              <span css={css`
                padding: 0.25rem 0.75rem;
                background: var(--clr-primary-bg);
                color: var(--clr-primary);
                border-radius: 0.375rem;
                font-size: 0.75rem;
                fontWeight: 600;
                border: 1px solid var(--clr-primary-border);
              `}>
                {account.protocol}
              </span>
              <span css={css`
                display: flex;
                align-items: center;
                gap: 0.375rem;
                font-size: 0.75rem;
                color: ${account.isActive ? 'var(--status-success)' : 'var(--text-tertiary)'};
              `}>
                <span css={css`
                  width: 6px;
                  height: 6px;
                  border-radius: 50%;
                  background: ${account.isActive ? 'var(--status-success)' : 'var(--text-tertiary)'};
                `}></span>
                {account.isActive ? 'Active' : 'Inactive'}
              </span>
              <a
                href={`https://solscan.io/account/${wallet}`}
                target="_blank"
                rel="noopener noreferrer"
                css={css`
                  color: var(--text-secondary);
                  font-size: 0.75rem;
                  display: flex;
                  align-items: center;
                  gap: 0.25rem;
                  text-decoration: none;
                  transition: color 0.2s;
                  &:hover { color: var(--clr-primary); }
                `}
              >
                View on Solscan <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div css={css`display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;`}>
          
          {/* Position Overview */}
          <div css={css`
            background: var(--bg-card);
            border-radius: 0.75rem;
            border: 1px solid var(--border-default);
            padding: 1.5rem;
          `}>
            <h2 css={css`font-size: 1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 1rem;`}>
              Position Overview
            </h2>
            
            {latestSnapshot ? (
              <div css={css`display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;`}>
                <div css={css`background: var(--bg-surface); border-radius: 0.5rem; padding: 1rem; border: 1px solid var(--border-subtle);`}>
                  <div css={css`font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.5rem;`}>Collateral</div>
                  <div css={css`font-size: 1.25rem; font-weight: 600; color: var(--text-primary);`}>
                    ${latestSnapshot.collateralValue.toFixed(2)}
                  </div>
                </div>
                <div css={css`background: var(--bg-surface); border-radius: 0.5rem; padding: 1rem; border: 1px solid var(--border-subtle);`}>
                  <div css={css`font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.5rem;`}>Debt</div>
                  <div css={css`font-size: 1.25rem; font-weight: 600; color: var(--text-primary);`}>
                    ${latestSnapshot.borrowedValue.toFixed(2)}
                  </div>
                </div>
                <div css={css`background: var(--bg-surface); border-radius: 0.5rem; padding: 1rem; border: 1px solid var(--border-subtle);`}>
                  <div css={css`font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.5rem;`}>Leverage</div>
                  <div css={css`font-size: 1.25rem; font-weight: 600; color: var(--clr-primary);`}>
                    {latestSnapshot.leverage.toFixed(2)}x
                  </div>
                </div>
                <div css={css`background: var(--bg-surface); border-radius: 0.5rem; padding: 1rem; border: 1px solid var(--border-subtle);`}>
                  <div css={css`font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.5rem;`}>Liquidation Price</div>
                  <div css={css`font-size: 1.25rem; font-weight: 600; color: var(--status-danger);`}>
                    ${latestSnapshot.liquidationPrice.toFixed(2)}
                  </div>
                </div>
              </div>
            ) : (
              <div css={css`text-align: center; padding: 2rem; color: var(--text-tertiary);`}>
                No snapshot data available
              </div>
            )}
          </div>

          {/* Health Metrics */}
          <div css={css`
            background: var(--bg-card);
            border-radius: 0.75rem;
            border: 1px solid var(--border-default);
            padding: 1.5rem;
          `}>
            <h2 css={css`font-size: 1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 1rem;`}>
              Health Metrics
            </h2>
            
            {latestSnapshot ? (
              <div css={css`display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;`}>
                <div css={css`background: var(--bg-surface); border-radius: 0.5rem; padding: 1rem; border: 1px solid var(--border-subtle);`}>
                  <div css={css`font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.375rem;`}>
                    <Activity size={14} /> Health Factor
                  </div>
                  <div css={css`
                    font-size: 1.25rem;
                    font-weight: 600;
                    color: ${latestSnapshot.healthFactor < 1.1 ? 'var(--status-danger)' :
                            latestSnapshot.healthFactor < 1.3 ? 'var(--status-warning)' :
                            'var(--status-success)'};
                  `}>
                    {latestSnapshot.healthFactor.toFixed(2)}
                  </div>
                </div>
                <div css={css`background: var(--bg-surface); border-radius: 0.5rem; padding: 1rem; border: 1px solid var(--border-subtle);`}>
                  <div css={css`font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.375rem;`}>
                    <TrendingUp size={14} /> HVIX
                  </div>
                  <div css={css`font-size: 1.25rem; font-weight: 600; color: var(--text-primary);`}>
                    {latestSnapshot.hvixValue.toFixed(2)}
                  </div>
                </div>
                <div css={css`background: var(--bg-surface); border-radius: 0.5rem; padding: 1rem; border: 1px solid var(--border-subtle);`}>
                  <div css={css`font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.375rem;`}>
                    <AlertTriangle size={14} /> Cascade Risk
                  </div>
                  <div css={css`font-size: 1.25rem; font-weight: 600; color: var(--text-primary);`}>
                    {(latestSnapshot.cascadeProbability * 100).toFixed(1)}%
                  </div>
                </div>
                <div css={css`background: var(--bg-surface); border-radius: 0.5rem; padding: 1rem; border: 1px solid var(--border-subtle);`}>
                  <div css={css`font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.375rem;`}>
                    <Clock size={14} /> Time to Liq.
                  </div>
                  <div css={css`font-size: 1.25rem; font-weight: 600; color: var(--status-success);`}>
                    {latestSnapshot.timeToLiquidation > 0 ? `${latestSnapshot.timeToLiquidation}h` : 'Safe'}
                  </div>
                </div>
              </div>
            ) : (
              <div css={css`text-align: center; padding: 2rem; color: var(--text-tertiary);`}>
                No health data available
              </div>
            )}
          </div>

          {/* Risk Score */}
          <div css={css`
            background: var(--bg-card);
            border-radius: 0.75rem;
            border: 1px solid var(--border-default);
            padding: 1.5rem;
          `}>
            <h2 css={css`font-size: 1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 1rem; text-align: center;`}>
              Risk Score
            </h2>
            <div css={css`display: flex; justify-content: center; margin-bottom: 1rem;`}>
              <RiskGauge value={latestSnapshot?.riskScore || 0} size="lg" />
            </div>
            <div css={css`text-align: center;`}>
              <span css={css`
                font-size: 0.875rem;
                font-weight: 600;
                padding: 0.5rem 1rem;
                border-radius: 0.5rem;
                background: ${(latestSnapshot?.riskScore || 0) >= 80 ? 'var(--status-danger-bg)' :
                             (latestSnapshot?.riskScore || 0) >= 60 ? 'var(--status-warning-bg)' :
                             'var(--status-success-bg)'};
                color: ${(latestSnapshot?.riskScore || 0) >= 80 ? 'var(--status-danger)' :
                         (latestSnapshot?.riskScore || 0) >= 60 ? 'var(--status-warning)' :
                         'var(--status-success)'};
              `}>
                {(latestSnapshot?.riskScore || 0) >= 80 ? 'Critical' :
                 (latestSnapshot?.riskScore || 0) >= 60 ? 'High Risk' :
                 (latestSnapshot?.riskScore || 0) >= 40 ? 'Moderate' :
                 'Safe'}
              </span>
            </div>
          </div>

          {/* Quick Protect */}
          <div css={css`
            background: var(--clr-primary-bg);
            border-radius: 0.75rem;
            border: 1px solid var(--clr-primary-border);
            padding: 1.5rem;
          `}>
            <h2 css={css`font-size: 1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.75rem;`}>
              Quick Protect
            </h2>
            <p css={css`font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 1rem;`}>
              Swap collateral to reduce leverage with MEV protection.
            </p>
            <button
              onClick={() => setIsProtectModalOpen(true)}
              css={css`
                width: 100%;
                padding: 0.75rem;
                background: var(--clr-primary);
                color: var(--clr-black);
                border: none;
                border-radius: 0.5rem;
                font-weight: 600;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-center;
                gap: 0.5rem;
                transition: all 0.2s;
                &:hover { transform: translateY(-1px); opacity: 0.9; }
              `}
            >
              <Shield size={18} />
              Open Protection Panel
            </button>
          </div>

        </div>

        {/* History Section */}
        {history && history.length > 0 && (
          <div css={css`
            background: var(--bg-card);
            border-radius: 0.75rem;
            border: 1px solid var(--border-default);
            padding: 1.5rem;
            margin-top: 1.5rem;
          `}>
            <h2 css={css`font-size: 1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 1rem;`}>
              Health Factor History
            </h2>
            <div css={css`max-height: 300px; overflow-y: auto;`} className="custom-scrollbar">
              <div css={css`display: flex; flex-direction: column; gap: 0.5rem;`}>
                {history.slice(0, 15).map((snapshot) => (
                  <div
                    key={snapshot.id}
                    css={css`
                      display: flex;
                      justify-between;
                      align-items: center;
                      padding: 0.75rem;
                      background: var(--bg-surface);
                      border-radius: 0.5rem;
                      border: 1px solid var(--border-subtle);
                      font-size: 0.875rem;
                    `}
                  >
                    <span css={css`color: var(--text-secondary); font-family: monospace; font-size: 0.75rem;`}>
                      {new Date(snapshot.createdAt).toLocaleString()}
                    </span>
                    <span css={css`
                      font-weight: 600;
                      color: ${snapshot.healthFactor < 1.1 ? 'var(--status-danger)' :
                               snapshot.healthFactor < 1.3 ? 'var(--status-warning)' :
                               'var(--status-success)'};
                    `}>
                      HF: {snapshot.healthFactor.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Protection Modal */}
      <Modal
        isOpen={isProtectModalOpen}
        onClose={() => {
          setIsProtectModalOpen(false);
          setTxStatus('idle');
          setTxStep('quote');
        }}
        title="🛡️ Protect Position"
        size="lg"
      >
        <div css={css`display: flex; flex-direction: column; gap: 1.5rem;`}>
          {/* Info Banner */}
          <div css={css`
            background: var(--clr-primary-bg);
            border: 1px solid var(--clr-primary-border);
            border-radius: 0.75rem;
            padding: 1rem;
            display: flex;
            gap: 0.75rem;
          `}>
            <Shield size={20} css={css`color: var(--clr-primary); flex-shrink: 0;`} />
            <div>
              <h3 css={css`font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem; font-size: 0.875rem;`}>
                MEV-Protected Swap
              </h3>
              <p css={css`font-size: 0.75rem; color: var(--text-secondary);`}>
                Swap volatile collateral (SOL) to stable (USDC) with MEV protection via Jupiter + Jito bundles.
              </p>
            </div>
          </div>

          {/* Swap Amount Input */}
          <div>
            <label css={css`display: block; font-size: 0.875rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem;`}>
              Swap Amount
            </label>
            <div css={css`position: relative;`}>
              <input
                type="number"
                value={swapAmount}
                onChange={(e) => setSwapAmount(Number(e.target.value))}
                min={0.1}
                step={0.1}
                css={css`
                  width: 100%;
                  padding: 0.75rem 3rem 0.75rem 1rem;
                  background: var(--bg-surface);
                  border: 1px solid var(--border-default);
                  border-radius: 0.5rem;
                  color: var(--text-primary);
                  font-size: 1rem;
                  font-family: monospace;
                  &:focus {
                    outline: none;
                    border-color: var(--clr-primary);
                  }
                `}
                placeholder="0.0"
              />
              <span css={css`
                position: absolute;
                right: 1rem;
                top: 50%;
                transform: translateY(-50%);
                color: var(--text-secondary);
                font-weight: 600;
                font-size: 0.875rem;
              `}>
                SOL
              </span>
            </div>
            <p css={css`font-size: 0.75rem; color: var(--text-tertiary); margin-top: 0.5rem;`}>
              Minimum: 0.1 SOL
            </p>
          </div>

          {/* Quote Preview */}
          {quoteData && (
            <SwapPreview
              fromToken="SOL"
              toToken="USDC"
              inputAmount={swapAmount}
              outputAmount={Number(quoteData.quote.outAmount) / 1e6}
              standardSlippage={quoteData.mevAnalysis.standardSlippage}
              protectedSlippage={quoteData.mevAnalysis.protectedSlippage}
              mevSavings={quoteData.mevAnalysis.estimatedMevSavings}
              priceImpact={Number(quoteData.quote.priceImpactPct)}
            />
          )}

          {/* Transaction Status */}
          {txStatus !== 'idle' && (
            <TransactionStatus
              currentStep={txStep}
              status={txStatus}
              errorMessage={txError}
              transactionSignature={txSignature}
            />
          )}

          {/* Action Buttons */}
          <div css={css`display: flex; gap: 0.75rem;`}>
            {txStatus === 'idle' && !quoteData && (
              <button
                onClick={handleGetQuote}
                disabled={isQuoteFetching}
                css={css`
                  flex: 1;
                  padding: 0.75rem;
                  background: var(--clr-primary);
                  color: var(--clr-black);
                  border: none;
                  border-radius: 0.5rem;
                  font-weight: 600;
                  cursor: pointer;
                  transition: all 0.2s;
                  &:hover:not(:disabled) { opacity: 0.9; }
                  &:disabled { opacity: 0.5; cursor: not-allowed; }
                `}
              >
                {isQuoteFetching ? 'Getting Quote...' : 'Get Quote'}
              </button>
            )}
            
            {quoteData && txStatus === 'idle' && (
              <button
                onClick={handleExecuteProtection}
                css={css`
                  flex: 1;
                  padding: 0.75rem;
                  background: var(--clr-primary);
                  color: var(--clr-black);
                  border: none;
                  border-radius: 0.5rem;
                  font-weight: 600;
                  cursor: pointer;
                  transition: all 0.2s;
                  &:hover { opacity: 0.9; }
                `}
              >
                Execute Protected Swap
              </button>
            )}

            {txStatus === 'success' && (
              <button
                onClick={() => {
                  setIsProtectModalOpen(false);
                  setTxStatus('idle');
                  setTxStep('quote');
                  setQuoteData(null);
                }}
                css={css`
                  flex: 1;
                  padding: 0.75rem;
                  background: var(--clr-primary);
                  color: var(--clr-black);
                  border: none;
                  border-radius: 0.5rem;
                  font-weight: 600;
                  cursor: pointer;
                  &:hover { opacity: 0.9; }
                `}
              >
                Close
              </button>
            )}

            {txStatus === 'error' && (
              <button
                onClick={() => {
                  setTxStatus('idle');
                  setTxStep('quote');
                }}
                css={css`
                  flex: 1;
                  padding: 0.75rem;
                  background: var(--bg-surface);
                  color: var(--text-primary);
                  border: 1px solid var(--border-default);
                  border-radius: 0.5rem;
                  font-weight: 600;
                  cursor: pointer;
                  &:hover { background: var(--bg-surface-hover); }
                `}
              >
                Try Again
              </button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
