/**
 * Arcium Privacy Types
 * Type definitions for Arcium MXE integration
 */

import { PublicKey } from '@solana/web3.js';

export interface EncryptedData {
  ciphertext: Buffer;
  nonce: Buffer;
  tag: Buffer;
  mxeClusterId: string;
}

export interface MXECluster {
  clusterId: string;
  nodes: MXENode[];
  threshold: number;
  publicKey: PublicKey;
  status: 'active' | 'inactive' | 'syncing';
}

export interface MXENode {
  nodeId: string;
  endpoint: string;
  publicKey: PublicKey;
  stake: number;
  reputation: number;
}

export interface EncryptedPosition {
  id: string;
  walletAddress: string;
  encryptedCollateral: EncryptedData;
  encryptedDebt: EncryptedData;
  encryptedHealthFactor: EncryptedData;
  encryptedLeverage: EncryptedData;
  mxeClusterId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PrivateMonitoringResult {
  walletAddress: string;
  riskLevel: 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  requiresAction: boolean;
  proofHash: string;
  timestamp: number;
}

export interface EncryptedSwapIntent {
  intentId: string;
  encryptedFromToken: EncryptedData;
  encryptedToToken: EncryptedData;
  encryptedAmount: EncryptedData;
  encryptedMinOutput: EncryptedData;
  encryptedSlippage: EncryptedData;
  walletAddress: string;
  mxeClusterId: string;
  expiresAt: number;
}

export interface PrivateSwapResult {
  intentId: string;
  success: boolean;
  transactionSignature?: string;
  proofHash: string;
  executedAt: number;
}

export interface DarkPoolOrder {
  orderId: string;
  encryptedSide: EncryptedData;
  encryptedToken: EncryptedData;
  encryptedAmount: EncryptedData;
  encryptedPrice: EncryptedData;
  walletAddress: string;
  mxeClusterId: string;
  status: 'pending' | 'matched' | 'executed' | 'cancelled';
  createdAt: number;
  expiresAt: number;
}

export interface DarkPoolMatch {
  matchId: string;
  buyOrderId: string;
  sellOrderId: string;
  encryptedExecutionPrice: EncryptedData;
  encryptedExecutionAmount: EncryptedData;
  proofHash: string;
  executedAt: number;
}

export interface MPCSignatureShare {
  nodeId: string;
  share: Buffer;
  commitment: Buffer;
}

export interface MPCSignatureResult {
  signature: Buffer;
  shares: MPCSignatureShare[];
  aggregatedAt: number;
}

export interface PrivacyConfig {
  mxeEndpoint: string;
  mxeClusterId: string;
  encryptionKeyId: string;
  darkPoolEnabled: boolean;
  privateMonitoringEnabled: boolean;
  mpcSigningEnabled: boolean;
}

export interface ZKProof {
  proofType: 'health_check' | 'swap_fairness' | 'order_validity';
  proof: Buffer;
  publicInputs: Buffer[];
  verificationKey: Buffer;
  generatedAt: number;
}

export interface EncryptedOrderFlow {
  flowId: string;
  encryptedIntents: EncryptedSwapIntent[];
  batchProof: ZKProof;
  mxeClusterId: string;
  status: 'collecting' | 'processing' | 'executed';
  createdAt: number;
}
