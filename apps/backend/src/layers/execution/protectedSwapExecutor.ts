/**
 * Protected Swap Executor
 * Orchestrates the full MEV-protected swap flow
 */

import { Keypair, PublicKey, Connection } from '@solana/web3.js';
import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { config } from '../../config';
import { JITO_CONFIG, TOKEN_DECIMALS } from '../../config/constants';
import { JupiterSwapEngine, JupiterQuote, SwapInstructionsResponse } from './jupiterSwap';
import { SlippageAnalyzer, RouteComparison } from './slippageAnalyzer';
import { TransactionBuilder, BuiltTransaction, SimulationResult } from './transactionBuilder';
import { JitoBundleManager, BundleStatus } from './jitoBundle';

// Swap configuration
export interface SwapConfig {
  inputMint: string;
  outputMint: string;
  amount: number; // In smallest units
  slippageBps: number;
  useJito: boolean;
  jitoTipLamports?: number;
  maxRetries?: number;
}

// Swap execution result
export interface SwapExecutionResult {
  success: boolean;
  transactionSignature?: string;
  bundleId?: string;
  inputAmount: string;
  outputAmount: string;
  priceImpact: number;
  executionMethod: 'jito' | 'rpc';
  mevSavingsEstimate: number;
  error?: string;
  timestamp: number;
  durationMs: number;
}

// Execution step for tracking
export type ExecutionStep = 
  | 'quote'
  | 'instructions'
  | 'build'
  | 'simulate'
  | 'submit'
  | 'confirm'
  | 'complete'
  | 'failed';

export class ProtectedSwapExecutor extends EventEmitter {
  private jupiterEngine: JupiterSwapEngine;
  private slippageAnalyzer: SlippageAnalyzer;
  private transactionBuilder: TransactionBuilder;
  private jitoBundleManager: JitoBundleManager;
  private connection: Connection;

  constructor(rpcUrl?: string) {
    super();
    const url = rpcUrl || config.solanaRpcUrl;
    
    this.jupiterEngine = new JupiterSwapEngine();
    this.slippageAnalyzer = new SlippageAnalyzer(this.jupiterEngine);
    this.transactionBuilder = new TransactionBuilder(url);
    this.jitoBundleManager = new JitoBundleManager(config.jitoBundleUrl, url);
    this.connection = new Connection(url, 'confirmed');

    logger.info('Protected Swap Executor initialized');
  }

  /**
   * Execute a protected swap
   */
  async executeProtectedSwap(
    swapConfig: SwapConfig,
    payer: Keypair
  ): Promise<SwapExecutionResult> {
    const startTime = Date.now();
    let currentStep: ExecutionStep = 'quote';

    try {
      this.emitStep(currentStep, 'Getting swap quote...');

      // Step 1: Get quote
      const quote = await this.jupiterEngine.getSwapQuote(
        swapConfig.inputMint,
        swapConfig.outputMint,
        swapConfig.amount,
        swapConfig.slippageBps
      );

      currentStep = 'instructions';
      this.emitStep(currentStep, 'Getting swap instructions...');

      // Step 2: Get swap instructions
      const swapInstructions = await this.jupiterEngine.getSwapInstructions(
        quote,
        payer.publicKey.toBase58(),
        {
          wrapAndUnwrapSol: true,
          useSharedAccounts: true,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: swapConfig.useJito
            ? swapConfig.jitoTipLamports || JITO_CONFIG.DEFAULT_TIP_LAMPORTS
            : { priorityLevelWithMaxLamports: { priorityLevel: 'medium', maxLamports: 100000 } },
        }
      );

      currentStep = 'build';
      this.emitStep(currentStep, 'Building transaction...');

      // Step 3: Build transaction
      const builtTx = await this.transactionBuilder.buildSwapTransaction(
        swapInstructions,
        payer.publicKey
      );

      currentStep = 'simulate';
      this.emitStep(currentStep, 'Simulating transaction...');

      // Step 4: Simulate
      const simulation = await this.transactionBuilder.simulateTransaction(builtTx.transaction);
      
      if (!simulation.success) {
        throw new Error(`Simulation failed: ${simulation.error}`);
      }

      // Sign transaction
      builtTx.transaction.sign([payer]);

      currentStep = 'submit';
      this.emitStep(currentStep, `Submitting via ${swapConfig.useJito ? 'Jito' : 'RPC'}...`);

      // Step 5: Submit
      let result: SwapExecutionResult;

      if (swapConfig.useJito) {
        result = await this.submitViaJito(builtTx, quote, startTime);
      } else {
        result = await this.submitViaRpc(builtTx, quote, payer, startTime);
      }

      currentStep = result.success ? 'complete' : 'failed';
      this.emitStep(currentStep, result.success ? 'Swap completed!' : `Swap failed: ${result.error}`);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Protected swap execution failed:', error);

      this.emitStep('failed', errorMessage);

      return {
        success: false,
        inputAmount: swapConfig.amount.toString(),
        outputAmount: '0',
        priceImpact: 0,
        executionMethod: swapConfig.useJito ? 'jito' : 'rpc',
        mevSavingsEstimate: 0,
        error: errorMessage,
        timestamp: Date.now(),
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Submit transaction via Jito bundle
   */
  private async submitViaJito(
    builtTx: BuiltTransaction,
    quote: JupiterQuote,
    startTime: number
  ): Promise<SwapExecutionResult> {
    const bundleStatus = await this.jitoBundleManager.submitAndWaitForBundle(
      [builtTx.transaction]
    );

    const success = bundleStatus.status === 'landed';
    const mevSavings = this.slippageAnalyzer.estimateMevSavings(
      parseInt(quote.inAmount),
      parseFloat(quote.priceImpactPct),
      parseFloat(quote.priceImpactPct) * 0.8 // Estimate 20% better with Jito
    );

    return {
      success,
      bundleId: bundleStatus.bundleId,
      inputAmount: quote.inAmount,
      outputAmount: quote.outAmount,
      priceImpact: parseFloat(quote.priceImpactPct),
      executionMethod: 'jito',
      mevSavingsEstimate: mevSavings,
      error: bundleStatus.err,
      timestamp: Date.now(),
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Submit transaction via standard RPC
   */
  private async submitViaRpc(
    builtTx: BuiltTransaction,
    quote: JupiterQuote,
    payer: Keypair,
    startTime: number
  ): Promise<SwapExecutionResult> {
    try {
      const signature = await this.connection.sendTransaction(builtTx.transaction, {
        skipPreflight: false,
        maxRetries: 3,
      });

      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction(
        {
          signature,
          blockhash: builtTx.blockhash,
          lastValidBlockHeight: builtTx.lastValidBlockHeight,
        },
        'confirmed'
      );

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      return {
        success: true,
        transactionSignature: signature,
        inputAmount: quote.inAmount,
        outputAmount: quote.outAmount,
        priceImpact: parseFloat(quote.priceImpactPct),
        executionMethod: 'rpc',
        mevSavingsEstimate: 0, // No MEV protection via RPC
        timestamp: Date.now(),
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        success: false,
        inputAmount: quote.inAmount,
        outputAmount: '0',
        priceImpact: parseFloat(quote.priceImpactPct),
        executionMethod: 'rpc',
        mevSavingsEstimate: 0,
        error: errorMessage,
        timestamp: Date.now(),
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute swap with automatic fallback
   * Tries Jito first, falls back to RPC if Jito fails
   */
  async executeWithFallback(
    swapConfig: SwapConfig,
    payer: Keypair
  ): Promise<SwapExecutionResult> {
    // Try Jito first
    if (swapConfig.useJito) {
      const jitoResult = await this.executeProtectedSwap(swapConfig, payer);
      
      if (jitoResult.success) {
        return jitoResult;
      }

      logger.warn('Jito submission failed, falling back to RPC', {
        error: jitoResult.error,
      });
    }

    // Fallback to RPC
    const rpcConfig = { ...swapConfig, useJito: false };
    return this.executeProtectedSwap(rpcConfig, payer);
  }

  /**
   * Get swap preview (quote + comparison)
   */
  async getSwapPreview(
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number = 50
  ): Promise<{
    quote: JupiterQuote;
    comparison: RouteComparison;
    recommendJito: boolean;
  }> {
    const quote = await this.jupiterEngine.getSwapQuote(
      inputMint,
      outputMint,
      amount,
      slippageBps
    );

    const comparison = await this.slippageAnalyzer.compareRoutes(
      inputMint,
      outputMint,
      amount,
      100, // Standard slippage
      slippageBps // Protected slippage
    );

    // Recommend Jito for larger trades or high MEV risk
    const tradeValueEstimate = amount / 1e9 * 100; // Rough USD estimate
    const recommendJito = comparison.comparison.recommendProtection || tradeValueEstimate > 100;

    return {
      quote,
      comparison,
      recommendJito,
    };
  }

  /**
   * Emit execution step event
   */
  private emitStep(step: ExecutionStep, message: string): void {
    this.emit('step', { step, message, timestamp: Date.now() });
    logger.debug(`Swap step: ${step} - ${message}`);
  }

  /**
   * Get Jupiter engine
   */
  getJupiterEngine(): JupiterSwapEngine {
    return this.jupiterEngine;
  }

  /**
   * Get slippage analyzer
   */
  getSlippageAnalyzer(): SlippageAnalyzer {
    return this.slippageAnalyzer;
  }

  /**
   * Get Jito bundle manager
   */
  getJitoBundleManager(): JitoBundleManager {
    return this.jitoBundleManager;
  }

  /**
   * Check if all services are healthy
   */
  async healthCheck(): Promise<{
    jupiter: boolean;
    jito: boolean;
    rpc: boolean;
  }> {
    const [jitoHealthy, rpcHealthy] = await Promise.all([
      this.jitoBundleManager.isHealthy(),
      this.checkRpcHealth(),
    ]);

    // Jupiter is healthy if we can get a quote
    let jupiterHealthy = false;
    try {
      await this.jupiterEngine.getSOLtoUSDCQuote(0.001);
      jupiterHealthy = true;
    } catch {
      jupiterHealthy = false;
    }

    return {
      jupiter: jupiterHealthy,
      jito: jitoHealthy,
      rpc: rpcHealthy,
    };
  }

  /**
   * Check RPC health
   */
  private async checkRpcHealth(): Promise<boolean> {
    try {
      await this.connection.getSlot();
      return true;
    } catch {
      return false;
    }
  }
}

export default ProtectedSwapExecutor;
