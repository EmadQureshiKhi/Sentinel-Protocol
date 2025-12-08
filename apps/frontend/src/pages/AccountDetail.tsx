/**
 * Account Detail Page
 * Shows detailed account information with protection options
 */

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

// Token mints
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

export default function AccountDetail() {
  const { wallet } = useParams<{ wallet: string }>();
  const navigate = useNavigate();
  
  const { data: account, isLoading, refetch } = useAccount(wallet || '');
  const { data: history } = useAccountHistory(wallet || '', { limit: 50 });
  useWebSocket(); // Initialize WebSocket connection
  const accountUpdates = useAccountSubscription(wallet || '');
  
  const [isProtectModalOpen, setIsProtectModalOpen] = useState(false);
  const [swapAmount, setSwapAmount] = useState(10);
  const [txStep, setTxStep] = useState<TransactionStep>('quote');
  const [txStatus, setTxStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [txError, setTxError] = useState<string>();
  const [txSignature, setTxSignature] = useState<string>();
  const [quoteData, setQuoteData] = useState<any>(null);

  // Use the query hook for quote
  const { refetch: refetchQuote, isFetching: isQuoteFetching } = useProtectionQuote(
    SOL_MINT,
    USDC_MINT,
    swapAmount * 1e9,
    100,
    false // disabled by default
  );
  const executeProtection = useExecuteProtection();

  // Refetch on WebSocket updates
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
      // Simulate
      await new Promise((r) => setTimeout(r, 1000));
      setTxStep('submit');

      // Execute
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
      setTxSignature(result.swapId); // Use swapId as signature placeholder
      refetch();
    } catch (error) {
      setTxStatus('error');
      setTxError(error instanceof Error ? error.message : 'Transaction failed');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="min-h-screen text-gray-100 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-[#dcfd8f] mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Account Not Found</h2>
          <p className="text-gray-400 mb-4">The requested account could not be found.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-[#dcfd8f] text-[#0a0e27] hover:opacity-90 rounded-lg font-semibold"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold font-mono">
              {wallet?.slice(0, 8)}...{wallet?.slice(-8)}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="px-2 py-1 bg-purple-900/50 text-purple-300 rounded text-sm">
                {account.protocol}
              </span>
              <span className={`flex items-center gap-1 text-sm ${account.isActive ? 'text-green-400' : 'text-gray-500'}`}>
                <span className={`w-2 h-2 rounded-full ${account.isActive ? 'bg-green-400' : 'bg-gray-500'}`}></span>
                {account.isActive ? 'Active' : 'Inactive'}
              </span>
              <a
                href={`https://solscan.io/account/${wallet}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-sm"
              >
                View on Solscan <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
          <button
            onClick={() => setIsProtectModalOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium flex items-center gap-2"
          >
            <Shield className="w-5 h-5" />
            Protect Position
          </button>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Position Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Position Overview */}
            <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
              <h2 className="text-lg font-semibold mb-4">Position Overview</h2>
              
              {latestSnapshot ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-900/50 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-1">Collateral</div>
                    <div className="text-xl font-bold">
                      ${latestSnapshot.collateralValue.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-1">Debt</div>
                    <div className="text-xl font-bold">
                      ${latestSnapshot.borrowedValue.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-1">Leverage</div>
                    <div className="text-xl font-bold">
                      {latestSnapshot.leverage.toFixed(2)}x
                    </div>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-1">Liquidation Price</div>
                    <div className="text-xl font-bold text-red-400">
                      ${latestSnapshot.liquidationPrice.toFixed(2)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No snapshot data available
                </div>
              )}
            </div>

            {/* Health Metrics */}
            <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
              <h2 className="text-lg font-semibold mb-4">Health Metrics</h2>
              
              {latestSnapshot ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-900/50 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-1 flex items-center gap-1">
                      <Activity className="w-4 h-4" />
                      Health Factor
                    </div>
                    <div className={`text-2xl font-bold ${
                      latestSnapshot.healthFactor < 1.1 ? 'text-red-400' :
                      latestSnapshot.healthFactor < 1.3 ? 'text-yellow-400' :
                      'text-green-400'
                    }`}>
                      {latestSnapshot.healthFactor.toFixed(2)}
                    </div>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-1 flex items-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      HVIX
                    </div>
                    <div className="text-2xl font-bold">
                      {latestSnapshot.hvixValue.toFixed(2)}
                    </div>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-1 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" />
                      Cascade Risk
                    </div>
                    <div className="text-2xl font-bold">
                      {(latestSnapshot.cascadeProbability * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-1 flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Time to Liq.
                    </div>
                    <div className="text-2xl font-bold">
                      {latestSnapshot.timeToLiquidation > 0 
                        ? `${Math.round(latestSnapshot.timeToLiquidation / 3600000)}h`
                        : 'Safe'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No health data available
                </div>
              )}
            </div>

            {/* History Chart Placeholder */}
            <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
              <h2 className="text-lg font-semibold mb-4">Health Factor History</h2>
              <div className="h-64 flex items-center justify-center text-gray-500">
                {history && history.length > 0 ? (
                  <div className="w-full">
                    {/* Simple text-based history for now */}
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {history.slice(0, 10).map((snapshot) => (
                        <div key={snapshot.id} className="flex justify-between text-sm">
                          <span className="text-gray-400">
                            {new Date(snapshot.createdAt).toLocaleString()}
                          </span>
                          <span className={
                            snapshot.healthFactor < 1.1 ? 'text-red-400' :
                            snapshot.healthFactor < 1.3 ? 'text-yellow-400' :
                            'text-green-400'
                          }>
                            HF: {snapshot.healthFactor.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  'No history data available'
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Risk & Actions */}
          <div className="space-y-6">
            {/* Risk Score */}
            <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
              <h2 className="text-lg font-semibold mb-4 text-center">Risk Score</h2>
              <div className="flex justify-center">
                <RiskGauge value={latestSnapshot?.riskScore || 0} size="lg" />
              </div>
              <div className="text-center mt-4">
                <span className={`text-lg font-semibold ${
                  (latestSnapshot?.riskScore || 0) >= 80 ? 'text-red-400' :
                  (latestSnapshot?.riskScore || 0) >= 60 ? 'text-orange-400' :
                  (latestSnapshot?.riskScore || 0) >= 40 ? 'text-yellow-400' :
                  'text-green-400'
                }`}>
                  {(latestSnapshot?.riskScore || 0) >= 80 ? 'Critical' :
                   (latestSnapshot?.riskScore || 0) >= 60 ? 'High Risk' :
                   (latestSnapshot?.riskScore || 0) >= 40 ? 'Moderate' :
                   'Safe'}
                </span>
              </div>
            </div>

            {/* Active Alerts */}
            <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
              <h2 className="text-lg font-semibold mb-4">Active Alerts</h2>
              {account.alerts && account.alerts.filter(a => a.status === 'ACTIVE').length > 0 ? (
                <div className="space-y-3">
                  {account.alerts.filter(a => a.status === 'ACTIVE').map((alert) => (
                    <div
                      key={alert.id}
                      className="bg-red-900/30 border border-red-700/50 rounded-lg p-3"
                    >
                      <div className="flex items-center gap-2 text-red-400 mb-1">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="font-medium">{alert.recommendedAction}</span>
                      </div>
                      <div className="text-sm text-gray-400">
                        Risk: {alert.riskScore}% • Est. Loss: ${alert.estimatedLosses.toFixed(0)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  No active alerts
                </div>
              )}
            </div>

            {/* Quick Protect */}
            <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
              <h2 className="text-lg font-semibold mb-4">Quick Protect</h2>
              <p className="text-sm text-gray-400 mb-4">
                Swap collateral to reduce leverage and improve health factor.
              </p>
              <button
                onClick={() => setIsProtectModalOpen(true)}
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium flex items-center justify-center gap-2"
              >
                <Shield className="w-5 h-5" />
                Open Protection Panel
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Protection Modal */}
      <Modal
        isOpen={isProtectModalOpen}
        onClose={() => {
          setIsProtectModalOpen(false);
          setTxStatus('idle');
          setTxStep('quote');
        }}
        title="Protect Position"
        size="lg"
      >
        <div className="space-y-6">
          {/* Swap Amount Input */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Swap Amount (SOL)</label>
            <input
              type="number"
              value={swapAmount}
              onChange={(e) => setSwapAmount(Number(e.target.value))}
              min={0.1}
              step={0.1}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:outline-none focus:border-blue-500"
            />
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
          <div className="flex gap-3">
            {txStatus === 'idle' && !quoteData && (
              <button
                onClick={handleGetQuote}
                disabled={isQuoteFetching}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg font-medium"
              >
                {isQuoteFetching ? 'Getting Quote...' : 'Get Quote'}
              </button>
            )}
            
            {quoteData && txStatus === 'idle' && (
              <button
                onClick={handleExecuteProtection}
                className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-medium"
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
                className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium"
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
                className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium"
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
