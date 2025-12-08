/**
 * Multi-Transaction Coordinator
 * Handles splitting and coordinating multiple transactions for complex strategies
 */

import { Keypair, TransactionInstruction, VersionedTransaction } from '@solana/web3.js';
import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { TransactionBuilder } from '../execution/transactionBuilder';
import { JitoBundleManager, BundleStatus } from '../execution/jitoBundle';
import { JITO_CONFIG } from '../../config/constants';

// Strategy step with instruction and metadata
export interface StrategyStep {
  instruction: TransactionInstruction;
  estimatedCUs: number; // Estimated compute units
  description: string;
  critical: boolean; // If true, failure stops entire strategy
}

// Split transaction result
export interface SplitResult {
  transactions: TransactionInstruction[][];
  totalSteps: number;
  totalCUs: number;
  bundleCount: number;
}

// Execution result for multi-tx
export interface MultiTxResult {
  success: boolean;
  bundleIds: string[];
  signatures: string[];
  failedStep?: number;
  error?: string;
  totalDurationMs: number;
}

// Execution progress event
export interface ExecutionProgress {
  step: number;
  totalSteps: number;
  status: 'pending' | 'submitted' | 'confirmed' | 'failed';
  bundleId?: string;
  signature?: string;
  error?: string;
}

export class MultiTransactionCoordinator extends EventEmitter {
  private transactionBuilder: TransactionBuilder;
  private jitoBundleManager: JitoBundleManager;
  private readonly maxCUsPerTx: number = 1_400_000; // Solana limit
  private readonly maxInstructionsPerTx: number = 64;

  constructor(rpcUrl?: string) {
    super();
    this.transactionBuilder = new TransactionBuilder(rpcUrl);
    this.jitoBundleManager = new JitoBundleManager(undefined, rpcUrl);
    
    logger.info('Multi-Transaction Coordinator initialized');
  }

  /**
   * Split strategy into multiple transactions based on CU limits
   */
  splitStrategy(
    steps: StrategyStep[],
    maxCUsPerTx: number = this.maxCUsPerTx
  ): SplitResult {
    const transactions: TransactionInstruction[][] = [];
    let currentTx: TransactionInstruction[] = [];
    let currentCUs = 0;

    for (const step of steps) {
      // Check if adding this step would exceed limits
      if (
        currentCUs + step.estimatedCUs > maxCUsPerTx ||
        currentTx.length >= this.maxInstructionsPerTx
      ) {
        // Start new transaction
        if (currentTx.length > 0) {
          transactions.push(currentTx);
        }
        currentTx = [];
        currentCUs = 0;
      }

      currentTx.push(step.instruction);
      currentCUs += step.estimatedCUs;
    }

    // Add remaining instructions
    if (currentTx.length > 0) {
      transactions.push(currentTx);
    }

    const totalCUs = steps.reduce((sum, s) => sum + s.estimatedCUs, 0);
    const bundleCount = Math.ceil(transactions.length / JITO_CONFIG.MAX_TRANSACTIONS_PER_BUNDLE);

    logger.info(`Split strategy: ${steps.length} steps -> ${transactions.length} TXs -> ${bundleCount} bundles`);

    return {
      transactions,
      totalSteps: steps.length,
      totalCUs,
      bundleCount,
    };
  }

  /**
   * Execute atomic bundle (up to 5 transactions)
   * All transactions succeed or all fail together
   */
  async executeAtomicBundle(
    instructionSets: TransactionInstruction[][],
    payer: Keypair,
    tipLamports: number = JITO_CONFIG.DEFAULT_TIP_LAMPORTS
  ): Promise<MultiTxResult> {
    const startTime = Date.now();

    if (instructionSets.length > JITO_CONFIG.MAX_TRANSACTIONS_PER_BUNDLE) {
      return {
        success: false,
        bundleIds: [],
        signatures: [],
        error: `Bundle exceeds max size of ${JITO_CONFIG.MAX_TRANSACTIONS_PER_BUNDLE} transactions`,
        totalDurationMs: Date.now() - startTime,
      };
    }

    try {
      // Build all transactions
      const transactions: VersionedTransaction[] = [];
      
      for (let i = 0; i < instructionSets.length; i++) {
        const instructions = instructionSets[i];
        
        // Add tip to last transaction
        if (i === instructionSets.length - 1) {
          const tipIx = this.jitoBundleManager.createTipInstruction(
            payer.publicKey,
            tipLamports
          );
          instructions.push(tipIx);
        }

        const built = await this.transactionBuilder.buildVersionedTransaction(
          instructions,
          payer.publicKey,
          [],
          { computeUnits: 400_000 } // Default compute units per transaction
        );

        built.transaction.sign([payer]);
        transactions.push(built.transaction);

        this.emitProgress({
          step: i + 1,
          totalSteps: instructionSets.length,
          status: 'pending',
        });
      }

      // Submit bundle
      const bundleResult = await this.jitoBundleManager.submitAndWaitForBundle(transactions);

      if (bundleResult.status === 'landed') {
        return {
          success: true,
          bundleIds: [bundleResult.bundleId],
          signatures: [], // Jito doesn't return individual signatures
          totalDurationMs: Date.now() - startTime,
        };
      }

      return {
        success: false,
        bundleIds: [bundleResult.bundleId],
        signatures: [],
        error: bundleResult.err || 'Bundle failed to land',
        totalDurationMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Atomic bundle execution failed:', error);

      return {
        success: false,
        bundleIds: [],
        signatures: [],
        error: errorMessage,
        totalDurationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute sequential bundles for strategies with >5 transactions
   * Each bundle is atomic, but bundles are sequential
   */
  async executeSequentialBundles(
    instructionSets: TransactionInstruction[][],
    payer: Keypair,
    tipLamports: number = JITO_CONFIG.DEFAULT_TIP_LAMPORTS
  ): Promise<MultiTxResult> {
    const startTime = Date.now();
    const bundleIds: string[] = [];
    const signatures: string[] = [];

    // Split into bundles of max 5 transactions
    const bundles: TransactionInstruction[][][] = [];
    for (let i = 0; i < instructionSets.length; i += JITO_CONFIG.MAX_TRANSACTIONS_PER_BUNDLE) {
      bundles.push(instructionSets.slice(i, i + JITO_CONFIG.MAX_TRANSACTIONS_PER_BUNDLE));
    }

    logger.info(`Executing ${bundles.length} sequential bundles`);

    for (let bundleIndex = 0; bundleIndex < bundles.length; bundleIndex++) {
      const bundle = bundles[bundleIndex];
      
      this.emitProgress({
        step: bundleIndex + 1,
        totalSteps: bundles.length,
        status: 'submitted',
      });

      const result = await this.executeAtomicBundle(bundle, payer, tipLamports);

      if (!result.success) {
        logger.error(`Bundle ${bundleIndex + 1} failed:`, result.error);
        
        return {
          success: false,
          bundleIds,
          signatures,
          failedStep: bundleIndex,
          error: `Bundle ${bundleIndex + 1} failed: ${result.error}`,
          totalDurationMs: Date.now() - startTime,
        };
      }

      bundleIds.push(...result.bundleIds);
      signatures.push(...result.signatures);

      this.emitProgress({
        step: bundleIndex + 1,
        totalSteps: bundles.length,
        status: 'confirmed',
        bundleId: result.bundleIds[0],
      });
    }

    return {
      success: true,
      bundleIds,
      signatures,
      totalDurationMs: Date.now() - startTime,
    };
  }

  /**
   * Execute strategy with automatic splitting and bundling
   */
  async executeStrategy(
    steps: StrategyStep[],
    payer: Keypair,
    options: {
      tipLamports?: number;
      maxCUsPerTx?: number;
    } = {}
  ): Promise<MultiTxResult> {
    const { tipLamports = JITO_CONFIG.DEFAULT_TIP_LAMPORTS, maxCUsPerTx } = options;

    // Split strategy into transactions
    const split = this.splitStrategy(steps, maxCUsPerTx);

    if (split.transactions.length === 0) {
      return {
        success: false,
        bundleIds: [],
        signatures: [],
        error: 'No transactions to execute',
        totalDurationMs: 0,
      };
    }

    // Execute based on bundle count
    if (split.bundleCount === 1) {
      return this.executeAtomicBundle(split.transactions, payer, tipLamports);
    }

    return this.executeSequentialBundles(split.transactions, payer, tipLamports);
  }

  /**
   * Emit execution progress event
   */
  private emitProgress(progress: ExecutionProgress): void {
    this.emit('progress', progress);
    logger.debug(`Execution progress: Step ${progress.step}/${progress.totalSteps} - ${progress.status}`);
  }

  /**
   * Estimate total cost for strategy
   */
  estimateStrategyCost(
    steps: StrategyStep[],
    tipLamports: number = JITO_CONFIG.DEFAULT_TIP_LAMPORTS
  ): {
    totalCUs: number;
    estimatedFee: number;
    tipAmount: number;
    bundleCount: number;
  } {
    const split = this.splitStrategy(steps);
    const baseFee = 5000 * split.transactions.length; // ~5000 lamports per tx
    const totalTip = tipLamports * split.bundleCount;

    return {
      totalCUs: split.totalCUs,
      estimatedFee: baseFee,
      tipAmount: totalTip,
      bundleCount: split.bundleCount,
    };
  }
}

export default MultiTransactionCoordinator;
