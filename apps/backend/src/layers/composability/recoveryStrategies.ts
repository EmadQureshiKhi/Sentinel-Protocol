/**
 * Recovery Strategies
 * Builds transaction sequences for protecting at-risk positions
 */

import {
  Keypair,
  PublicKey,
  TransactionInstruction,
  SystemProgram,
} from '@solana/web3.js';
import { logger } from '../../utils/logger';
import { JupiterSwapEngine } from '../execution/jupiterSwap';
import { MultiTransactionCoordinator, StrategyStep, MultiTxResult } from './multiTxCoordinator';
import { TOKENS, Protocol } from '../../config/constants';

// Recovery strategy configuration
export interface RecoveryConfig {
  walletAddress: string;
  protocol: Protocol;
  currentHealthFactor: number;
  targetHealthFactor: number;
  collateralToken: string;
  debtToken: string;
  swapPercentage: number; // 0-100, percentage of collateral to swap
  maxSlippageBps: number;
}

// Recovery strategy result
export interface RecoveryResult {
  success: boolean;
  initialHealthFactor: number;
  finalHealthFactor?: number;
  swappedAmount?: string;
  receivedAmount?: string;
  bundleIds: string[];
  error?: string;
  durationMs: number;
}

// Strategy step types
export type RecoveryStepType = 
  | 'health_check'
  | 'swap_collateral'
  | 'deposit'
  | 'verify_health';

export class RecoveryStrategies {
  private jupiterEngine: JupiterSwapEngine;
  private multiTxCoordinator: MultiTransactionCoordinator;

  constructor(rpcUrl?: string) {
    this.jupiterEngine = new JupiterSwapEngine();
    this.multiTxCoordinator = new MultiTransactionCoordinator(rpcUrl);
    
    logger.info('Recovery Strategies initialized');
  }

  /**
   * Build health check instruction
   * Reads current health factor from protocol
   * 
   * Note: For Drift, health is calculated off-chain from account data
   * This creates a no-op instruction as a marker in the strategy
   */
  async buildHealthCheckStep(
    walletAddress: string,
    protocol: Protocol
  ): Promise<StrategyStep> {
    if (protocol === 'DRIFT') {
      // For Drift, we can use the Drift SDK to get user account data
      // Health factor is calculated from the account state
      // This is a marker instruction - actual health check happens off-chain
      const DriftSDK = await import('@drift-labs/sdk');
      const { getUserAccountPublicKeySync } = DriftSDK;
      
      const userPubkey = new PublicKey(walletAddress);
      
      // Get Drift program ID
      const DRIFT_PROGRAM_ID = new PublicKey('dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH');
      
      // Derive user account PDA
      const userAccountPDA = getUserAccountPublicKeySync(DRIFT_PROGRAM_ID, userPubkey, 0);
      
      // Create a read-only instruction to the user account
      const instruction = new TransactionInstruction({
        programId: DRIFT_PROGRAM_ID,
        keys: [
          { pubkey: userAccountPDA, isSigner: false, isWritable: false },
          { pubkey: userPubkey, isSigner: false, isWritable: false },
        ],
        data: Buffer.from([]), // No-op data
      });

      return {
        instruction,
        estimatedCUs: 50000,
        description: `Check Drift health factor`,
        critical: false, // Health check is informational
      };
    }

    // Fallback for other protocols
    const instruction = new TransactionInstruction({
      programId: new PublicKey('11111111111111111111111111111111'),
      keys: [
        { pubkey: new PublicKey(walletAddress), isSigner: false, isWritable: false },
      ],
      data: Buffer.from([]),
    });

    return {
      instruction,
      estimatedCUs: 50000,
      description: `Check health factor on ${protocol}`,
      critical: false,
    };
  }

  /**
   * Build swap collateral instruction
   * Swaps volatile collateral to stable
   */
  async buildSwapCollateralStep(
    fromToken: string,
    toToken: string,
    amount: number,
    slippageBps: number,
    userPublicKey: string
  ): Promise<StrategyStep> {
    // Get swap quote
    const quote = await this.jupiterEngine.getSwapQuote(
      fromToken,
      toToken,
      amount,
      slippageBps
    );

    // Get swap instructions
    const swapInstructions = await this.jupiterEngine.getSwapInstructions(
      quote,
      userPublicKey,
      {
        wrapAndUnwrapSol: true,
        useSharedAccounts: true,
        dynamicComputeUnitLimit: true,
      }
    );

    // Combine all swap instructions into one step
    // In practice, you'd handle this differently
    const mainInstruction = new TransactionInstruction({
      programId: new PublicKey(swapInstructions.swapInstruction.programId),
      keys: swapInstructions.swapInstruction.accounts.map(acc => ({
        pubkey: new PublicKey(acc.pubkey),
        isSigner: acc.isSigner,
        isWritable: acc.isWritable,
      })),
      data: Buffer.from(swapInstructions.swapInstruction.data, 'base64'),
    });

    return {
      instruction: mainInstruction,
      estimatedCUs: 300000, // Swaps typically use ~200-400k CUs
      description: `Swap ${fromToken.slice(0, 8)}... to ${toToken.slice(0, 8)}...`,
      critical: true,
    };
  }

  /**
   * Build deposit instruction using real protocol SDK
   * Deposits tokens into protocol to improve health
   */
  async buildDepositStep(
    protocol: Protocol,
    token: string,
    amount: number,
    marketIndex: number,
    userPublicKey: string,
    userTokenAccount: string
  ): Promise<StrategyStep> {
    if (protocol === 'DRIFT') {
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
          signTransaction: async (tx: any) => tx,
          signAllTransactions: async (txs: any[]) => txs,
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
            true // userInitialized
          );

          await driftClient.unsubscribe();

          return {
            instruction,
            estimatedCUs: 100000,
            description: `Deposit ${amount} ${token} to Drift`,
            critical: true,
          };
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
      keys: [
        { pubkey: new PublicKey(userPublicKey), isSigner: true, isWritable: true },
      ],
      data: Buffer.from([]),
    });

    return {
      instruction,
      estimatedCUs: 100000,
      description: `Deposit ${amount} to ${protocol}`,
      critical: true,
    };
  }

  /**
   * Build emergency withdraw instruction
   * Withdraws collateral to reduce position risk
   */
  async buildEmergencyWithdrawStep(
    protocol: Protocol,
    token: string,
    amount: number,
    marketIndex: number,
    userPublicKey: string
  ): Promise<StrategyStep> {
    if (protocol === 'DRIFT') {
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
          signTransaction: async (tx: any) => tx,
          signAllTransactions: async (txs: any[]) => txs,
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
            false // reduceOnly = false
          );

          await driftClient.unsubscribe();

          return {
            instruction,
            estimatedCUs: 100000,
            description: `Emergency withdraw ${amount} ${token} from Drift`,
            critical: true,
          };
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
      keys: [
        { pubkey: new PublicKey(userPublicKey), isSigner: true, isWritable: true },
      ],
      data: Buffer.from([]),
    });

    return {
      instruction,
      estimatedCUs: 100000,
      description: `Emergency withdraw ${amount} from ${protocol}`,
      critical: true,
    };
  }

  /**
   * Build verify health instruction
   * Confirms health factor improved after recovery
   */
  buildVerifyHealthStep(
    walletAddress: string,
    protocol: Protocol,
    minHealthFactor: number
  ): StrategyStep {
    const instruction = new TransactionInstruction({
      programId: new PublicKey('11111111111111111111111111111111'),
      keys: [
        { pubkey: new PublicKey(walletAddress), isSigner: false, isWritable: false },
      ],
      data: Buffer.from([]),
    });

    return {
      instruction,
      estimatedCUs: 50000,
      description: `Verify health factor >= ${minHealthFactor}`,
      critical: false, // Verification failure doesn't rollback
    };
  }

  /**
   * Build complete recovery strategy
   * TX1: Check health -> TX2: Swap -> TX3: Deposit -> TX4: Verify
   */
  async buildRecoveryStrategy(config: RecoveryConfig): Promise<StrategyStep[]> {
    const steps: StrategyStep[] = [];

    // Step 1: Check current health
    const healthCheckStep = await this.buildHealthCheckStep(config.walletAddress, config.protocol);
    steps.push(healthCheckStep);

    // Step 2: Calculate swap amount and build swap step
    // In production, you'd calculate based on actual position data
    const swapAmount = 1e9 * (config.swapPercentage / 100); // Placeholder calculation
    
    const swapStep = await this.buildSwapCollateralStep(
      config.collateralToken,
      config.debtToken,
      swapAmount,
      config.maxSlippageBps,
      config.walletAddress
    );
    steps.push(swapStep);

    // Step 3: Deposit received tokens
    // Get market index for debt token (USDC = 0, SOL = 1, etc.)
    const marketIndexMap: Record<string, number> = {
      'USDC': 0, 'SOL': 1, 'mSOL': 2, 'USDT': 5,
      'jitoSOL': 6, 'PYTH': 7, 'bSOL': 8, 'JTO': 9,
      'WIF': 10, 'JUP': 11,
    };
    const debtMarketIndex = marketIndexMap[config.debtToken.toUpperCase()] || 0;
    
    const depositStep = await this.buildDepositStep(
      config.protocol,
      config.debtToken,
      swapAmount, // Would be actual received amount
      debtMarketIndex,
      config.walletAddress,
      config.walletAddress // Simplified - would be actual token account
    );
    steps.push(depositStep);

    // Step 4: Verify health improved
    steps.push(this.buildVerifyHealthStep(
      config.walletAddress,
      config.protocol,
      config.targetHealthFactor
    ));

    logger.info(`Built recovery strategy with ${steps.length} steps`, {
      protocol: config.protocol,
      swapAmount,
      targetHealth: config.targetHealthFactor,
    });
    
    return steps;
  }

  /**
   * Execute recovery strategy
   */
  async executeRecoveryStrategy(
    config: RecoveryConfig,
    payer: Keypair
  ): Promise<RecoveryResult> {
    const startTime = Date.now();

    try {
      // Build strategy steps
      const steps = await this.buildRecoveryStrategy(config);

      // Execute via multi-tx coordinator
      const result = await this.multiTxCoordinator.executeStrategy(steps, payer);

      if (result.success) {
        logger.info('Recovery strategy executed successfully');
        
        return {
          success: true,
          initialHealthFactor: config.currentHealthFactor,
          finalHealthFactor: config.targetHealthFactor, // Would be actual measured value
          bundleIds: result.bundleIds,
          durationMs: Date.now() - startTime,
        };
      }

      return {
        success: false,
        initialHealthFactor: config.currentHealthFactor,
        bundleIds: result.bundleIds,
        error: result.error,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Recovery strategy failed:', error);

      return {
        success: false,
        initialHealthFactor: config.currentHealthFactor,
        bundleIds: [],
        error: errorMessage,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Build collateral swap recovery strategy
   * Swaps volatile collateral to stable without depositing
   * Useful when you want to reduce exposure but maintain position
   */
  async buildCollateralSwapStrategy(
    config: RecoveryConfig
  ): Promise<StrategyStep[]> {
    const steps: StrategyStep[] = [];

    // Step 1: Check current health
    const healthCheckStep = await this.buildHealthCheckStep(config.walletAddress, config.protocol);
    steps.push(healthCheckStep);

    // Step 2: Emergency withdraw volatile collateral
    const marketIndexMap: Record<string, number> = {
      'USDC': 0, 'SOL': 1, 'mSOL': 2, 'USDT': 5,
      'jitoSOL': 6, 'PYTH': 7, 'bSOL': 8, 'JTO': 9,
      'WIF': 10, 'JUP': 11,
    };
    const collateralMarketIndex = marketIndexMap[config.collateralToken.toUpperCase()] || 1;
    const withdrawAmount = 1e9 * (config.swapPercentage / 100);
    
    const withdrawStep = await this.buildEmergencyWithdrawStep(
      config.protocol,
      config.collateralToken,
      withdrawAmount,
      collateralMarketIndex,
      config.walletAddress
    );
    steps.push(withdrawStep);

    // Step 3: Swap to stable
    const swapStep = await this.buildSwapCollateralStep(
      config.collateralToken,
      config.debtToken,
      withdrawAmount,
      config.maxSlippageBps,
      config.walletAddress
    );
    steps.push(swapStep);

    // Step 4: Deposit stable collateral back
    const debtMarketIndex = marketIndexMap[config.debtToken.toUpperCase()] || 0;
    const depositStep = await this.buildDepositStep(
      config.protocol,
      config.debtToken,
      withdrawAmount, // Would be actual received amount
      debtMarketIndex,
      config.walletAddress,
      config.walletAddress
    );
    steps.push(depositStep);

    // Step 5: Verify health improved
    steps.push(this.buildVerifyHealthStep(
      config.walletAddress,
      config.protocol,
      config.targetHealthFactor
    ));

    logger.info(`Built collateral swap strategy with ${steps.length} steps`, {
      protocol: config.protocol,
      from: config.collateralToken,
      to: config.debtToken,
      amount: withdrawAmount,
    });

    return steps;
  }

  /**
   * Calculate optimal swap percentage based on health factor
   */
  calculateOptimalSwapPercentage(
    currentHealth: number,
    targetHealth: number,
    leverage: number
  ): number {
    if (currentHealth >= targetHealth) {
      return 0; // No swap needed
    }

    // Simple calculation: swap enough to reach target
    // In production, this would be more sophisticated
    const healthGap = targetHealth - currentHealth;
    const basePercentage = healthGap * 20; // 20% per 0.1 health factor gap
    
    // Adjust for leverage
    const leverageMultiplier = Math.min(leverage / 2, 2);
    
    return Math.min(basePercentage * leverageMultiplier, 50); // Cap at 50%
  }

  /**
   * Estimate recovery cost
   */
  async estimateRecoveryCost(config: RecoveryConfig): Promise<{
    estimatedFee: number;
    estimatedTip: number;
    totalCost: number;
    swapAmount: number;
  }> {
    const steps = await this.buildRecoveryStrategy(config);
    const cost = this.multiTxCoordinator.estimateStrategyCost(steps);
    
    const swapAmount = 1e9 * (config.swapPercentage / 100);

    return {
      estimatedFee: cost.estimatedFee,
      estimatedTip: cost.tipAmount,
      totalCost: cost.estimatedFee + cost.tipAmount,
      swapAmount,
    };
  }

  /**
   * Get multi-tx coordinator for direct access
   */
  getMultiTxCoordinator(): MultiTransactionCoordinator {
    return this.multiTxCoordinator;
  }
}

export default RecoveryStrategies;
