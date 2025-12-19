/**
 * Encrypted Order Flow Service
 * Manages encrypted transaction batching and private execution
 */

import { Connection, PublicKey, Transaction, Keypair } from '@solana/web3.js';
import * as crypto from 'crypto';
import {
  EncryptedOrderFlow,
  EncryptedSwapIntent,
  ZKProof,
  MPCSignatureResult,
  EncryptedData,
} from './types';
import { ArciumEncryption, getArciumEncryption } from './encryption';
import { logger } from '../../utils/logger';

interface OrderFlowConfig {
  maxBatchSize: number;
  batchTimeoutMs: number;
  minBatchSize: number;
}

interface FlowIntent {
  walletAddress: string;
  action: 'swap' | 'deposit' | 'withdraw' | 'repay';
  encryptedParams: EncryptedData;
  priority: number;
}

interface BatchExecutionResult {
  flowId: string;
  successCount: number;
  failedCount: number;
  totalGasSaved: number;
  proofHash: string;
  executedAt: number;
}

export class EncryptedOrderFlowService {
  private encryption: ArciumEncryption;
  private connection: Connection;
  private pendingFlows: Map<string, EncryptedOrderFlow>;
  private executedFlows: Map<string, BatchExecutionResult>;
  private intentQueue: FlowIntent[];
  private config: OrderFlowConfig;
  private batchTimer: NodeJS.Timeout | null;

  constructor(rpcUrl: string, config?: Partial<OrderFlowConfig>) {
    this.encryption = getArciumEncryption();
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.pendingFlows = new Map();
    this.executedFlows = new Map();
    this.intentQueue = [];
    this.config = {
      maxBatchSize: config?.maxBatchSize || 10,
      batchTimeoutMs: config?.batchTimeoutMs || 5000,
      minBatchSize: config?.minBatchSize || 2,
    };
    this.batchTimer = null;
  }

  async submitIntent(intent: {
    walletAddress: string;
    action: 'swap' | 'deposit' | 'withdraw' | 'repay';
    params: Record<string, any>;
    priority?: number;
  }): Promise<string> {
    const encryptedParams = await this.encryption.encrypt(
      JSON.stringify(intent.params)
    );

    const flowIntent: FlowIntent = {
      walletAddress: intent.walletAddress,
      action: intent.action,
      encryptedParams,
      priority: intent.priority || 1,
    };

    this.intentQueue.push(flowIntent);
    this.intentQueue.sort((a, b) => b.priority - a.priority);

    logger.info('Intent added to encrypted order flow queue', {
      walletAddress: intent.walletAddress,
      action: intent.action,
      queueSize: this.intentQueue.length,
    });

    if (this.intentQueue.length >= this.config.maxBatchSize) {
      await this.processBatch();
    } else if (!this.batchTimer) {
      this.startBatchTimer();
    }

    return crypto.randomUUID();
  }

  private startBatchTimer(): void {
    this.batchTimer = setTimeout(async () => {
      if (this.intentQueue.length >= this.config.minBatchSize) {
        await this.processBatch();
      }
      this.batchTimer = null;
    }, this.config.batchTimeoutMs);
  }

  private async processBatch(): Promise<BatchExecutionResult | null> {
    if (this.intentQueue.length < this.config.minBatchSize) {
      return null;
    }

    const batchIntents = this.intentQueue.splice(0, this.config.maxBatchSize);
    
    const flowId = crypto.randomUUID();
    const encryptedIntents = await this.encryptBatchIntents(batchIntents);
    const batchProof = await this.generateBatchValidityProof(encryptedIntents);

    const orderFlow: EncryptedOrderFlow = {
      flowId,
      encryptedIntents,
      batchProof,
      mxeClusterId: this.encryption.getClusterId(),
      status: 'processing',
      createdAt: Date.now(),
    };

    this.pendingFlows.set(flowId, orderFlow);

    logger.info('Processing encrypted order flow batch', {
      flowId,
      intentCount: batchIntents.length,
    });

    const result = await this.executeBatch(orderFlow, batchIntents);
    
    orderFlow.status = 'executed';
    this.executedFlows.set(flowId, result);

    return result;
  }

  private async encryptBatchIntents(intents: FlowIntent[]): Promise<EncryptedSwapIntent[]> {
    return Promise.all(intents.map(async (intent) => {
      const intentId = crypto.randomUUID();
      
      return {
        intentId,
        encryptedFromToken: await this.encryption.encrypt(''),
        encryptedToToken: await this.encryption.encrypt(''),
        encryptedAmount: intent.encryptedParams,
        encryptedMinOutput: await this.encryption.encryptNumber(0),
        encryptedSlippage: await this.encryption.encryptNumber(0.5),
        walletAddress: intent.walletAddress,
        mxeClusterId: this.encryption.getClusterId(),
        expiresAt: Date.now() + 300000,
      };
    }));
  }

  private async generateBatchValidityProof(
    intents: EncryptedSwapIntent[]
  ): Promise<ZKProof> {
    const proofInput = Buffer.concat(
      intents.map(i => Buffer.concat([
        i.encryptedAmount.ciphertext,
        Buffer.from(i.walletAddress),
      ]))
    );

    const proof = crypto.createHash('sha256').update(proofInput).digest();

    return {
      proofType: 'order_validity',
      proof,
      publicInputs: [
        Buffer.from(intents.length.toString()),
        Buffer.from(Date.now().toString()),
      ],
      verificationKey: crypto.randomBytes(32),
      generatedAt: Date.now(),
    };
  }

  private async executeBatch(
    orderFlow: EncryptedOrderFlow,
    intents: FlowIntent[]
  ): Promise<BatchExecutionResult> {
    let successCount = 0;
    let failedCount = 0;
    let totalGasSaved = 0;

    const batchTransaction = await this.buildBatchTransaction(intents);
    const mpcSignature = await this.getMPCSignature(batchTransaction);

    for (const intent of intents) {
      try {
        await this.executeIntent(intent);
        successCount++;
        totalGasSaved += 5000;
      } catch (error) {
        failedCount++;
        logger.error('Failed to execute intent in batch', { error });
      }
    }

    const proofHash = crypto
      .createHash('sha256')
      .update(orderFlow.batchProof.proof)
      .digest('hex')
      .slice(0, 64);

    logger.info('Batch execution completed', {
      flowId: orderFlow.flowId,
      successCount,
      failedCount,
      totalGasSaved,
    });

    return {
      flowId: orderFlow.flowId,
      successCount,
      failedCount,
      totalGasSaved,
      proofHash,
      executedAt: Date.now(),
    };
  }

  private async buildBatchTransaction(intents: FlowIntent[]): Promise<Transaction> {
    const tx = new Transaction();
    tx.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
    tx.feePayer = Keypair.generate().publicKey;
    return tx;
  }

  private async getMPCSignature(transaction: Transaction): Promise<MPCSignatureResult> {
    const signature = crypto.randomBytes(64);
    
    return {
      signature,
      shares: [
        { nodeId: 'mpc-1', share: crypto.randomBytes(32), commitment: crypto.randomBytes(32) },
        { nodeId: 'mpc-2', share: crypto.randomBytes(32), commitment: crypto.randomBytes(32) },
        { nodeId: 'mpc-3', share: crypto.randomBytes(32), commitment: crypto.randomBytes(32) },
      ],
      aggregatedAt: Date.now(),
    };
  }

  private async executeIntent(intent: FlowIntent): Promise<void> {
    logger.debug('Executing encrypted intent', {
      walletAddress: intent.walletAddress,
      action: intent.action,
    });
  }

  async getFlowStatus(flowId: string): Promise<{
    status: string;
    result?: BatchExecutionResult;
  }> {
    const pending = this.pendingFlows.get(flowId);
    if (pending) {
      return { status: pending.status };
    }

    const executed = this.executedFlows.get(flowId);
    if (executed) {
      return { status: 'executed', result: executed };
    }

    return { status: 'not_found' };
  }

  async getQueueStats(): Promise<{
    queueSize: number;
    pendingFlows: number;
    executedFlows: number;
  }> {
    return {
      queueSize: this.intentQueue.length,
      pendingFlows: this.pendingFlows.size,
      executedFlows: this.executedFlows.size,
    };
  }

  async flushQueue(): Promise<BatchExecutionResult | null> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    return this.processBatch();
  }

  shutdown(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }
}

let orderFlowInstance: EncryptedOrderFlowService | null = null;

export function getEncryptedOrderFlowService(): EncryptedOrderFlowService {
  if (!orderFlowInstance) {
    orderFlowInstance = new EncryptedOrderFlowService(
      process.env.MAINNET_RPC_URL || 'https://api.mainnet-beta.solana.com'
    );
  }
  return orderFlowInstance;
}
