/**
 * Swap Preview Component
 * Shows swap details with MEV savings comparison
 */

import { ArrowRight, Shield, TrendingDown } from 'lucide-react';

interface SwapPreviewProps {
  fromToken: string;
  toToken: string;
  inputAmount: number;
  outputAmount: number;
  standardSlippage: number;
  protectedSlippage: number;
  mevSavings: number;
  priceImpact: number;
  loading?: boolean;
}

const TOKEN_ICONS: Record<string, string> = {
  SOL: '◎',
  USDC: '$',
  USDT: '$',
  mSOL: '◎',
  jitoSOL: '◎',
};

export default function SwapPreview({
  fromToken,
  toToken,
  inputAmount,
  outputAmount,
  standardSlippage,
  protectedSlippage,
  mevSavings,
  priceImpact,
  loading,
}: SwapPreviewProps) {
  const slippageSaved = standardSlippage - protectedSlippage;
  const slippageSavedPercent = standardSlippage > 0 ? (slippageSaved / standardSlippage) * 100 : 0;

  if (loading) {
    return (
      <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6 animate-pulse">
        <div className="h-6 bg-gray-700 rounded w-32 mb-4"></div>
        <div className="h-16 bg-gray-700 rounded mb-4"></div>
        <div className="h-24 bg-gray-700 rounded"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Shield className="w-5 h-5 text-blue-400" />
        Protected Swap Preview
      </h3>

      {/* Token Swap Display */}
      <div className="flex items-center justify-between bg-gray-900/50 rounded-lg p-4 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold">
            {TOKEN_ICONS[fromToken] || ''} {inputAmount.toLocaleString()}
          </div>
          <div className="text-sm text-gray-400">{fromToken}</div>
        </div>
        
        <ArrowRight className="w-6 h-6 text-gray-500" />
        
        <div className="text-center">
          <div className="text-2xl font-bold text-green-400">
            {TOKEN_ICONS[toToken] || ''} {outputAmount.toLocaleString()}
          </div>
          <div className="text-sm text-gray-400">{toToken}</div>
        </div>
      </div>

      {/* MEV Protection Stats */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Price Impact</span>
          <span className={priceImpact > 1 ? 'text-yellow-400' : 'text-gray-200'}>
            {priceImpact.toFixed(2)}%
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-gray-400">Standard Slippage</span>
          <span className="text-red-400 line-through">{standardSlippage.toFixed(2)}%</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-gray-400">Protected Slippage</span>
          <span className="text-green-400">{protectedSlippage.toFixed(2)}%</span>
        </div>

        <div className="border-t border-gray-700 pt-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-400 flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-green-400" />
              Slippage Saved
            </span>
            <span className="text-green-400 font-semibold">
              {slippageSaved.toFixed(2)}% ({slippageSavedPercent.toFixed(0)}% better)
            </span>
          </div>
        </div>

        {/* MEV Savings Highlight */}
        <div className="bg-green-900/30 border border-green-700/50 rounded-lg p-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-green-400">Estimated MEV Savings</div>
              <div className="text-2xl font-bold text-green-300">
                ${mevSavings.toFixed(2)}
              </div>
            </div>
            <Shield className="w-10 h-10 text-green-500/50" />
          </div>
        </div>
      </div>
    </div>
  );
}
