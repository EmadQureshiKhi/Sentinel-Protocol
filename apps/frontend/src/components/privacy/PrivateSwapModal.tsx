/**
 * Private Swap Modal Component
 * Interface for executing private swaps via Arcium MXE - Black & Yellow theme
 */

import React, { useState } from 'react';
import { usePrivateSwaps } from '../../hooks/usePrivacy';

interface PrivateSwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string | null;
}

const TOKENS = [
  { symbol: 'SOL', name: 'Solana', mint: 'So11111111111111111111111111111111111111112' },
  { symbol: 'USDC', name: 'USD Coin', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
  { symbol: 'USDT', name: 'Tether', mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' },
  { symbol: 'ETH', name: 'Ethereum', mint: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs' },
];

export const PrivateSwapModal: React.FC<PrivateSwapModalProps> = ({
  isOpen,
  onClose,
  walletAddress,
}) => {
  const { loading, error, createSwapIntent, executeSwap } = usePrivateSwaps(walletAddress);
  const [step, setStep] = useState<'form' | 'confirm' | 'executing' | 'complete'>('form');
  const [intentId, setIntentId] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    fromToken: 'SOL',
    toToken: 'USDC',
    amount: '',
    slippage: '0.5',
  });

  const handleCreateIntent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount) return;

    const result = await createSwapIntent({
      fromToken: formData.fromToken,
      toToken: formData.toToken,
      amount: parseFloat(formData.amount),
      slippage: parseFloat(formData.slippage),
    });

    if (result) {
      setIntentId(result.intentId);
      setStep('confirm');
    }
  };

  const handleExecuteSwap = async () => {
    if (!intentId) return;

    setStep('executing');
    const result = await executeSwap(intentId);

    if (result?.success) {
      setTxSignature(result.transactionSignature || null);
      setStep('complete');
    } else {
      setStep('confirm');
    }
  };

  const handleClose = () => {
    setStep('form');
    setIntentId(null);
    setTxSignature(null);
    setFormData({ fromToken: 'SOL', toToken: 'USDC', amount: '', slippage: '0.5' });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0, 0, 0, 0.8)' }}>
      <div className="rounded-xl w-full max-w-md mx-4 overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
        <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
          <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--clr-primary)' }}>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
            </svg>
            Private Swap
          </h2>
          <button onClick={handleClose} style={{ color: 'var(--text-secondary)' }}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4">
          {error && (
            <div className="rounded-lg p-3 mb-4" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>
            </div>
          )}

          {step === 'form' && (
            <form onSubmit={handleCreateIntent}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>From</label>
                  <div className="flex gap-2">
                    <select
                      value={formData.fromToken}
                      onChange={(e) => setFormData({ ...formData, fromToken: e.target.value })}
                      className="rounded-lg px-3 py-2"
                      style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                    >
                      {TOKENS.map((t) => (
                        <option key={t.symbol} value={t.symbol}>{t.symbol}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      placeholder="0.00"
                      className="flex-1 rounded-lg px-3 py-2"
                      style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>

                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => setFormData({
                      ...formData,
                      fromToken: formData.toToken,
                      toToken: formData.fromToken,
                    })}
                    className="p-2 rounded-full transition-colors"
                    style={{ background: 'var(--bg-hover)' }}
                  >
                    <svg className="w-4 h-4" style={{ color: 'var(--clr-primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                  </button>
                </div>

                <div>
                  <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>To</label>
                  <select
                    value={formData.toToken}
                    onChange={(e) => setFormData({ ...formData, toToken: e.target.value })}
                    className="w-full rounded-lg px-3 py-2"
                    style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                  >
                    {TOKENS.map((t) => (
                      <option key={t.symbol} value={t.symbol}>{t.symbol}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>Slippage Tolerance</label>
                  <div className="flex gap-2">
                    {['0.1', '0.5', '1.0'].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setFormData({ ...formData, slippage: val })}
                        className="px-3 py-1.5 rounded-lg text-sm transition-colors"
                        style={{ 
                          background: formData.slippage === val ? 'var(--clr-primary)' : 'var(--bg-hover)',
                          color: formData.slippage === val ? 'var(--bg-primary)' : 'var(--text-secondary)',
                          border: '1px solid var(--border-default)'
                        }}
                      >
                        {val}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div 
                className="mt-6 rounded-lg p-3"
                style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.2)' }}
              >
                <p className="text-xs" style={{ color: 'var(--clr-primary)' }}>
                  Your swap will be encrypted and executed privately via Arcium MXE, 
                  protecting against MEV extraction and front-running.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || !formData.amount}
                className="w-full mt-4 py-3 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'var(--clr-primary)', color: 'var(--bg-primary)' }}
              >
                {loading ? 'Creating Intent...' : 'Create Private Swap Intent'}
              </button>
            </form>
          )}

          {step === 'confirm' && (
            <div className="text-center">
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(234, 179, 8, 0.2)' }}
              >
                <svg className="w-8 h-8" style={{ color: 'var(--clr-primary)' }} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
                </svg>
              </div>
              <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Intent Created</h3>
              <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                Your swap intent has been encrypted and is ready for execution.
              </p>
              <div className="rounded-lg p-3 mb-4" style={{ background: 'var(--bg-hover)' }}>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Intent ID</p>
                <p className="font-mono text-sm truncate" style={{ color: 'var(--text-primary)' }}>{intentId}</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="flex-1 py-2 rounded-lg transition-colors"
                  style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteSwap}
                  disabled={loading}
                  className="flex-1 py-2 rounded-lg transition-colors disabled:opacity-50"
                  style={{ background: 'var(--clr-primary)', color: 'var(--bg-primary)' }}
                >
                  Execute Swap
                </button>
              </div>
            </div>
          )}

          {step === 'executing' && (
            <div className="text-center py-8">
              <div 
                className="w-16 h-16 border-4 rounded-full animate-spin mx-auto mb-4"
                style={{ borderColor: 'var(--clr-primary)', borderTopColor: 'transparent' }}
              />
              <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Executing Private Swap</h3>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                MXE nodes are processing your encrypted transaction...
              </p>
            </div>
          )}

          {step === 'complete' && (
            <div className="text-center">
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(34, 197, 94, 0.2)' }}
              >
                <svg className="w-8 h-8" style={{ color: 'var(--status-success)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Swap Complete</h3>
              <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                Your private swap was executed successfully.
              </p>
              {txSignature && (
                <a
                  href={`https://solscan.io/tx/${txSignature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm hover:underline"
                  style={{ color: 'var(--clr-primary)' }}
                >
                  View on Solscan →
                </a>
              )}
              <button
                onClick={handleClose}
                className="w-full mt-4 py-2 rounded-lg transition-colors"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PrivateSwapModal;
