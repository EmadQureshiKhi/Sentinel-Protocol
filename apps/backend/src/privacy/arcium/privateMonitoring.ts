/**
 * Private Position Monitoring Service
 * Monitors positions using encrypted data in Arcium MXE
 */

import { PublicKey } from '@solana/web3.js';
import * as crypto from 'crypto';
import { 
  EncryptedPosition, 
  PrivateMonitoringResult, 
  ZKProof,
  EncryptedData 
} from './types';
import { ArciumEncryption, getArciumEncryption } from './encryption';
import { logger } from '../../utils/logger';

interface HealthCheckParams {
  encryptedCollateral: EncryptedData;
  encryptedDebt: EncryptedData;
  threshold: number;
}

interface RiskThresholds {
  safe: number;
  low: number;
  medium: number;
  high: number;
}

export class PrivateMonitoringService {
  private encryption: ArciumEncryption;
  private encryptedPositions: Map<string, EncryptedPosition>;
  private monitoringResults: Map<string, PrivateMonitoringResult>;
  private riskThresholds: RiskThresholds;

  constructor() {
    this.encryption = getArciumEncryption();
    this.encryptedPositions = new Map();
    this.monitoringResults = new Map();
    this.riskThresholds = {
      safe: 2.0,
      low: 1.5,
      medium: 1.3,
      high: 1.1,
    };
  }

  async encryptAndStorePosition(
    walletAddress: string,
    position: {
      collateralValue: number;
      debtValue: number;
      healthFactor: number;
      leverage: number;
    }
  ): Promise<EncryptedPosition> {
    const encrypted = await this.encryption.encryptPosition(position);
    
    const encryptedPosition: EncryptedPosition = {
      id: crypto.randomUUID(),
      walletAddress,
      encryptedCollateral: encrypted.encryptedCollateral,
      encryptedDebt: encrypted.encryptedDebt,
      encryptedHealthFactor: encrypted.encryptedHealthFactor,
      encryptedLeverage: encrypted.encryptedLeverage,
      mxeClusterId: this.encryption.getClusterId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.encryptedPositions.set(walletAddress, encryptedPosition);

    logger.info('Position encrypted and stored for private monitoring', {
      walletAddress,
      positionId: encryptedPosition.id,
      mxeCluster: encryptedPosition.mxeClusterId,
    });

    return encryptedPosition;
  }

  async computePrivateHealthCheck(walletAddress: string): Promise<PrivateMonitoringResult> {
    const encryptedPosition = this.encryptedPositions.get(walletAddress);
    
    if (!encryptedPosition) {
      return {
        walletAddress,
        riskLevel: 'SAFE',
        requiresAction: false,
        proofHash: this.generateProofHash(walletAddress, 'no_position'),
        timestamp: Date.now(),
      };
    }

    const healthFactor = await this.encryption.decryptNumber(
      encryptedPosition.encryptedHealthFactor
    );

    const riskLevel = this.computeRiskLevel(healthFactor);
    const requiresAction = riskLevel === 'HIGH' || riskLevel === 'CRITICAL';

    const proof = await this.generateHealthCheckProof({
      encryptedCollateral: encryptedPosition.encryptedCollateral,
      encryptedDebt: encryptedPosition.encryptedDebt,
      threshold: this.riskThresholds.high,
    });

    const result: PrivateMonitoringResult = {
      walletAddress,
      riskLevel,
      requiresAction,
      proofHash: proof.proof.toString('hex').slice(0, 64),
      timestamp: Date.now(),
    };

    this.monitoringResults.set(walletAddress, result);

    logger.info('Private health check completed', {
      walletAddress,
      riskLevel,
      requiresAction,
    });

    return result;
  }

  async batchPrivateHealthCheck(walletAddresses: string[]): Promise<PrivateMonitoringResult[]> {
    const results = await Promise.all(
      walletAddresses.map(addr => this.computePrivateHealthCheck(addr))
    );

    const atRiskCount = results.filter(r => r.requiresAction).length;
    
    logger.info('Batch private health check completed', {
      totalChecked: walletAddresses.length,
      atRiskCount,
    });

    return results;
  }

  private computeRiskLevel(healthFactor: number): PrivateMonitoringResult['riskLevel'] {
    if (healthFactor >= this.riskThresholds.safe) return 'SAFE';
    if (healthFactor >= this.riskThresholds.low) return 'LOW';
    if (healthFactor >= this.riskThresholds.medium) return 'MEDIUM';
    if (healthFactor >= this.riskThresholds.high) return 'HIGH';
    return 'CRITICAL';
  }

  private async generateHealthCheckProof(params: HealthCheckParams): Promise<ZKProof> {
    const proofInput = Buffer.concat([
      params.encryptedCollateral.ciphertext,
      params.encryptedDebt.ciphertext,
      Buffer.from(params.threshold.toString()),
    ]);

    const proof = crypto.createHash('sha256').update(proofInput).digest();
    const verificationKey = crypto.randomBytes(32);

    return {
      proofType: 'health_check',
      proof,
      publicInputs: [Buffer.from(params.threshold.toString())],
      verificationKey,
      generatedAt: Date.now(),
    };
  }

  private generateProofHash(walletAddress: string, status: string): string {
    return crypto
      .createHash('sha256')
      .update(`${walletAddress}:${status}:${Date.now()}`)
      .digest('hex')
      .slice(0, 64);
  }

  async getEncryptedPosition(walletAddress: string): Promise<EncryptedPosition | null> {
    return this.encryptedPositions.get(walletAddress) || null;
  }

  async getLatestMonitoringResult(walletAddress: string): Promise<PrivateMonitoringResult | null> {
    return this.monitoringResults.get(walletAddress) || null;
  }

  async updateRiskThresholds(thresholds: Partial<RiskThresholds>): Promise<void> {
    this.riskThresholds = { ...this.riskThresholds, ...thresholds };
    logger.info('Risk thresholds updated', { thresholds: this.riskThresholds });
  }

  async getAggregatedRiskStats(): Promise<{
    totalMonitored: number;
    byRiskLevel: Record<string, number>;
    requiresActionCount: number;
  }> {
    const results = Array.from(this.monitoringResults.values());
    
    const byRiskLevel: Record<string, number> = {
      SAFE: 0,
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };

    let requiresActionCount = 0;

    for (const result of results) {
      byRiskLevel[result.riskLevel]++;
      if (result.requiresAction) requiresActionCount++;
    }

    return {
      totalMonitored: results.length,
      byRiskLevel,
      requiresActionCount,
    };
  }
}

let monitoringInstance: PrivateMonitoringService | null = null;

export function getPrivateMonitoringService(): PrivateMonitoringService {
  if (!monitoringInstance) {
    monitoringInstance = new PrivateMonitoringService();
  }
  return monitoringInstance;
}
