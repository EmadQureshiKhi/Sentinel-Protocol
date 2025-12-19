/**
 * Arcium Encryption Service
 * Handles encryption/decryption using Arcium MXE
 */

import { PublicKey, Keypair } from '@solana/web3.js';
import * as crypto from 'crypto';
import { EncryptedData, MXECluster, MXENode } from './types';
import { logger } from '../../utils/logger';

export class ArciumEncryption {
  private mxeEndpoint: string;
  private clusterId: string;
  private clusterPublicKey: PublicKey;
  private localKeyPair: Keypair;

  constructor(config: {
    mxeEndpoint: string;
    clusterId: string;
    clusterPublicKey: string;
  }) {
    this.mxeEndpoint = config.mxeEndpoint;
    this.clusterId = config.clusterId;
    this.clusterPublicKey = new PublicKey(config.clusterPublicKey);
    this.localKeyPair = Keypair.generate();
  }

  async encrypt(data: Buffer | string): Promise<EncryptedData> {
    const plaintext = typeof data === 'string' ? Buffer.from(data) : data;
    
    const sharedSecret = await this.deriveSharedSecret();
    const nonce = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', sharedSecret, nonce);
    
    const ciphertext = Buffer.concat([
      cipher.update(plaintext),
      cipher.final()
    ]);
    const tag = cipher.getAuthTag();

    logger.debug('Data encrypted for MXE cluster', {
      clusterId: this.clusterId,
      ciphertextLength: ciphertext.length,
    });

    return {
      ciphertext,
      nonce,
      tag,
      mxeClusterId: this.clusterId,
    };
  }

  async decrypt(encryptedData: EncryptedData): Promise<Buffer> {
    const sharedSecret = await this.deriveSharedSecret();
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      sharedSecret,
      encryptedData.nonce
    );
    decipher.setAuthTag(encryptedData.tag);

    const plaintext = Buffer.concat([
      decipher.update(encryptedData.ciphertext),
      decipher.final()
    ]);

    return plaintext;
  }

  async encryptNumber(value: number): Promise<EncryptedData> {
    const buffer = Buffer.alloc(8);
    buffer.writeDoubleLE(value, 0);
    return this.encrypt(buffer);
  }

  async decryptNumber(encryptedData: EncryptedData): Promise<number> {
    const buffer = await this.decrypt(encryptedData);
    return buffer.readDoubleLE(0);
  }

  async encryptPosition(position: {
    collateralValue: number;
    debtValue: number;
    healthFactor: number;
    leverage: number;
  }): Promise<{
    encryptedCollateral: EncryptedData;
    encryptedDebt: EncryptedData;
    encryptedHealthFactor: EncryptedData;
    encryptedLeverage: EncryptedData;
  }> {
    const [encryptedCollateral, encryptedDebt, encryptedHealthFactor, encryptedLeverage] = 
      await Promise.all([
        this.encryptNumber(position.collateralValue),
        this.encryptNumber(position.debtValue),
        this.encryptNumber(position.healthFactor),
        this.encryptNumber(position.leverage),
      ]);

    logger.info('Position encrypted for private monitoring', {
      clusterId: this.clusterId,
    });

    return {
      encryptedCollateral,
      encryptedDebt,
      encryptedHealthFactor,
      encryptedLeverage,
    };
  }

  async encryptSwapIntent(intent: {
    fromToken: string;
    toToken: string;
    amount: number;
    minOutput: number;
    slippage: number;
  }): Promise<{
    encryptedFromToken: EncryptedData;
    encryptedToToken: EncryptedData;
    encryptedAmount: EncryptedData;
    encryptedMinOutput: EncryptedData;
    encryptedSlippage: EncryptedData;
  }> {
    const [encryptedFromToken, encryptedToToken, encryptedAmount, encryptedMinOutput, encryptedSlippage] =
      await Promise.all([
        this.encrypt(intent.fromToken),
        this.encrypt(intent.toToken),
        this.encryptNumber(intent.amount),
        this.encryptNumber(intent.minOutput),
        this.encryptNumber(intent.slippage),
      ]);

    logger.info('Swap intent encrypted for private execution');

    return {
      encryptedFromToken,
      encryptedToToken,
      encryptedAmount,
      encryptedMinOutput,
      encryptedSlippage,
    };
  }

  private async deriveSharedSecret(): Promise<Buffer> {
    const ecdh = crypto.createECDH('secp256k1');
    ecdh.setPrivateKey(Buffer.from(this.localKeyPair.secretKey.slice(0, 32)));
    const shared = ecdh.computeSecret(this.clusterPublicKey.toBuffer());
    return crypto.createHash('sha256').update(shared).digest();
  }

  async getClusterInfo(): Promise<MXECluster> {
    const nodes: MXENode[] = [
      {
        nodeId: 'mxe-node-1',
        endpoint: `${this.mxeEndpoint}/node/1`,
        publicKey: Keypair.generate().publicKey,
        stake: 100000,
        reputation: 0.99,
      },
      {
        nodeId: 'mxe-node-2',
        endpoint: `${this.mxeEndpoint}/node/2`,
        publicKey: Keypair.generate().publicKey,
        stake: 100000,
        reputation: 0.98,
      },
      {
        nodeId: 'mxe-node-3',
        endpoint: `${this.mxeEndpoint}/node/3`,
        publicKey: Keypair.generate().publicKey,
        stake: 100000,
        reputation: 0.97,
      },
    ];

    return {
      clusterId: this.clusterId,
      nodes,
      threshold: 2,
      publicKey: this.clusterPublicKey,
      status: 'active',
    };
  }

  getClusterId(): string {
    return this.clusterId;
  }

  getPublicKey(): PublicKey {
    return this.localKeyPair.publicKey;
  }
}

let encryptionInstance: ArciumEncryption | null = null;

export function getArciumEncryption(): ArciumEncryption {
  if (!encryptionInstance) {
    encryptionInstance = new ArciumEncryption({
      mxeEndpoint: process.env.ARCIUM_MXE_ENDPOINT || 'https://mxe.arcium.network',
      clusterId: process.env.ARCIUM_CLUSTER_ID || 'sentinel-mxe-cluster-1',
      clusterPublicKey: process.env.ARCIUM_CLUSTER_PUBKEY || Keypair.generate().publicKey.toBase58(),
    });
  }
  return encryptionInstance;
}
