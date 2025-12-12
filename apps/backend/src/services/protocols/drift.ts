/**
 * Drift Protocol Service
 * Fetches rates and handles position operations for Drift Protocol
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { ProtocolRates, TokenRate, NetworkType, TOKEN_MINTS, TOKEN_DECIMALS } from './types';
import { logger } from '../../utils/logger';

// Drift program IDs
const DRIFT_PROGRAM_ID = 'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH';

// RPC endpoints
const RPC_ENDPOINTS = {
  'mainnet-beta': process.env.MAINNET_RPC_URL || 'https://api.mainnet-beta.solana.com',
  'devnet': process.env.DEVNET_RPC_URL || 'https://api.devnet.solana.com',
};

// Drift spot market indices (mainnet)
const DRIFT_MARKETS = {
  SOL: 1,
  USDC: 0,
  mSOL: 2,
  jitoSOL: 6,
  bSOL: 4,
};

export class DriftService {
  private connection: Connection;
  private network: NetworkType;

  constructor(network: NetworkType = 'mainnet-beta') {
    this.network = network;
    this.connection = new Connection(RPC_ENDPOINTS[network], 'confirmed');
  }

  /**
   * Get all rates from Drift Protocol
   */
  async getRates(): Promise<ProtocolRates> {
    try {
      logger.info('Fetching Drift rates', { network: this.network });

      // For now, return mock data that matches real Drift rates structure
      // In production, we'd use the Drift SDK to fetch actual rates
      const rates: TokenRate[] = await this.fetchSpotMarketRates();

      const tvl = rates.reduce((sum, r) => sum + r.totalSupply, 0);

      return {
        protocol: 'DRIFT',
        network: this.network,
        rates,
        tvl,
        updatedAt: new Date(),
      };
    } catch (error) {
      logger.error('Error fetching Drift rates', { error });
      throw error;
    }
  }

  /**
   * Fetch spot market rates
   */
  private async fetchSpotMarketRates(): Promise<TokenRate[]> {
    const rates: TokenRate[] = [];

    // SOL market
    rates.push({
      token: 'SOL',
      symbol: 'SOL',
      mint: TOKEN_MINTS[this.network === 'mainnet-beta' ? 'mainnet' : 'devnet'].SOL,
      supplyApy: 5.2,
      borrowApy: 8.5,
      totalSupply: 125000000,
      totalBorrow: 45000000,
      utilization: 36,
      ltv: 80,
      liquidationThreshold: 85,
      liquidationPenalty: 5,
    });

    // USDC market
    rates.push({
      token: 'USDC',
      symbol: 'USDC',
      mint: TOKEN_MINTS[this.network === 'mainnet-beta' ? 'mainnet' : 'devnet'].USDC,
      supplyApy: 8.1,
      borrowApy: 12.5,
      totalSupply: 85000000,
      totalBorrow: 62000000,
      utilization: 73,
      ltv: 90,
      liquidationThreshold: 95,
      liquidationPenalty: 3,
    });

    // mSOL market
    rates.push({
      token: 'mSOL',
      symbol: 'mSOL',
      mint: TOKEN_MINTS[this.network === 'mainnet-beta' ? 'mainnet' : 'devnet'].mSOL,
      supplyApy: 6.3,
      borrowApy: 9.8,
      totalSupply: 45000000,
      totalBorrow: 12000000,
      utilization: 27,
      ltv: 75,
      liquidationThreshold: 80,
      liquidationPenalty: 5,
    });

    // jitoSOL market (mainnet only)
    if (this.network === 'mainnet-beta') {
      rates.push({
        token: 'jitoSOL',
        symbol: 'jitoSOL',
        mint: TOKEN_MINTS.mainnet.jitoSOL,
        supplyApy: 7.1,
        borrowApy: 10.2,
        totalSupply: 32000000,
        totalBorrow: 8000000,
        utilization: 25,
        ltv: 75,
        liquidationThreshold: 80,
        liquidationPenalty: 5,
      });
    }

    return rates;
  }

  /**
   * Get specific token rate
   */
  async getTokenRate(token: string): Promise<TokenRate | null> {
    const rates = await this.getRates();
    return rates.rates.find(r => r.token === token) || null;
  }

  /**
   * Calculate liquidation price for a position
   */
  calculateLiquidationPrice(
    collateralAmount: number,
    collateralPrice: number,
    borrowAmount: number,
    ltv: number
  ): number {
    // Liquidation occurs when: collateralValue * ltv = borrowValue
    // collateralAmount * liquidationPrice * ltv = borrowAmount
    // liquidationPrice = borrowAmount / (collateralAmount * ltv)
    return borrowAmount / (collateralAmount * (ltv / 100));
  }

  /**
   * Calculate health factor
   */
  calculateHealthFactor(
    collateralValue: number,
    borrowValue: number,
    liquidationThreshold: number
  ): number {
    if (borrowValue === 0) return Infinity;
    return (collateralValue * (liquidationThreshold / 100)) / borrowValue;
  }
}

export const createDriftService = (network: NetworkType) => new DriftService(network);
