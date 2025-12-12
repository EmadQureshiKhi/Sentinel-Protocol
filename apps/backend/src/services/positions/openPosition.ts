/**
 * Position Opening Service
 * Builds transactions for opening leveraged positions on each protocol
 */

import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { logger } from '../../utils/logger';
import { ProtocolName, NetworkType } from '../protocols/types';
import { getQuoteService } from './quoteService';
import { DatabaseService } from '../database';

const prisma = DatabaseService.getInstance().getClient();
import {
  OpenPositionRequest,
  OpenPositionResponse,
  ClosePositionRequest,
  ClosePositionResponse,
  AdjustCollateralRequest,
  AdjustCollateralResponse,
} from './types';

// RPC endpoints
const RPC_ENDPOINTS: Record<NetworkType, string> = {
  'mainnet-beta': process.env.MAINNET_RPC_URL || 'https://api.mainnet-beta.solana.com',
  'devnet': process.env.DEVNET_RPC_URL || 'https://api.devnet.solana.com',
};

export class PositionOpeningService {
  private network: NetworkType;
  private connection: Connection;

  constructor(network: NetworkType = 'mainnet-beta') {
    this.network = network;
    this.connection = new Connection(RPC_ENDPOINTS[network], 'confirmed');
  }

  /**
   * Build transaction to open a position on Drift
   */
  private async buildDriftOpenTx(request: OpenPositionRequest): Promise<string> {
    logger.info('Building Drift open position transaction', { request });
    
    // In production, use @drift-labs/sdk to build the actual transaction
    // For now, return a mock transaction placeholder
    
    const tx = new Transaction();
    tx.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
    tx.feePayer = new PublicKey(request.walletAddress);
    
    // Add memo instruction as placeholder
    tx.add(
      SystemProgram.transfer({
        fromPubkey: new PublicKey(request.walletAddress),
        toPubkey: new PublicKey(request.walletAddress),
        lamports: 0,
      })
    );

    return tx.serialize({ requireAllSignatures: false }).toString('base64');
  }

  /**
   * Build transaction to open a position on MarginFi
   */
  private async buildMarginFiOpenTx(request: OpenPositionRequest): Promise<string> {
    logger.info('Building MarginFi open position transaction', { request });
    
    const tx = new Transaction();
    tx.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
    tx.feePayer = new PublicKey(request.walletAddress);
    
    tx.add(
      SystemProgram.transfer({
        fromPubkey: new PublicKey(request.walletAddress),
        toPubkey: new PublicKey(request.walletAddress),
        lamports: 0,
      })
    );

    return tx.serialize({ requireAllSignatures: false }).toString('base64');
  }

  /**
   * Build transaction to open a position on Solend
   */
  private async buildSolendOpenTx(request: OpenPositionRequest): Promise<string> {
    logger.info('Building Solend open position transaction', { request });
    
    const tx = new Transaction();
    tx.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
    tx.feePayer = new PublicKey(request.walletAddress);
    
    tx.add(
      SystemProgram.transfer({
        fromPubkey: new PublicKey(request.walletAddress),
        toPubkey: new PublicKey(request.walletAddress),
        lamports: 0,
      })
    );

    return tx.serialize({ requireAllSignatures: false }).toString('base64');
  }


  /**
   * Open a leveraged position
   */
  async openPosition(request: OpenPositionRequest): Promise<OpenPositionResponse> {
    logger.info('Opening position', { request });

    try {
      // Get quote for position metrics
      const quoteService = getQuoteService(request.network);
      const quote = await quoteService.getPositionQuote({
        walletAddress: request.walletAddress,
        collateralToken: request.collateralToken,
        collateralAmount: request.collateralAmount,
        borrowToken: request.borrowToken,
        leverage: request.leverage,
        network: request.network,
        protocol: request.protocol,
      });

      const protocolQuote = quote.quotes.find(q => q.protocol === request.protocol);
      if (!protocolQuote) {
        return {
          success: false,
          estimatedFees: { protocolFee: 0, networkFee: 0, total: 0 },
          error: `Protocol ${request.protocol} not available for this token pair`,
        };
      }

      // Build protocol-specific transaction
      let transaction: string;
      switch (request.protocol) {
        case 'DRIFT':
          transaction = await this.buildDriftOpenTx(request);
          break;
        case 'MARGINFI':
          transaction = await this.buildMarginFiOpenTx(request);
          break;
        case 'SOLEND':
          transaction = await this.buildSolendOpenTx(request);
          break;
        default:
          return {
            success: false,
            estimatedFees: { protocolFee: 0, networkFee: 0, total: 0 },
            error: `Unknown protocol: ${request.protocol}`,
          };
      }

      // Create position record in database
      const position = await prisma.position.create({
        data: {
          walletAddress: request.walletAddress,
          protocol: request.protocol,
          network: this.network === 'mainnet-beta' ? 'MAINNET' : 'DEVNET',
          status: 'OPEN',
          collateralToken: request.collateralToken,
          collateralMint: request.collateralMint,
          collateralAmount: request.collateralAmount,
          borrowToken: request.borrowToken,
          borrowMint: request.borrowMint,
          borrowAmount: request.borrowAmount,
          leverage: request.leverage,
          entryPrice: quote.currentPrices.collateral,
          liquidationPrice: protocolQuote.liquidationPrice,
          openHealthFactor: protocolQuote.healthFactor,
        },
      });

      // Auto-add to monitoring if requested
      if (request.autoMonitor) {
        await this.addToMonitoring(request.walletAddress, request.protocol);
      }

      const warnings: string[] = [];
      if (protocolQuote.healthFactor < 1.5) {
        warnings.push('Position health factor is low. Consider using less leverage.');
      }
      if (request.leverage > 5) {
        warnings.push('High leverage increases liquidation risk significantly.');
      }

      return {
        success: true,
        transaction,
        positionId: position.id,
        estimatedFees: protocolQuote.estimatedFees,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      logger.error('Error opening position', { error, request });
      return {
        success: false,
        estimatedFees: { protocolFee: 0, networkFee: 0, total: 0 },
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Add wallet to monitoring system
   */
  private async addToMonitoring(walletAddress: string, protocol: ProtocolName): Promise<void> {
    try {
      // Check if already monitored
      const existing = await prisma.monitoredAccount.findUnique({
        where: { walletAddress },
      });

      if (!existing) {
        await prisma.monitoredAccount.create({
          data: {
            walletAddress,
            protocol,
            isActive: true,
          },
        });
        logger.info('Added wallet to monitoring', { walletAddress, protocol });
      }
    } catch (error) {
      logger.error('Error adding to monitoring', { error, walletAddress });
    }
  }

  /**
   * Close a position
   */
  async closePosition(request: ClosePositionRequest): Promise<ClosePositionResponse> {
    logger.info('Closing position', { request });

    try {
      const position = await prisma.position.findUnique({
        where: { id: request.positionId },
      });

      if (!position) {
        return {
          success: false,
          estimatedReturn: 0,
          realizedPnl: 0,
          error: 'Position not found',
        };
      }

      if (position.walletAddress !== request.walletAddress) {
        return {
          success: false,
          estimatedReturn: 0,
          realizedPnl: 0,
          error: 'Unauthorized',
        };
      }

      // Build close transaction (placeholder)
      const tx = new Transaction();
      tx.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
      tx.feePayer = new PublicKey(request.walletAddress);
      
      tx.add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(request.walletAddress),
          toPubkey: new PublicKey(request.walletAddress),
          lamports: 0,
        })
      );

      const transaction = tx.serialize({ requireAllSignatures: false }).toString('base64');

      // Calculate P&L (mock)
      const currentValue = position.currentValue || position.collateralAmount * position.entryPrice;
      const openValue = position.collateralAmount * position.entryPrice;
      const realizedPnl = currentValue - openValue;

      return {
        success: true,
        transaction,
        estimatedReturn: currentValue,
        realizedPnl,
      };
    } catch (error) {
      logger.error('Error closing position', { error, request });
      return {
        success: false,
        estimatedReturn: 0,
        realizedPnl: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Adjust collateral on a position
   */
  async adjustCollateral(request: AdjustCollateralRequest): Promise<AdjustCollateralResponse> {
    logger.info('Adjusting collateral', { request });

    try {
      const position = await prisma.position.findUnique({
        where: { id: request.positionId },
      });

      if (!position) {
        return {
          success: false,
          newHealthFactor: 0,
          newLiquidationPrice: 0,
          error: 'Position not found',
        };
      }

      // Build adjust transaction (placeholder)
      const tx = new Transaction();
      tx.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
      tx.feePayer = new PublicKey(request.walletAddress);
      
      tx.add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(request.walletAddress),
          toPubkey: new PublicKey(request.walletAddress),
          lamports: 0,
        })
      );

      const transaction = tx.serialize({ requireAllSignatures: false }).toString('base64');

      // Calculate new metrics
      const newCollateralAmount = request.action === 'add'
        ? position.collateralAmount + request.amount
        : position.collateralAmount - request.amount;

      const quoteService = getQuoteService(this.network);
      const collateralPrice = await quoteService.getTokenPrice(position.collateralToken);
      const borrowPrice = await quoteService.getTokenPrice(position.borrowToken);

      const newCollateralValue = newCollateralAmount * collateralPrice.price;
      const borrowValue = position.borrowAmount * borrowPrice.price;

      // Assume 85% liquidation threshold
      const newHealthFactor = (newCollateralValue * 0.85) / borrowValue;
      const newLiquidationPrice = borrowValue / (newCollateralAmount * 0.85);

      return {
        success: true,
        transaction,
        newHealthFactor,
        newLiquidationPrice,
      };
    } catch (error) {
      logger.error('Error adjusting collateral', { error, request });
      return {
        success: false,
        newHealthFactor: 0,
        newLiquidationPrice: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Singleton instances per network
const openingServices: Map<NetworkType, PositionOpeningService> = new Map();

export function getPositionOpeningService(network: NetworkType = 'mainnet-beta'): PositionOpeningService {
  if (!openingServices.has(network)) {
    openingServices.set(network, new PositionOpeningService(network));
  }
  return openingServices.get(network)!;
}

export function createPositionOpeningService(network: NetworkType = 'mainnet-beta'): PositionOpeningService {
  return new PositionOpeningService(network);
}
