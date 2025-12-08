/**
 * WebSocket Handler
 * Real-time updates using Socket.io
 */

import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { logger } from '../../utils/logger';

// Event types
export type WebSocketEvent =
  | 'account:update'
  | 'alert:new'
  | 'alert:resolved'
  | 'protection:started'
  | 'protection:completed'
  | 'stats:update'
  | 'price:update'
  | 'hvix:update';

// Event payloads
export interface AccountUpdatePayload {
  walletAddress: string;
  healthFactor: number;
  riskScore: number;
  leverage: number;
  timestamp: number;
}

export interface AlertPayload {
  id: string;
  walletAddress: string;
  severity: string;
  message: string;
  riskScore: number;
  timestamp: number;
}

export interface ProtectionPayload {
  id: string;
  walletAddress: string;
  status: string;
  inputMint: string;
  outputMint: string;
  amount: string;
  mevSaved?: number;
  timestamp: number;
}

export interface StatsPayload {
  totalAccounts: number;
  activeAlerts: number;
  atRiskAccounts: number;
  totalMevSaved: number;
  timestamp: number;
}

export interface PricePayload {
  token: string;
  price: number;
  change24h?: number;
  timestamp: number;
}

export class WebSocketHandler {
  private io: Server;
  private connectedClients: Map<string, Socket> = new Map();

  constructor(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || '*',
        methods: ['GET', 'POST'],
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.setupConnectionHandlers();
    logger.info('WebSocket Handler initialized');
  }

  /**
   * Setup connection handlers
   */
  private setupConnectionHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      const clientId = socket.id;
      this.connectedClients.set(clientId, socket);

      logger.info(`WebSocket client connected: ${clientId}`);

      // Handle room subscriptions
      socket.on('subscribe:account', (walletAddress: string) => {
        socket.join(`account:${walletAddress}`);
        logger.debug(`Client ${clientId} subscribed to account: ${walletAddress}`);
      });

      socket.on('unsubscribe:account', (walletAddress: string) => {
        socket.leave(`account:${walletAddress}`);
        logger.debug(`Client ${clientId} unsubscribed from account: ${walletAddress}`);
      });

      socket.on('subscribe:alerts', () => {
        socket.join('alerts');
        logger.debug(`Client ${clientId} subscribed to alerts`);
      });

      socket.on('unsubscribe:alerts', () => {
        socket.leave('alerts');
        logger.debug(`Client ${clientId} unsubscribed from alerts`);
      });

      socket.on('subscribe:stats', () => {
        socket.join('stats');
        logger.debug(`Client ${clientId} subscribed to stats`);
      });

      socket.on('subscribe:prices', () => {
        socket.join('prices');
        logger.debug(`Client ${clientId} subscribed to prices`);
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        this.connectedClients.delete(clientId);
        logger.info(`WebSocket client disconnected: ${clientId} (${reason})`);
      });

      // Handle errors
      socket.on('error', (error) => {
        logger.error(`WebSocket error for client ${clientId}:`, error);
      });

      // Send welcome message
      socket.emit('connected', {
        clientId,
        timestamp: Date.now(),
        message: 'Connected to Liquidation Shield',
      });
    });
  }

  /**
   * Emit account update
   */
  emitAccountUpdate(payload: AccountUpdatePayload): void {
    // Emit to specific account room
    this.io.to(`account:${payload.walletAddress}`).emit('account:update', payload);
    
    // Also emit to general updates
    this.io.emit('account:update', payload);
  }

  /**
   * Emit new alert
   */
  emitNewAlert(payload: AlertPayload): void {
    this.io.to('alerts').emit('alert:new', payload);
    this.io.to(`account:${payload.walletAddress}`).emit('alert:new', payload);
  }

  /**
   * Emit alert resolved
   */
  emitAlertResolved(payload: AlertPayload): void {
    this.io.to('alerts').emit('alert:resolved', payload);
    this.io.to(`account:${payload.walletAddress}`).emit('alert:resolved', payload);
  }

  /**
   * Emit protection started
   */
  emitProtectionStarted(payload: ProtectionPayload): void {
    this.io.to(`account:${payload.walletAddress}`).emit('protection:started', payload);
  }

  /**
   * Emit protection completed
   */
  emitProtectionCompleted(payload: ProtectionPayload): void {
    this.io.to(`account:${payload.walletAddress}`).emit('protection:completed', payload);
    this.io.to('stats').emit('protection:completed', payload);
  }

  /**
   * Emit stats update
   */
  emitStatsUpdate(payload: StatsPayload): void {
    this.io.to('stats').emit('stats:update', payload);
  }

  /**
   * Emit price update
   */
  emitPriceUpdate(payload: PricePayload): void {
    this.io.to('prices').emit('price:update', payload);
  }

  /**
   * Emit HVIX update
   */
  emitHvixUpdate(value: number, level: string): void {
    this.io.emit('hvix:update', {
      value,
      level,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast to all clients
   */
  broadcast(event: WebSocketEvent, payload: any): void {
    this.io.emit(event, payload);
  }

  /**
   * Send to specific client
   */
  sendToClient(clientId: string, event: WebSocketEvent, payload: any): void {
    const socket = this.connectedClients.get(clientId);
    if (socket) {
      socket.emit(event, payload);
    }
  }

  /**
   * Get connected client count
   */
  getConnectedCount(): number {
    return this.connectedClients.size;
  }

  /**
   * Get Socket.io server instance
   */
  getServer(): Server {
    return this.io;
  }

  /**
   * Close all connections
   */
  close(): void {
    this.io.close();
    this.connectedClients.clear();
    logger.info('WebSocket server closed');
  }
}

export default WebSocketHandler;
