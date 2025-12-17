/**
 * Strategy Builder
 * Fluent API for building complex multi-step strategies
 */

import { TransactionInstruction, PublicKey, Keypair, Transaction } from '@solana/web3.js';
import { logger } from '../../utils/logger';
import { MultiTransactionCoordinator, StrategyStep, MultiTxResult, SplitResult } from './multiTxCoordinator';
import { JITO_CONFIG } from '../../config/constants';

// Strategy metadata
export interface StrategyMetadata {
  name: string;
  description: string;
  version: string;
  createdAt: Date;
}

// Built strategy ready for execution
export interface BuiltStrategy {
  metadata: StrategyMetadata;
  steps: StrategyStep[];
  split: SplitResult;
  estimatedCost: {
    totalCUs: number;
    estimatedFee: number;
    tipAmount: number;
    bundleCount: number;
  };
}

// Validation result
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class StrategyBuilder {
  private steps: StrategyStep[] = [];
  private metadata: StrategyMetadata;
  private multiTxCoordinator: MultiTransactionCoordinator;

  constructor(name: string, description: string = '') {
    this.metadata = {
      name,
      description,
      version: '1.0.0',
      createdAt: new Date(),
    };
    this.multiTxCoordinator = new MultiTransactionCoordinator();
    
    logger.debug(`Strategy builder created: ${name}`);
  }

  /**
   * Add a step to the strategy
   */
  addStep(
    instruction: TransactionInstruction,
    options: {
      estimatedCUs?: number;
      description?: string;
      critical?: boolean;
    } = {}
  ): StrategyBuilder {
    const step: StrategyStep = {
      instruction,
      estimatedCUs: options.estimatedCUs || 100000,
      description: options.description || `Step ${this.steps.length + 1}`,
      critical: options.critical ?? true,
    };

    this.steps.push(step);
    return this;
  }

  /**
   * Add multiple steps at once
   */
  addSteps(steps: StrategyStep[]): StrategyBuilder {
    this.steps.push(...steps);
    return this;
  }

  /**
   * Add a health check step
   */
  addHealthCheck(
    walletAddress: string,
    description: string = 'Check health factor'
  ): StrategyBuilder {
    const instruction = new TransactionInstruction({
      programId: new PublicKey('11111111111111111111111111111111'),
      keys: [
        { pubkey: new PublicKey(walletAddress), isSigner: false, isWritable: false },
      ],
      data: Buffer.from([]),
    });

    return this.addStep(instruction, {
      estimatedCUs: 50000,
      description,
      critical: true,
    });
  }

  /**
   * Add a swap step using Jupiter
   * Note: This returns a promise since we need to fetch swap instructions
   */
  async addSwapAsync(
    fromToken: string,
    toToken: string,
    amount: number,
    slippageBps: number,
    userPublicKey: string,
    description?: string
  ): Promise<StrategyBuilder> {
    // Import Jupiter swap engine
    const { JupiterSwapEngine } = await import('../execution/jupiterSwap');
    const jupiterEngine = new JupiterSwapEngine();

    try {
      // Get swap quote
      const quote = await jupiterEngine.getSwapQuote(
        fromToken,
        toToken,
        amount,
        slippageBps
      );

      // Get swap instructions
      const swapInstructions = await jupiterEngine.getSwapInstructions(
        quote,
        userPublicKey,
        {
          wrapAndUnwrapSol: true,
          useSharedAccounts: true,
          dynamicComputeUnitLimit: true,
        }
      );

      // Create instruction from Jupiter response
      const instruction = new TransactionInstruction({
        programId: new PublicKey(swapInstructions.swapInstruction.programId),
        keys: swapInstructions.swapInstruction.accounts.map(acc => ({
          pubkey: new PublicKey(acc.pubkey),
          isSigner: acc.isSigner,
          isWritable: acc.isWritable,
        })),
        data: Buffer.from(swapInstructions.swapInstruction.data, 'base64'),
      });

      return this.addStep(instruction, {
        estimatedCUs: 300000,
        description: description || `Swap ${fromToken.slice(0, 8)}... to ${toToken.slice(0, 8)}...`,
        critical: true,
      });
    } catch (error) {
      logger.error('Failed to build Jupiter swap instruction', { error });
      throw error;
    }
  }

  /**
   * Add a swap step (synchronous placeholder for backward compatibility)
   * @deprecated Use addSwapAsync instead for real Jupiter swaps
   */
  addSwap(
    fromToken: string,
    toToken: string,
    amount: number,
    description?: string
  ): StrategyBuilder {
    logger.warn('Using deprecated addSwap - use addSwapAsync for real Jupiter integration');
    
    const instruction = new TransactionInstruction({
      programId: new PublicKey('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'),
      keys: [],
      data: Buffer.from([]),
    });

    return this.addStep(instruction, {
      estimatedCUs: 300000,
      description: description || `Swap ${fromToken} to ${toToken}`,
      critical: true,
    });
  }

  /**
   * Add a deposit step using real protocol SDK
   * Note: This returns a promise since we need to build protocol-specific instructions
   */
  async addDepositAsync(
    protocol: string,
    token: string,
    amount: number,
    marketIndex: number,
    userPublicKey: string,
    userTokenAccount: string,
    description?: string
  ): Promise<StrategyBuilder> {
    if (protocol.toUpperCase() === 'DRIFT') {
      // Import Drift SDK
      const DriftSDK = await import('@drift-labs/sdk');
      const { Connection } = await import('@solana/web3.js');

      try {
        // Create connection
        const rpcUrl = process.env.MAINNET_RPC_URL || process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';
        const connection = new Connection(rpcUrl, 'confirmed');

        // Create dummy wallet for instruction building
        const walletPubkey = new PublicKey(userPublicKey);
        const dummyWallet = {
          publicKey: walletPubkey,
          signTransaction: async (tx: Transaction) => tx,
          signAllTransactions: async (txs: Transaction[]) => txs,
        };

        // Initialize Drift client
        const driftClient = new DriftSDK.DriftClient({
          connection,
          wallet: dummyWallet,
          env: 'mainnet-beta',
        });

        await driftClient.subscribe();

        try {
          // Get token decimals
          const decimalsMap: Record<string, number> = {
            'SOL': 9, 'USDC': 6, 'USDT': 6, 'mSOL': 9,
            'jitoSOL': 9, 'bSOL': 9, 'PYTH': 6, 'JTO': 9,
            'WIF': 6, 'JUP': 6,
          };
          const decimals = decimalsMap[token.toUpperCase()] || 9;
          const amountBN = new DriftSDK.BN(amount * Math.pow(10, decimals));

          // Build deposit instruction
          const instruction = await driftClient.getDepositInstruction(
            amountBN,
            marketIndex,
            new PublicKey(userTokenAccount),
            0, // subAccountId
            false, // reduceOnly
            true // userInitialized (assume account exists in strategy)
          );

          await driftClient.unsubscribe();

          return this.addStep(instruction, {
            estimatedCUs: 100000,
            description: description || `Deposit ${amount} ${token} to Drift`,
            critical: true,
          });
        } finally {
          await driftClient.unsubscribe();
        }
      } catch (error) {
        logger.error('Failed to build Drift deposit instruction', { error });
        throw error;
      }
    }

    // Fallback for unsupported protocols
    logger.warn(`Protocol ${protocol} not yet supported for deposits, using placeholder`);
    const instruction = new TransactionInstruction({
      programId: new PublicKey('11111111111111111111111111111111'),
      keys: [],
      data: Buffer.from([]),
    });

    return this.addStep(instruction, {
      estimatedCUs: 100000,
      description: description || `Deposit ${amount} ${token} to ${protocol}`,
      critical: true,
    });
  }

  /**
   * Add a deposit step (synchronous placeholder for backward compatibility)
   * @deprecated Use addDepositAsync instead for real protocol integration
   */
  addDeposit(
    protocol: string,
    token: string,
    amount: number,
    description?: string
  ): StrategyBuilder {
    logger.warn('Using deprecated addDeposit - use addDepositAsync for real protocol integration');
    
    const instruction = new TransactionInstruction({
      programId: new PublicKey('11111111111111111111111111111111'),
      keys: [],
      data: Buffer.from([]),
    });

    return this.addStep(instruction, {
      estimatedCUs: 100000,
      description: description || `Deposit ${amount} ${token} to ${protocol}`,
      critical: true,
    });
  }

  /**
   * Add a withdraw step using real protocol SDK
   * Note: This returns a promise since we need to build protocol-specific instructions
   */
  async addWithdrawAsync(
    protocol: string,
    token: string,
    amount: number,
    marketIndex: number,
    userPublicKey: string,
    description?: string
  ): Promise<StrategyBuilder> {
    if (protocol.toUpperCase() === 'DRIFT') {
      // Import Drift SDK
      const DriftSDK = await import('@drift-labs/sdk');
      const { Connection } = await import('@solana/web3.js');

      try {
        // Create connection
        const rpcUrl = process.env.MAINNET_RPC_URL || process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';
        const connection = new Connection(rpcUrl, 'confirmed');

        // Create dummy wallet for instruction building
        const walletPubkey = new PublicKey(userPublicKey);
        const dummyWallet = {
          publicKey: walletPubkey,
          signTransaction: async (tx: Transaction) => tx,
          signAllTransactions: async (txs: Transaction[]) => txs,
        };

        // Initialize Drift client
        const driftClient = new DriftSDK.DriftClient({
          connection,
          wallet: dummyWallet,
          env: 'mainnet-beta',
        });

        await driftClient.subscribe();

        try {
          // Get token decimals
          const decimalsMap: Record<string, number> = {
            'SOL': 9, 'USDC': 6, 'USDT': 6, 'mSOL': 9,
            'jitoSOL': 9, 'bSOL': 9, 'PYTH': 6, 'JTO': 9,
            'WIF': 6, 'JUP': 6,
          };
          const decimals = decimalsMap[token.toUpperCase()] || 9;
          const amountBN = new DriftSDK.BN(amount * Math.pow(10, decimals));

          // Build withdraw instruction
          const instruction = await driftClient.getWithdrawIx(
            amountBN,
            marketIndex,
            walletPubkey,
            false // reduceOnly = false (allows withdrawing)
          );

          await driftClient.unsubscribe();

          return this.addStep(instruction, {
            estimatedCUs: 100000,
            description: description || `Withdraw ${amount} ${token} from Drift`,
            critical: true,
          });
        } finally {
          await driftClient.unsubscribe();
        }
      } catch (error) {
        logger.error('Failed to build Drift withdraw instruction', { error });
        throw error;
      }
    }

    // Fallback for unsupported protocols
    logger.warn(`Protocol ${protocol} not yet supported for withdraws, using placeholder`);
    const instruction = new TransactionInstruction({
      programId: new PublicKey('11111111111111111111111111111111'),
      keys: [],
      data: Buffer.from([]),
    });

    return this.addStep(instruction, {
      estimatedCUs: 100000,
      description: description || `Withdraw ${amount} ${token} from ${protocol}`,
      critical: true,
    });
  }

  /**
   * Add a withdraw step (synchronous placeholder for backward compatibility)
   * @deprecated Use addWithdrawAsync instead for real protocol integration
   */
  addWithdraw(
    protocol: string,
    token: string,
    amount: number,
    description?: string
  ): StrategyBuilder {
    logger.warn('Using deprecated addWithdraw - use addWithdrawAsync for real protocol integration');
    
    const instruction = new TransactionInstruction({
      programId: new PublicKey('11111111111111111111111111111111'),
      keys: [],
      data: Buffer.from([]),
    });

    return this.addStep(instruction, {
      estimatedCUs: 100000,
      description: description || `Withdraw ${amount} ${token} from ${protocol}`,
      critical: true,
    });
  }

  /**
   * Add a verification step
   */
  addVerification(
    walletAddress: string,
    condition: string,
    description?: string
  ): StrategyBuilder {
    const instruction = new TransactionInstruction({
      programId: new PublicKey('11111111111111111111111111111111'),
      keys: [
        { pubkey: new PublicKey(walletAddress), isSigner: false, isWritable: false },
      ],
      data: Buffer.from([]),
    });

    return this.addStep(instruction, {
      estimatedCUs: 50000,
      description: description || `Verify: ${condition}`,
      critical: false,
    });
  }

  /**
   * Set strategy metadata
   */
  setMetadata(metadata: Partial<StrategyMetadata>): StrategyBuilder {
    this.metadata = { ...this.metadata, ...metadata };
    return this;
  }

  /**
   * Validate the strategy
   */
  validate(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for empty strategy
    if (this.steps.length === 0) {
      errors.push('Strategy has no steps');
    }

    // Check total CUs
    const totalCUs = this.steps.reduce((sum, s) => sum + s.estimatedCUs, 0);
    if (totalCUs > 10_000_000) {
      warnings.push(`High total CUs (${totalCUs}). Strategy may be expensive.`);
    }

    // Check for critical steps at the end
    const lastStep = this.steps[this.steps.length - 1];
    if (lastStep && !lastStep.critical) {
      warnings.push('Last step is not critical. Consider if this is intentional.');
    }

    // Check bundle count
    const split = this.multiTxCoordinator.splitStrategy(this.steps);
    if (split.bundleCount > 3) {
      warnings.push(`Strategy requires ${split.bundleCount} bundles. Consider simplifying.`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Build the strategy
   */
  build(tipLamports: number = JITO_CONFIG.DEFAULT_TIP_LAMPORTS): BuiltStrategy {
    const validation = this.validate();
    
    if (!validation.valid) {
      throw new Error(`Invalid strategy: ${validation.errors.join(', ')}`);
    }

    if (validation.warnings.length > 0) {
      logger.warn('Strategy warnings:', validation.warnings);
    }

    const split = this.multiTxCoordinator.splitStrategy(this.steps);
    const estimatedCost = this.multiTxCoordinator.estimateStrategyCost(this.steps, tipLamports);

    logger.info(`Built strategy "${this.metadata.name}" with ${this.steps.length} steps`);

    return {
      metadata: this.metadata,
      steps: [...this.steps],
      split,
      estimatedCost,
    };
  }

  /**
   * Execute the built strategy
   */
  async execute(
    payer: Keypair,
    tipLamports: number = JITO_CONFIG.DEFAULT_TIP_LAMPORTS
  ): Promise<MultiTxResult> {
    const built = this.build(tipLamports);
    
    logger.info(`Executing strategy "${built.metadata.name}"`);
    
    return this.multiTxCoordinator.executeStrategy(this.steps, payer, { tipLamports });
  }

  /**
   * Get current steps
   */
  getSteps(): StrategyStep[] {
    return [...this.steps];
  }

  /**
   * Get step count
   */
  getStepCount(): number {
    return this.steps.length;
  }

  /**
   * Estimate cost without building
   */
  estimateCost(tipLamports: number = JITO_CONFIG.DEFAULT_TIP_LAMPORTS): {
    totalCUs: number;
    estimatedFee: number;
    tipAmount: number;
    bundleCount: number;
  } {
    return this.multiTxCoordinator.estimateStrategyCost(this.steps, tipLamports);
  }

  /**
   * Clear all steps
   */
  clear(): StrategyBuilder {
    this.steps = [];
    return this;
  }

  /**
   * Clone the builder
   */
  clone(): StrategyBuilder {
    const cloned = new StrategyBuilder(this.metadata.name, this.metadata.description);
    cloned.steps = [...this.steps];
    cloned.metadata = { ...this.metadata };
    return cloned;
  }

  /**
   * Create a recovery strategy builder
   */
  static createRecoveryStrategy(
    walletAddress: string,
    protocol: string
  ): StrategyBuilder {
    return new StrategyBuilder(`Recovery: ${protocol}`, `Protect position on ${protocol}`)
      .addHealthCheck(walletAddress, 'Check initial health');
  }

  /**
   * Create a rebalance strategy builder
   */
  static createRebalanceStrategy(
    walletAddress: string,
    fromProtocol: string,
    toProtocol: string
  ): StrategyBuilder {
    return new StrategyBuilder(
      `Rebalance: ${fromProtocol} -> ${toProtocol}`,
      `Move position from ${fromProtocol} to ${toProtocol}`
    );
  }
}

export default StrategyBuilder;
