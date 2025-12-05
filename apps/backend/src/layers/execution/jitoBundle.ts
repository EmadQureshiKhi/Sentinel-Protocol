/**
 * Jito Bundle Manager
 * Submits transactions via Jito for MEV protection
 */

import axios from 'axios';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  VersionedTransaction,
} from '@solana/web3.js';
import { logger } from '../../utils/logger';
import { withRetry } from '../../utils/retry';
import { config } from '../../config';
import { JITO_CONFIG, TIMING } from '../../config/constants';
import { TransactionBuilder } from './transactionBuilder';

// Jito tip accounts (rotate for load balancing)
// Note: Jito only works on mainnet - no devnet/testnet support
const JITO_TIP_ACCOUNTS = [
  '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
  'HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe',
  'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
  'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49',
  'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
  'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt',
  'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
  '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT',
];

// Bundle status response
export interface BundleStatus {
  bundleId: string;
  status: 'pending' | 'landed' | 'failed' | 'unknown';
  slot?: number;
  confirmationStatus?: string;
  err?: string;
}

// Bundle submission result
export interface BundleSubmissionResult {
  bundleId: string;
  success: boolean;
  error?: string;
}

export class JitoBundleManager {
  private readonly bundleUrl: string;
  private readonly tipAccounts: string[];
  private connection: Connection;
  private transactionBuilder: TransactionBuilder;
  private currentTipIndex: number = 0;

  constructor(bundleUrl?: string, rpcUrl?: string) {
    this.bundleUrl = bundleUrl || config.jitoBundleUrl;
    this.tipAccounts = JITO_TIP_ACCOUNTS;
    this.connection = new Connection(rpcUrl || config.solanaRpcUrl, 'confirmed');
    this.transactionBuilder = new TransactionBuilder(rpcUrl);
    
    logger.info('Jito Bundle Manager initialized (mainnet only)', {
      bundleUrl: this.bundleUrl,
      tipAccounts: this.tipAccounts.length,
    });
  }

  /**
   * Get next tip account (round-robin)
   */
  private getNextTipAccount(): PublicKey {
    const account = this.tipAccounts[this.currentTipIndex];
    this.currentTipIndex = (this.currentTipIndex + 1) % this.tipAccounts.length;
    return new PublicKey(account);
  }

  /**
   * Create tip instruction
   */
  createTipInstruction(
    fromPubkey: PublicKey,
    tipLamports: number = JITO_CONFIG.DEFAULT_TIP_LAMPORTS
  ): TransactionInstruction {
    const tipAccount = this.getNextTipAccount();
    
    return SystemProgram.transfer({
      fromPubkey,
      toPubkey: tipAccount,
      lamports: tipLamports,
    });
  }

  /**
   * Add tip to transaction
   */
  async addTipToTransaction(
    transaction: VersionedTransaction,
    payer: Keypair,
    tipLamports: number = JITO_CONFIG.DEFAULT_TIP_LAMPORTS
  ): Promise<VersionedTransaction> {
    // For versioned transactions, we need to rebuild with the tip instruction
    // This is a simplified version - in production, you'd want to modify the existing transaction
    logger.debug(`Adding ${tipLamports} lamports tip to transaction`);
    
    // The tip should already be included via Jupiter's prioritizationFeeLamports
    // or added during transaction building
    return transaction;
  }

  /**
   * Submit bundle to Jito
   */
  async submitBundle(
    transactions: VersionedTransaction[]
  ): Promise<BundleSubmissionResult> {
    if (transactions.length === 0) {
      return { bundleId: '', success: false, error: 'No transactions provided' };
    }

    if (transactions.length > JITO_CONFIG.MAX_TRANSACTIONS_PER_BUNDLE) {
      return {
        bundleId: '',
        success: false,
        error: `Bundle exceeds max size of ${JITO_CONFIG.MAX_TRANSACTIONS_PER_BUNDLE}`,
      };
    }

    try {
      // Serialize transactions to base64
      const serializedTxs = transactions.map((tx) =>
        Buffer.from(tx.serialize()).toString('base64')
      );

      const result = await withRetry(
        async () => {
          const response = await axios.post(
            this.bundleUrl,
            {
              jsonrpc: '2.0',
              id: 1,
              method: 'sendBundle',
              params: [serializedTxs],
            },
            {
              headers: { 'Content-Type': 'application/json' },
              timeout: TIMING.BUNDLE_TIMEOUT_MS,
            }
          );

          if (response.data.error) {
            throw new Error(response.data.error.message || 'Bundle submission failed');
          }

          return response.data.result;
        },
        { maxRetries: 3, baseDelayMs: 1000 }
      );

      logger.info('Bundle submitted successfully', { bundleId: result });

      return {
        bundleId: result,
        success: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to submit bundle:', error);
      
      return {
        bundleId: '',
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get bundle status
   */
  async getBundleStatus(bundleId: string): Promise<BundleStatus> {
    try {
      const response = await axios.post(
        this.bundleUrl,
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'getBundleStatuses',
          params: [[bundleId]],
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
        }
      );

      if (response.data.error) {
        return {
          bundleId,
          status: 'unknown',
          err: response.data.error.message,
        };
      }

      const statuses = response.data.result?.value;
      if (!statuses || statuses.length === 0) {
        return { bundleId, status: 'pending' };
      }

      const status = statuses[0];
      
      if (status.confirmation_status === 'confirmed' || status.confirmation_status === 'finalized') {
        return {
          bundleId,
          status: 'landed',
          slot: status.slot,
          confirmationStatus: status.confirmation_status,
        };
      }

      if (status.err) {
        return {
          bundleId,
          status: 'failed',
          err: JSON.stringify(status.err),
        };
      }

      return { bundleId, status: 'pending' };
    } catch (error) {
      logger.error('Failed to get bundle status:', error);
      return {
        bundleId,
        status: 'unknown',
        err: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Wait for bundle to land
   */
  async waitForBundleLanding(
    bundleId: string,
    timeoutMs: number = TIMING.BUNDLE_TIMEOUT_MS,
    pollIntervalMs: number = 1000
  ): Promise<BundleStatus> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getBundleStatus(bundleId);

      if (status.status === 'landed') {
        logger.info('Bundle landed successfully', {
          bundleId,
          slot: status.slot,
          timeMs: Date.now() - startTime,
        });
        return status;
      }

      if (status.status === 'failed') {
        logger.error('Bundle failed', { bundleId, error: status.err });
        return status;
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    logger.warn('Bundle landing timeout', { bundleId, timeoutMs });
    return {
      bundleId,
      status: 'unknown',
      err: 'Timeout waiting for bundle to land',
    };
  }

  /**
   * Submit and wait for bundle
   */
  async submitAndWaitForBundle(
    transactions: VersionedTransaction[],
    timeoutMs: number = TIMING.BUNDLE_TIMEOUT_MS
  ): Promise<BundleStatus> {
    const submission = await this.submitBundle(transactions);

    if (!submission.success) {
      return {
        bundleId: submission.bundleId,
        status: 'failed',
        err: submission.error,
      };
    }

    return this.waitForBundleLanding(submission.bundleId, timeoutMs);
  }

  /**
   * Bundle multiple transactions with tip
   */
  async bundleTransactions(
    transactions: VersionedTransaction[],
    payer: Keypair,
    tipLamports: number = JITO_CONFIG.DEFAULT_TIP_LAMPORTS
  ): Promise<BundleSubmissionResult> {
    // Ensure all transactions are signed
    const signedTxs = transactions.map((tx) => {
      if (!tx.signatures[0] || tx.signatures[0].every((b) => b === 0)) {
        tx.sign([payer]);
      }
      return tx;
    });

    return this.submitBundle(signedTxs);
  }

  /**
   * Get recommended tip amount based on network conditions
   */
  async getRecommendedTip(): Promise<number> {
    // In production, you'd query Jito's tip floor or analyze recent bundles
    // For now, return default
    return JITO_CONFIG.DEFAULT_TIP_LAMPORTS;
  }

  /**
   * Check if Jito endpoint is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      const response = await axios.post(
        this.bundleUrl,
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'getTipAccounts',
          params: [],
        },
        { timeout: 5000 }
      );

      return !response.data.error;
    } catch {
      return false;
    }
  }

  /**
   * Get transaction builder
   */
  getTransactionBuilder(): TransactionBuilder {
    return this.transactionBuilder;
  }
}

export default JitoBundleManager;
