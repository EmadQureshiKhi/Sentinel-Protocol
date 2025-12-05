/**
 * Transaction Builder
 * Builds versioned transactions with compute budget and address lookup tables
 */

import {
  Connection,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  Keypair,
} from '@solana/web3.js';
import { logger } from '../../utils/logger';
import { config } from '../../config';
import { Instruction, SwapInstructionsResponse } from './jupiterSwap';

// Transaction build options
export interface TransactionBuildOptions {
  computeUnits?: number;
  computeUnitPrice?: number; // microLamports
  useVersionedTransaction?: boolean;
  skipPreflight?: boolean;
}

// Built transaction result
export interface BuiltTransaction {
  transaction: VersionedTransaction;
  blockhash: string;
  lastValidBlockHeight: number;
  estimatedFee: number;
}

// Simulation result
export interface SimulationResult {
  success: boolean;
  unitsConsumed?: number;
  logs?: string[];
  error?: string;
}

export class TransactionBuilder {
  private connection: Connection;

  constructor(rpcUrl?: string) {
    this.connection = new Connection(
      rpcUrl || config.solanaRpcUrl,
      'confirmed'
    );
    logger.info('Transaction Builder initialized');
  }

  /**
   * Convert Jupiter instruction to Solana TransactionInstruction
   */
  private toTransactionInstruction(instruction: Instruction): TransactionInstruction {
    return new TransactionInstruction({
      programId: new PublicKey(instruction.programId),
      keys: instruction.accounts.map((acc) => ({
        pubkey: new PublicKey(acc.pubkey),
        isSigner: acc.isSigner,
        isWritable: acc.isWritable,
      })),
      data: Buffer.from(instruction.data, 'base64'),
    });
  }

  /**
   * Build versioned transaction from Jupiter swap instructions
   */
  async buildSwapTransaction(
    swapInstructions: SwapInstructionsResponse,
    payerPublicKey: PublicKey,
    options: TransactionBuildOptions = {}
  ): Promise<BuiltTransaction> {
    try {
      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');

      // Build instruction list
      const instructions: TransactionInstruction[] = [];

      // Add compute budget instructions
      if (options.computeUnits) {
        instructions.push(
          ComputeBudgetProgram.setComputeUnitLimit({
            units: options.computeUnits,
          })
        );
      }

      if (options.computeUnitPrice) {
        instructions.push(
          ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: options.computeUnitPrice,
          })
        );
      }

      // Add Jupiter's compute budget instructions (if not overridden)
      if (!options.computeUnits && !options.computeUnitPrice) {
        for (const ix of swapInstructions.computeBudgetInstructions) {
          instructions.push(this.toTransactionInstruction(ix));
        }
      }

      // Add setup instructions
      for (const ix of swapInstructions.setupInstructions) {
        instructions.push(this.toTransactionInstruction(ix));
      }

      // Add swap instruction
      instructions.push(this.toTransactionInstruction(swapInstructions.swapInstruction));

      // Add cleanup instruction if present
      if (swapInstructions.cleanupInstruction) {
        instructions.push(this.toTransactionInstruction(swapInstructions.cleanupInstruction));
      }

      // Add other instructions (like Jito tips)
      for (const ix of swapInstructions.otherInstructions) {
        instructions.push(this.toTransactionInstruction(ix));
      }

      // Load address lookup tables
      const lookupTableAccounts = await this.loadAddressLookupTables(
        swapInstructions.addressLookupTableAddresses
      );

      // Build versioned transaction
      const messageV0 = new TransactionMessage({
        payerKey: payerPublicKey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message(lookupTableAccounts);

      const transaction = new VersionedTransaction(messageV0);

      // Estimate fee
      const estimatedFee = await this.estimateFee(transaction);

      logger.debug('Built swap transaction', {
        instructions: instructions.length,
        lookupTables: lookupTableAccounts.length,
        estimatedFee,
      });

      return {
        transaction,
        blockhash,
        lastValidBlockHeight,
        estimatedFee,
      };
    } catch (error) {
      logger.error('Failed to build swap transaction:', error);
      throw error;
    }
  }

  /**
   * Build a simple versioned transaction from instructions
   */
  async buildVersionedTransaction(
    instructions: TransactionInstruction[],
    payerPublicKey: PublicKey,
    lookupTableAddresses: string[] = [],
    options: TransactionBuildOptions = {}
  ): Promise<BuiltTransaction> {
    try {
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');

      const allInstructions: TransactionInstruction[] = [];

      // Add compute budget if specified
      if (options.computeUnits) {
        allInstructions.push(
          ComputeBudgetProgram.setComputeUnitLimit({
            units: options.computeUnits,
          })
        );
      }

      if (options.computeUnitPrice) {
        allInstructions.push(
          ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: options.computeUnitPrice,
          })
        );
      }

      allInstructions.push(...instructions);

      // Load lookup tables
      const lookupTableAccounts = await this.loadAddressLookupTables(lookupTableAddresses);

      const messageV0 = new TransactionMessage({
        payerKey: payerPublicKey,
        recentBlockhash: blockhash,
        instructions: allInstructions,
      }).compileToV0Message(lookupTableAccounts);

      const transaction = new VersionedTransaction(messageV0);
      const estimatedFee = await this.estimateFee(transaction);

      return {
        transaction,
        blockhash,
        lastValidBlockHeight,
        estimatedFee,
      };
    } catch (error) {
      logger.error('Failed to build versioned transaction:', error);
      throw error;
    }
  }

  /**
   * Load address lookup table accounts
   */
  private async loadAddressLookupTables(
    addresses: string[]
  ): Promise<AddressLookupTableAccount[]> {
    if (addresses.length === 0) {
      return [];
    }

    const lookupTableAccounts: AddressLookupTableAccount[] = [];

    for (const address of addresses) {
      try {
        const pubkey = new PublicKey(address);
        const response = await this.connection.getAddressLookupTable(pubkey);
        
        if (response.value) {
          lookupTableAccounts.push(response.value);
        }
      } catch (error) {
        logger.warn(`Failed to load lookup table ${address}:`, error);
      }
    }

    return lookupTableAccounts;
  }

  /**
   * Estimate transaction fee
   */
  private async estimateFee(transaction: VersionedTransaction): Promise<number> {
    try {
      const fee = await this.connection.getFeeForMessage(
        transaction.message,
        'confirmed'
      );
      return fee.value || 5000; // Default to 5000 lamports
    } catch {
      return 5000;
    }
  }

  /**
   * Simulate transaction
   */
  async simulateTransaction(
    transaction: VersionedTransaction
  ): Promise<SimulationResult> {
    try {
      const simulation = await this.connection.simulateTransaction(transaction, {
        sigVerify: false,
        replaceRecentBlockhash: true,
      });

      if (simulation.value.err) {
        return {
          success: false,
          unitsConsumed: simulation.value.unitsConsumed,
          logs: simulation.value.logs || [],
          error: JSON.stringify(simulation.value.err),
        };
      }

      return {
        success: true,
        unitsConsumed: simulation.value.unitsConsumed,
        logs: simulation.value.logs || [],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Sign transaction with keypair
   */
  signTransaction(
    transaction: VersionedTransaction,
    signers: Keypair[]
  ): VersionedTransaction {
    transaction.sign(signers);
    return transaction;
  }

  /**
   * Serialize transaction for sending
   */
  serializeTransaction(transaction: VersionedTransaction): Buffer {
    return Buffer.from(transaction.serialize());
  }

  /**
   * Get optimal compute unit price based on recent priority fees
   */
  async getOptimalComputeUnitPrice(
    percentile: number = 50
  ): Promise<number> {
    try {
      const fees = await this.connection.getRecentPrioritizationFees();
      
      if (fees.length === 0) {
        return 1000; // Default 1000 microLamports
      }

      // Sort by fee and get percentile
      const sortedFees = fees
        .map(f => f.prioritizationFee)
        .sort((a, b) => a - b);
      
      const index = Math.floor((percentile / 100) * sortedFees.length);
      return sortedFees[index] || 1000;
    } catch {
      return 1000;
    }
  }

  /**
   * Get connection
   */
  getConnection(): Connection {
    return this.connection;
  }

  /**
   * Update connection
   */
  setConnection(rpcUrl: string): void {
    this.connection = new Connection(rpcUrl, 'confirmed');
    logger.info('Transaction builder connection updated');
  }
}

export default TransactionBuilder;
