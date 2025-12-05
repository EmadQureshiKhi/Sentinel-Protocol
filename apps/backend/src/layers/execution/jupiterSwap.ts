/**
 * Jupiter Swap Integration
 * Handles quote fetching and swap instruction generation via Jupiter API
 */

import axios from 'axios';
import { logger } from '../../utils/logger';
import { withRetry } from '../../utils/retry';
import { config } from '../../config';
import { TOKENS, TIMING } from '../../config/constants';

// Jupiter Quote Response
export interface JupiterQuote {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: 'ExactIn' | 'ExactOut';
  slippageBps: number;
  platformFee?: {
    amount: string;
    feeBps: number;
  };
  priceImpactPct: string;
  routePlan: RoutePlanStep[];
  contextSlot: number;
  timeTaken: number;
}

interface RoutePlanStep {
  swapInfo: {
    ammKey: string;
    label?: string;
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    feeAmount?: string;
    feeMint?: string;
  };
  percent: number;
}

// Swap Instructions Response
export interface SwapInstructionsResponse {
  tokenLedgerInstruction?: Instruction;
  computeBudgetInstructions: Instruction[];
  setupInstructions: Instruction[];
  swapInstruction: Instruction;
  cleanupInstruction?: Instruction;
  otherInstructions: Instruction[];
  addressLookupTableAddresses: string[];
}

export interface Instruction {
  programId: string;
  accounts: AccountMeta[];
  data: string;
}

interface AccountMeta {
  pubkey: string;
  isSigner: boolean;
  isWritable: boolean;
}

// Quote cache entry
interface CachedQuote {
  quote: JupiterQuote;
  timestamp: number;
}

export class JupiterSwapEngine {
  private readonly baseUrl = config.jupiterApiUrl;
  private readonly apiKey = config.jupiterApiKey;
  private quoteCache: Map<string, CachedQuote> = new Map();
  private readonly cacheTTL = TIMING.QUOTE_CACHE_TTL_MS;

  constructor() {
    logger.info('Jupiter Swap Engine initialized');
  }

  /**
   * Get request headers with API key
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey;
    }
    return headers;
  }

  /**
   * Generate cache key for quote
   */
  private getCacheKey(
    inputMint: string,
    outputMint: string,
    amount: string,
    slippageBps: number
  ): string {
    return `${inputMint}-${outputMint}-${amount}-${slippageBps}`;
  }

  /**
   * Get swap quote from Jupiter
   */
  async getSwapQuote(
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number = 50,
    options: {
      swapMode?: 'ExactIn' | 'ExactOut';
      onlyDirectRoutes?: boolean;
      asLegacyTransaction?: boolean;
      maxAccounts?: number;
    } = {}
  ): Promise<JupiterQuote> {
    const amountStr = amount.toString();
    const cacheKey = this.getCacheKey(inputMint, outputMint, amountStr, slippageBps);

    // Check cache
    const cached = this.quoteCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      logger.debug('Using cached Jupiter quote');
      return cached.quote;
    }

    try {
      const quote = await withRetry(
        async () => {
          const params = new URLSearchParams({
            inputMint,
            outputMint,
            amount: amountStr,
            slippageBps: slippageBps.toString(),
            swapMode: options.swapMode || 'ExactIn',
            onlyDirectRoutes: (options.onlyDirectRoutes || false).toString(),
            asLegacyTransaction: (options.asLegacyTransaction || false).toString(),
          });

          if (options.maxAccounts) {
            params.append('maxAccounts', options.maxAccounts.toString());
          }

          const response = await axios.get<JupiterQuote>(
            `${this.baseUrl}/swap/v1/quote?${params.toString()}`,
            {
              headers: this.getHeaders(),
              timeout: 10000,
            }
          );

          return response.data;
        },
        { maxRetries: 3, baseDelayMs: 500 }
      );

      // Cache the quote
      this.quoteCache.set(cacheKey, {
        quote,
        timestamp: Date.now(),
      });

      logger.debug(`Jupiter quote: ${inputMint.slice(0, 8)}... -> ${outputMint.slice(0, 8)}...`, {
        inAmount: quote.inAmount,
        outAmount: quote.outAmount,
        priceImpact: quote.priceImpactPct,
      });

      return quote;
    } catch (error) {
      logger.error('Failed to get Jupiter quote:', error);
      throw error;
    }
  }

  /**
   * Get swap instructions from Jupiter
   */
  async getSwapInstructions(
    quote: JupiterQuote,
    userPublicKey: string,
    options: {
      wrapAndUnwrapSol?: boolean;
      useSharedAccounts?: boolean;
      feeAccount?: string;
      trackingAccount?: string;
      prioritizationFeeLamports?: number | { priorityLevelWithMaxLamports: { priorityLevel: string; maxLamports: number } };
      asLegacyTransaction?: boolean;
      dynamicComputeUnitLimit?: boolean;
      skipUserAccountsRpcCalls?: boolean;
    } = {}
  ): Promise<SwapInstructionsResponse> {
    try {
      const response = await withRetry(
        async () => {
          const body: Record<string, unknown> = {
            quoteResponse: quote,
            userPublicKey,
            wrapAndUnwrapSol: options.wrapAndUnwrapSol ?? true,
            useSharedAccounts: options.useSharedAccounts ?? true,
            asLegacyTransaction: options.asLegacyTransaction ?? false,
            dynamicComputeUnitLimit: options.dynamicComputeUnitLimit ?? true,
            skipUserAccountsRpcCalls: options.skipUserAccountsRpcCalls ?? false,
          };

          if (options.feeAccount) {
            body.feeAccount = options.feeAccount;
          }
          if (options.trackingAccount) {
            body.trackingAccount = options.trackingAccount;
          }
          if (options.prioritizationFeeLamports) {
            body.prioritizationFeeLamports = options.prioritizationFeeLamports;
          }

          const result = await axios.post<SwapInstructionsResponse>(
            `${this.baseUrl}/swap/v1/swap-instructions`,
            body,
            {
              headers: this.getHeaders(),
              timeout: 15000,
            }
          );

          return result.data;
        },
        { maxRetries: 3, baseDelayMs: 500 }
      );

      logger.debug('Got swap instructions from Jupiter', {
        setupInstructions: response.setupInstructions.length,
        hasCleanup: !!response.cleanupInstruction,
        lookupTables: response.addressLookupTableAddresses.length,
      });

      return response;
    } catch (error) {
      logger.error('Failed to get swap instructions:', error);
      throw error;
    }
  }

  /**
   * Get quote for SOL -> USDC swap
   */
  async getSOLtoUSDCQuote(
    solAmount: number,
    slippageBps: number = 50
  ): Promise<JupiterQuote> {
    // SOL amount in lamports (9 decimals)
    const lamports = Math.floor(solAmount * 1e9);
    return this.getSwapQuote(TOKENS.SOL, TOKENS.USDC, lamports, slippageBps);
  }

  /**
   * Get quote for USDC -> SOL swap
   */
  async getUSDCtoSOLQuote(
    usdcAmount: number,
    slippageBps: number = 50
  ): Promise<JupiterQuote> {
    // USDC amount in smallest units (6 decimals)
    const amount = Math.floor(usdcAmount * 1e6);
    return this.getSwapQuote(TOKENS.USDC, TOKENS.SOL, amount, slippageBps);
  }

  /**
   * Calculate price impact percentage
   */
  calculatePriceImpact(quote: JupiterQuote): number {
    return parseFloat(quote.priceImpactPct);
  }

  /**
   * Calculate effective exchange rate
   */
  calculateExchangeRate(
    quote: JupiterQuote,
    inputDecimals: number,
    outputDecimals: number
  ): number {
    const inAmount = parseFloat(quote.inAmount) / Math.pow(10, inputDecimals);
    const outAmount = parseFloat(quote.outAmount) / Math.pow(10, outputDecimals);
    return outAmount / inAmount;
  }

  /**
   * Get token mint address by symbol
   */
  getTokenMint(symbol: string): string {
    const mint = TOKENS[symbol as keyof typeof TOKENS];
    if (!mint) {
      throw new Error(`Unknown token symbol: ${symbol}`);
    }
    return mint;
  }

  /**
   * Clear quote cache
   */
  clearCache(): void {
    this.quoteCache.clear();
    logger.debug('Jupiter quote cache cleared');
  }

  /**
   * Get cache stats
   */
  getCacheStats(): { size: number; oldestEntry: number | null } {
    let oldestTimestamp: number | null = null;
    
    for (const entry of this.quoteCache.values()) {
      if (oldestTimestamp === null || entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
      }
    }

    return {
      size: this.quoteCache.size,
      oldestEntry: oldestTimestamp,
    };
  }
}

export default JupiterSwapEngine;
