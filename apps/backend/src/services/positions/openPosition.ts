/**
 * Position Opening Service
 * Builds transactions for opening leveraged positions on each protocol
 */

import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { 
  DriftClient, 
  BN,
  IWallet,
  getUserAccountPublicKeySync,
} from '@drift-labs/sdk';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
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

// Drift spot market indices (same as in drift.ts)
const DRIFT_SPOT_MARKETS: Record<string, number> = {
  'USDC': 0,
  'SOL': 1,
  'mSOL': 2,
  'USDT': 5,
  'jitoSOL': 6,
  'PYTH': 7,
  'bSOL': 8,
  'JTO': 9,
  'WIF': 10,
  'JUP': 11,
};

export class PositionOpeningService {
  private network: NetworkType;
  private connection: Connection;

  constructor(network: NetworkType = 'mainnet-beta') {
    this.network = network;
    this.connection = new Connection(RPC_ENDPOINTS[network], 'confirmed');
  }

  /**
   * Check if a Drift user account exists
   */
  private async checkDriftUserAccountExists(
    programId: PublicKey,
    walletPubkey: PublicKey,
    subAccountId: number = 0
  ): Promise<boolean> {
    try {
      const userAccountPublicKey = getUserAccountPublicKeySync(programId, walletPubkey, subAccountId);
      const accountInfo = await this.connection.getAccountInfo(userAccountPublicKey);
      return accountInfo !== null;
    } catch (error) {
      logger.debug('Error checking Drift user account', { error });
      return false;
    }
  }

  /**
   * Build transaction to open a position on Drift
   * 
   * Steps:
   * 0. Initialize Drift account if needed (first time users)
   * 1. Deposit collateral into Drift
   * 2. Borrow the desired token (withdraw with borrow flag)
   */
  private async buildDriftOpenTx(request: OpenPositionRequest): Promise<string> {
    logger.info('Building Drift open position transaction', { request });
    
    try {
      // Get market indices
      const collateralMarketIndex = DRIFT_SPOT_MARKETS[request.collateralToken.toUpperCase()];
      const borrowMarketIndex = DRIFT_SPOT_MARKETS[request.borrowToken.toUpperCase()];
      
      if (collateralMarketIndex === undefined || borrowMarketIndex === undefined) {
        throw new Error(`Unsupported token pair: ${request.collateralToken}/${request.borrowToken}`);
      }

      // Create a dummy wallet for transaction building (no private key needed)
      const walletPubkey = new PublicKey(request.walletAddress);
      const dummyWallet: IWallet = {
        publicKey: walletPubkey,
        signTransaction: async (tx) => tx,
        signAllTransactions: async (txs) => txs,
      };

      // Initialize Drift client
      // Include both collateral and borrow spot market indexes to ensure they're loaded
      const driftClient = new DriftClient({
        connection: this.connection,
        wallet: dummyWallet,
        env: this.network === 'mainnet-beta' ? 'mainnet-beta' : 'devnet',
        // Explicitly include the spot markets we need for this transaction
        spotMarketIndexes: [collateralMarketIndex, borrowMarketIndex, 0], // Include USDC (0) as quote
      });

      await driftClient.subscribe();
      
      // Wait for accounts to load
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Log loaded spot markets for debugging
      const spotMarkets = driftClient.getSpotMarketAccounts();
      logger.info('Loaded spot markets', {
        count: spotMarkets.length,
        indices: spotMarkets.map(m => m.marketIndex),
      });
      
      // Add the collateral market to mustIncludeSpotMarketIndexes so it's included in remaining accounts
      // This is critical for margin calculation when borrowing
      driftClient.mustIncludeSpotMarketIndexes.add(collateralMarketIndex);
      driftClient.mustIncludeSpotMarketIndexes.add(borrowMarketIndex);
      
      logger.info('Added spot markets to mustInclude', {
        collateralMarketIndex,
        borrowMarketIndex,
      });

      try {
        // Build transaction
        const tx = new Transaction();
        tx.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
        tx.feePayer = walletPubkey;

        // Check if user has a Drift account, if not, initialize it
        const userAccountExists = await this.checkDriftUserAccountExists(
          driftClient.program.programId,
          walletPubkey
        );
        
        let isNewAccount = false;
        
        if (!userAccountExists) {
          logger.info('Drift user account does not exist, adding initialization instructions', {
            wallet: request.walletAddress,
          });
          
          // Get initialization instructions
          const [initIxs, userAccountPubkey] = await driftClient.getInitializeUserAccountIxs(
            0, // subAccountId
            'Sentinel User', // name
            undefined, // referrerInfo
          );
          
          // Add initialization instructions to transaction
          initIxs.forEach(ix => tx.add(ix));
          
          logger.info('Added Drift account initialization instructions', {
            userAccountPubkey: userAccountPubkey.toString(),
            instructionCount: initIxs.length,
          });
          
          isNewAccount = true;
        } else {
          // User account exists - add it to the client so we can build deposit instructions
          try {
            await driftClient.addUser(0, walletPubkey);
            logger.info('Added existing user to DriftClient', { wallet: request.walletAddress });
          } catch (e: any) {
            logger.error('Failed to add user to DriftClient', { error: e?.message || e });
            throw new Error(`Failed to load Drift user account. Please try again.`);
          }
        }

        // Get token decimals (SOL = 9, USDC = 6, etc.)
        const collateralDecimals = this.getTokenDecimals(request.collateralToken);
        const borrowDecimals = this.getTokenDecimals(request.borrowToken);

        // Convert amounts to native token precision
        const collateralAmount = new BN(request.collateralAmount * Math.pow(10, collateralDecimals));
        const borrowAmount = new BN(request.borrowAmount * Math.pow(10, borrowDecimals));

        // Step 1: Deposit collateral
        // For native SOL, we need to use Drift's native SOL deposit method
        // which handles creating a temporary wSOL account
        
        if (request.collateralToken.toUpperCase() === 'SOL') {
          // Use Drift's deposit transaction builder which handles SOL wrapping
          // getDepositTxnIx(amount, marketIndex, associatedTokenAccount, subAccountId?, reduceOnly?)
          const depositIxs = await driftClient.getDepositTxnIx(
            collateralAmount,
            collateralMarketIndex,
            walletPubkey // For SOL, this is the wallet that will wrap SOL
          );
          
          // Add all deposit instructions (includes SOL wrapping if needed)
          if (Array.isArray(depositIxs)) {
            depositIxs.forEach((ix: any) => tx.add(ix));
          } else if (depositIxs) {
            tx.add(depositIxs);
          }
          
          logger.info('Added SOL deposit instructions', {
            amount: request.collateralAmount,
            isNewAccount,
          });
        } else {
          // For SPL tokens, use the standard deposit instruction
          // Get the user's associated token account for the collateral
          const collateralMint = new PublicKey(request.collateralMint);
          const userTokenAccount = await getAssociatedTokenAddress(
            collateralMint,
            walletPubkey
          );
          
          const depositIx = await driftClient.getDepositInstruction(
            collateralAmount,
            collateralMarketIndex,
            userTokenAccount,
            0, // subAccountId
            false, // reduceOnly
            !isNewAccount // userInitialized - false for new accounts
          );
          tx.add(depositIx);
        }

        // Step 2: Borrow tokens (withdraw with reduceOnly = false means borrow)
        // For new accounts, we can only do init + deposit in the first tx
        // Borrow requires the account to exist on-chain first
        if (isNewAccount) {
          logger.info('New Drift account - init + deposit only. User needs to submit another tx to borrow after this one confirms.', {
            wallet: request.walletAddress,
          });
        } else if (borrowAmount.gt(new BN(0))) {
          // Existing account - can add borrow instruction
          // Get the associated token account for the borrow token using Drift's method
          const userBorrowTokenAccount = await driftClient.getAssociatedTokenAccount(
            borrowMarketIndex,
            true, // useNative - for SOL this returns wallet pubkey
            TOKEN_PROGRAM_ID,
            walletPubkey
          );
          
          // Check if the user's borrow token account exists, if not create it
          // Skip this for native SOL (USDC is not native)
          const borrowMint = new PublicKey(request.borrowMint);
          if (!borrowMint.equals(new PublicKey('So11111111111111111111111111111111111111112'))) {
            const borrowTokenAccountInfo = await this.connection.getAccountInfo(userBorrowTokenAccount);
            if (!borrowTokenAccountInfo) {
              logger.info('Creating associated token account for borrow token', {
                mint: request.borrowMint,
                ata: userBorrowTokenAccount.toString(),
              });
              
              const createAtaIx = createAssociatedTokenAccountInstruction(
                walletPubkey, // payer
                userBorrowTokenAccount, // ata
                walletPubkey, // owner
                borrowMint // mint
              );
              tx.add(createAtaIx);
            }
          }
          
          // Build withdraw/borrow instruction
          logger.info('Building withdraw/borrow instruction', {
            amount: request.borrowAmount,
            marketIndex: borrowMarketIndex,
            tokenAccount: userBorrowTokenAccount.toString(),
            collateralMarketIndex,
          });
          
          // Get the user object
          const user = driftClient.getUser(0, walletPubkey);
          
          // Log user state for debugging
          const userAccount = user.getUserAccount();
          logger.info('User account state before borrow', {
            authority: userAccount.authority.toString(),
            subAccountId: userAccount.subAccountId,
            spotPositions: userAccount.spotPositions.filter(p => !p.scaledBalance.isZero()).map(p => ({
              marketIndex: p.marketIndex,
              scaledBalance: p.scaledBalance.toString(),
            })),
          });
          
          // Build withdraw instruction
          const borrowIx = await driftClient.getWithdrawIx(
            borrowAmount,
            borrowMarketIndex,
            userBorrowTokenAccount,
            false, // reduceOnly = false allows borrowing
            0 // subAccountId
          );
          
          // Log the instruction accounts for debugging
          logger.info('Withdraw instruction built', {
            programId: borrowIx.programId.toString(),
            accountCount: borrowIx.keys.length,
          });
          
          tx.add(borrowIx);
          
          logger.info('Added borrow instruction', {
            amount: request.borrowAmount,
            token: request.borrowToken,
            tokenAccount: userBorrowTokenAccount.toString(),
          });
        }

        await driftClient.unsubscribe();

        return tx.serialize({ requireAllSignatures: false }).toString('base64');
      } finally {
        await driftClient.unsubscribe();
      }
    } catch (error: any) {
      logger.error('Error building Drift transaction', { 
        errorMessage: error?.message || String(error),
        errorStack: error?.stack,
        errorName: error?.name,
        request 
      });
      throw error;
    }
  }

  /**
   * Get token decimals for precision conversion
   */
  private getTokenDecimals(token: string): number {
    const decimalsMap: Record<string, number> = {
      'SOL': 9,
      'USDC': 6,
      'USDT': 6,
      'mSOL': 9,
      'jitoSOL': 9,
      'bSOL': 9,
      'PYTH': 6,
      'JTO': 9,
      'WIF': 6,
      'JUP': 6,
    };
    return decimalsMap[token.toUpperCase()] || 9; // Default to 9 decimals
  }

  /**
   * Build transaction to close a position on Drift
   * 
   * Steps:
   * 1. Fetch actual current borrow/collateral amounts from Drift (includes interest)
   * 2. Repay borrowed tokens (deposit to reduce borrow)
   * 3. Withdraw collateral
   */
  private async buildDriftCloseTx(
    walletAddress: string,
    collateralToken: string,
    collateralAmount: number,
    borrowToken: string,
    borrowAmount: number
  ): Promise<string> {
    logger.info('Building Drift close position transaction', {
      walletAddress,
      collateralToken,
      borrowToken,
      storedCollateral: collateralAmount,
      storedBorrow: borrowAmount,
    });

    try {
      const collateralMarketIndex = DRIFT_SPOT_MARKETS[collateralToken.toUpperCase()];
      const borrowMarketIndex = DRIFT_SPOT_MARKETS[borrowToken.toUpperCase()];

      if (collateralMarketIndex === undefined || borrowMarketIndex === undefined) {
        throw new Error(`Unsupported token pair: ${collateralToken}/${borrowToken}`);
      }

      const walletPubkey = new PublicKey(walletAddress);
      const dummyWallet: IWallet = {
        publicKey: walletPubkey,
        signTransaction: async (tx) => tx,
        signAllTransactions: async (txs) => txs,
      };

      const driftClient = new DriftClient({
        connection: this.connection,
        wallet: dummyWallet,
        env: this.network === 'mainnet-beta' ? 'mainnet-beta' : 'devnet',
        spotMarketIndexes: [collateralMarketIndex, borrowMarketIndex, 0],
      });

      await driftClient.subscribe();
      
      // Wait for accounts to load
      await new Promise(resolve => setTimeout(resolve, 1000));

      try {
        // Add user to drift client
        await driftClient.addUser(0, walletPubkey);
        const user = driftClient.getUser(0, walletPubkey);
        
        // Fetch ACTUAL current amounts from Drift (includes accrued interest)
        let actualBorrowAmount = borrowAmount;
        let actualCollateralAmount = collateralAmount;
        
        try {
          const spotPositions = user.getUserAccount().spotPositions;
          
          for (const pos of spotPositions) {
            if (pos.marketIndex === borrowMarketIndex && pos.scaledBalance.toNumber() !== 0) {
              // Get actual token amount (negative = borrow)
              const tokenAmount = user.getTokenAmount(borrowMarketIndex);
              if (tokenAmount.lt(new BN(0))) {
                // It's a borrow - get absolute value
                actualBorrowAmount = Math.abs(tokenAmount.toNumber()) / Math.pow(10, this.getTokenDecimals(borrowToken));
                logger.info('Fetched actual borrow amount from Drift', {
                  stored: borrowAmount,
                  actual: actualBorrowAmount,
                  difference: actualBorrowAmount - borrowAmount,
                });
              }
            }
            if (pos.marketIndex === collateralMarketIndex && pos.scaledBalance.toNumber() !== 0) {
              const tokenAmount = user.getTokenAmount(collateralMarketIndex);
              if (tokenAmount.gt(new BN(0))) {
                actualCollateralAmount = tokenAmount.toNumber() / Math.pow(10, this.getTokenDecimals(collateralToken));
                logger.info('Fetched actual collateral amount from Drift', {
                  stored: collateralAmount,
                  actual: actualCollateralAmount,
                });
              }
            }
          }
        } catch (fetchError) {
          logger.warn('Could not fetch actual amounts from Drift, using stored values', { fetchError });
        }
        
        const tx = new Transaction();
        tx.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
        tx.feePayer = walletPubkey;

        // Get token decimals
        const borrowDecimals = this.getTokenDecimals(borrowToken);
        const collateralDecimals = this.getTokenDecimals(collateralToken);

        // Step 1: Repay the USDC borrow
        // Get the user's USDC associated token account
        const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
        const userUsdcAta = await getAssociatedTokenAddress(
          USDC_MINT,
          walletPubkey
        );
        
        // Check user's actual USDC balance
        let userUsdcBalance = 0;
        try {
          const ataInfo = await this.connection.getTokenAccountBalance(userUsdcAta);
          userUsdcBalance = parseFloat(ataInfo.value.amount) / Math.pow(10, borrowDecimals);
          logger.info('User USDC balance', { balance: userUsdcBalance, ata: userUsdcAta.toString() });
        } catch (e) {
          logger.warn('Could not fetch USDC balance, assuming 0');
        }
        
        // To close a position, we MUST fully repay the borrow first
        // Otherwise Drift won't let us withdraw collateral (InsufficientCollateral error)
        if (userUsdcBalance < actualBorrowAmount) {
          const shortfall = actualBorrowAmount - userUsdcBalance;
          logger.warn('Insufficient USDC to fully repay borrow', {
            needed: actualBorrowAmount,
            available: userUsdcBalance,
            shortfall,
          });
          throw new Error(
            `Cannot close position: You need ${actualBorrowAmount.toFixed(4)} USDC to repay your debt, ` +
            `but only have ${userUsdcBalance.toFixed(4)} USDC. ` +
            `Please acquire ${shortfall.toFixed(4)} more USDC (swap ~$${(shortfall * 1.01).toFixed(2)} worth of SOL on Jupiter).`
          );
        }
        
        // Repay the exact borrow amount (use floor to avoid rounding issues)
        const borrowAmountBN = new BN(Math.floor(actualBorrowAmount * Math.pow(10, borrowDecimals)));
        const collateralAmountBN = new BN(Math.floor(actualCollateralAmount * Math.pow(10, collateralDecimals)));
        
        logger.info('Repaying USDC borrow', {
          storedAmount: borrowAmount,
          actualBorrowOwed: actualBorrowAmount,
          userBalance: userUsdcBalance,
          amountToRepay: actualBorrowAmount,
          marketIndex: borrowMarketIndex,
          tokenAccount: userUsdcAta.toString(),
        });

        // Deposit USDC to repay the borrow (reduceOnly = true means it only reduces borrow)
        const repayIx = await driftClient.getDepositInstruction(
          borrowAmountBN,
          borrowMarketIndex, // USDC market index (0)
          userUsdcAta,
          0, // subAccountId
          true, // reduceOnly - only repay borrow, don't add as collateral
          true // userInitialized
        );
        tx.add(repayIx);

        // Step 2: Withdraw SOL collateral
        // For native SOL, we need to use the wSOL (Wrapped SOL) associated token account
        // Native SOL mint address
        const NATIVE_SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
        
        // Get or create the user's wSOL ATA
        const userWsolAta = await getAssociatedTokenAddress(
          NATIVE_SOL_MINT,
          walletPubkey
        );
        
        // Check if wSOL ATA exists, if not we need to create it
        const wsolAtaInfo = await this.connection.getAccountInfo(userWsolAta);
        if (!wsolAtaInfo) {
          logger.info('Creating wSOL ATA for withdrawal', { ata: userWsolAta.toString() });
          const createWsolAtaIx = createAssociatedTokenAccountInstruction(
            walletPubkey, // payer
            userWsolAta, // ata
            walletPubkey, // owner
            NATIVE_SOL_MINT // mint
          );
          tx.add(createWsolAtaIx);
        }
        
        logger.info('Withdrawing SOL collateral', {
          amount: actualCollateralAmount,
          marketIndex: collateralMarketIndex,
          withdrawAccount: userWsolAta.toString(),
        });

        // Withdraw to wSOL ATA
        const withdrawIx = await driftClient.getWithdrawIx(
          collateralAmountBN,
          collateralMarketIndex, // SOL market index (1)
          userWsolAta, // Withdraw to wSOL ATA
          false, // reduceOnly = false to allow full withdrawal
          0 // subAccountId
        );
        tx.add(withdrawIx);
        
        // Close wSOL account to unwrap to native SOL
        // This sends the SOL to the wallet and closes the wSOL ATA
        const { createCloseAccountInstruction } = await import('@solana/spl-token');
        const closeWsolIx = createCloseAccountInstruction(
          userWsolAta, // account to close
          walletPubkey, // destination for remaining SOL
          walletPubkey  // owner/authority
        );
        tx.add(closeWsolIx);

        return tx.serialize({ requireAllSignatures: false }).toString('base64');
      } finally {
        // CRITICAL: Always unsubscribe to prevent memory leaks
        await driftClient.unsubscribe().catch((err) => {
          logger.error('Error unsubscribing drift client in buildDriftCloseTx:', err);
        });
      }
    } catch (error) {
      logger.error('Error building Drift close transaction', { error });
      throw error;
    }
  }

  /**
   * Build transaction to adjust collateral on Drift
   */
  private async buildDriftAdjustCollateralTx(
    walletAddress: string,
    collateralToken: string,
    amount: number,
    action: 'add' | 'remove'
  ): Promise<string> {
    logger.info('Building Drift adjust collateral transaction', {
      walletAddress,
      collateralToken,
      amount,
      action,
    });

    try {
      const marketIndex = DRIFT_SPOT_MARKETS[collateralToken.toUpperCase()];

      if (marketIndex === undefined) {
        throw new Error(`Unsupported token: ${collateralToken}`);
      }

      const walletPubkey = new PublicKey(walletAddress);
      const dummyWallet: IWallet = {
        publicKey: walletPubkey,
        signTransaction: async (tx) => tx,
        signAllTransactions: async (txs) => txs,
      };

      const driftClient = new DriftClient({
        connection: this.connection,
        wallet: dummyWallet,
        env: this.network === 'mainnet-beta' ? 'mainnet-beta' : 'devnet',
      });

      await driftClient.subscribe();

      try {
        const tx = new Transaction();
        tx.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
        tx.feePayer = walletPubkey;

        // Get token decimals
        const decimals = this.getTokenDecimals(collateralToken);
        const amountBN = new BN(amount * Math.pow(10, decimals));

        if (action === 'add') {
          // Deposit more collateral
          const depositIx = await driftClient.getDepositInstruction(
            amountBN,
            marketIndex,
            walletPubkey
          );
          tx.add(depositIx);
        } else {
          // Withdraw collateral
          const withdrawIx = await driftClient.getWithdrawIx(
            amountBN,
            marketIndex,
            walletPubkey,
            false // reduceOnly = false
          );
          tx.add(withdrawIx);
        }

        return tx.serialize({ requireAllSignatures: false }).toString('base64');
      } finally {
        // CRITICAL: Always unsubscribe to prevent memory leaks
        await driftClient.unsubscribe().catch((err) => {
          logger.error('Error unsubscribing drift client in buildDriftAdjustCollateralTx:', err);
        });
      }
    } catch (error) {
      logger.error('Error building Drift adjust collateral transaction', { error });
      throw error;
    }
  }

  /**
   * Build transaction to open a position on Kamino
   */
  private async buildKaminoOpenTx(request: OpenPositionRequest): Promise<string> {
    logger.info('Building Kamino open position transaction', { request });
    
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
        case 'KAMINO':
        case 'SAVE':
        case 'LOOPSCALE':
          // These protocols don't have SDK integration yet
          // Return error for now
          return {
            success: false,
            estimatedFees: { protocolFee: 0, networkFee: 0, total: 0 },
            error: `${request.protocol} transaction building not yet implemented. Please use DRIFT for now.`,
          };
        default:
          return {
            success: false,
            estimatedFees: { protocolFee: 0, networkFee: 0, total: 0 },
            error: `Unknown protocol: ${request.protocol}`,
          };
      }

      // NOTE: Position record will be created by the frontend after transaction confirmation
      // This prevents orphaned records from failed transactions

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
        // Return position data for frontend to create record after confirmation
        positionData: {
          walletAddress: request.walletAddress,
          protocol: request.protocol,
          network: this.network,
          collateralToken: request.collateralToken,
          collateralMint: request.collateralMint,
          collateralAmount: request.collateralAmount,
          borrowToken: request.borrowToken,
          borrowMint: request.borrowMint,
          borrowAmount: request.borrowAmount,
          leverage: request.leverage,
          entryPrice: quote.currentPrices.collateral,
          liquidationPrice: protocolQuote.liquidationPrice,
          healthFactor: protocolQuote.healthFactor,
          autoMonitor: request.autoMonitor,
        },
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
      let monitoredAccount = await prisma.monitoredAccount.findUnique({
        where: { walletAddress },
      });

      if (!monitoredAccount) {
        monitoredAccount = await prisma.monitoredAccount.create({
          data: {
            walletAddress,
            protocol,
            isActive: true,
          },
        });
        logger.info('Added wallet to monitoring', { walletAddress, protocol });
      }

      // Create initial snapshot for the monitoring system
      // This is crucial - without an initial snapshot, the monitoring loop won't process this account
      const position = await prisma.position.findFirst({
        where: { walletAddress },
        orderBy: { openedAt: 'desc' },
      });

      if (position) {
        await prisma.accountSnapshot.create({
          data: {
            accountId: monitoredAccount.id,
            healthFactor: position.openHealthFactor || 1.5,
            collateralValue: position.collateralAmount * 100, // Rough estimate, will be updated by monitoring loop
            borrowedValue: position.borrowAmount * 100, // Rough estimate
            leverage: position.leverage,
            liquidationPrice: position.liquidationPrice,
            oraclePrice: 0, // Will be updated by monitoring loop
            maintenanceMarginRatio: 0.05,
            currentMarginRatio: position.openHealthFactor || 1.5,
            riskScore: 0, // Will be calculated by monitoring loop
            hvixValue: 0, // Will be calculated by monitoring loop
            cascadeProbability: 0,
            timeToLiquidation: 0,
          },
        });
        logger.info('Created initial snapshot for monitoring', { walletAddress });
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

      // Build protocol-specific close transaction
      let transaction: string;
      switch (position.protocol) {
        case 'DRIFT':
          // For Drift, we need to fetch the actual current position from the protocol
          // because the amounts might have changed due to interest/funding
          transaction = await this.buildDriftCloseTx(
            request.walletAddress,
            position.collateralToken,
            position.collateralAmount,
            position.borrowToken,
            position.borrowAmount
          );
          break;
        case 'KAMINO':
          // Placeholder for Kamino
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
          transaction = tx.serialize({ requireAllSignatures: false }).toString('base64');
          break;
        default:
          return {
            success: false,
            estimatedReturn: 0,
            realizedPnl: 0,
            error: `Unknown protocol: ${position.protocol}`,
          };
      }

      // Calculate P&L properly
      // For a leveraged position:
      // - You deposited X SOL as collateral
      // - You borrowed Y USDC
      // - Now you're returning the SOL and repaying the USDC (with interest)
      // P/L = (Current SOL value - Entry SOL value) - (Interest paid on borrow)
      
      const quoteService = getQuoteService(this.network);
      let currentCollateralPrice = position.entryPrice;
      
      try {
        const priceData = await quoteService.getTokenPrice(position.collateralToken);
        currentCollateralPrice = priceData.price;
      } catch (e) {
        logger.warn('Could not fetch current price, using entry price for P/L calculation');
      }
      
      // Entry value: what the collateral was worth when position opened
      const entryCollateralValue = position.collateralAmount * position.entryPrice;
      
      // Current value: what the collateral is worth now
      const currentCollateralValue = position.collateralAmount * currentCollateralPrice;
      
      // Price change P/L (before interest)
      const priceChangePnl = currentCollateralValue - entryCollateralValue;
      
      // Interest cost (approximate - actual interest is tracked by Drift)
      // For now, estimate based on position duration and typical borrow rate (~10% APY)
      const positionDurationHours = (Date.now() - new Date(position.openedAt).getTime()) / (1000 * 60 * 60);
      const annualRate = 0.10; // 10% APY estimate
      const interestCost = position.borrowAmount * (annualRate * positionDurationHours / 8760);
      
      // Realized P/L = price change - interest cost
      const realizedPnl = priceChangePnl - interestCost;
      
      // Estimated return = collateral value - remaining debt (should be ~0 after full repay)
      const estimatedReturn = currentCollateralValue;
      
      logger.info('P/L calculation', {
        entryPrice: position.entryPrice,
        currentPrice: currentCollateralPrice,
        entryValue: entryCollateralValue,
        currentValue: currentCollateralValue,
        priceChangePnl,
        interestCost,
        realizedPnl,
        positionDurationHours,
      });

      return {
        success: true,
        transaction,
        estimatedReturn,
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

      // Build protocol-specific adjust transaction
      let transaction: string;
      switch (position.protocol) {
        case 'DRIFT':
          transaction = await this.buildDriftAdjustCollateralTx(
            request.walletAddress,
            position.collateralToken,
            request.amount,
            request.action
          );
          break;
        case 'KAMINO':
          // Placeholder for Kamino
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
          transaction = tx.serialize({ requireAllSignatures: false }).toString('base64');
          break;
        default:
          return {
            success: false,
            newHealthFactor: 0,
            newLiquidationPrice: 0,
            error: `Unknown protocol: ${position.protocol}`,
          };
      }

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
