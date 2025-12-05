import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { logger } from './utils/logger';
import { config } from './config';

// Import routes (will be created later)
// import accountsRouter from './api/routes/accounts';
// import alertsRouter from './api/routes/alerts';
// import protectionRouter from './api/routes/protection';
// import statsRouter from './api/routes/stats';
// import healthRouter from './api/routes/health';

// Import orchestrator (will be created later)
// import { Orchestrator } from './services/orchestrator';

const app = express();
const httpServer = createServer(app);

// Socket.IO setup
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: config.corsOrigin,
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

// Health check endpoint (basic)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    network: config.network,
  });
});

// Routes
import testRouter from './api/routes/test';
app.use('/api/test', testRouter);

// Other routes will be mounted here
// app.use('/api/accounts', accountsRouter);
// app.use('/api/alerts', alertsRouter);
// app.use('/api/protection', protectionRouter);
// app.use('/api/stats', statsRouter);

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  socket.on('subscribe:account', (walletAddress: string) => {
    socket.join(`account:${walletAddress}`);
    logger.debug(`Client ${socket.id} subscribed to account: ${walletAddress}`);
  });

  socket.on('subscribe:alerts', () => {
    socket.join('alerts');
    logger.debug(`Client ${socket.id} subscribed to alerts`);
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Export io for use in other modules
export { io };

// Start server
async function main() {
  try {
    logger.info('🚀 Starting Liquidation Shield Backend...');
    logger.info(`   Network: ${config.network}`);
    logger.info(`   Port: ${config.port}`);

    // Initialize orchestrator (will be implemented later)
    // const orchestrator = new Orchestrator(io);
    // await orchestrator.start();

    httpServer.listen(config.port, () => {
      logger.info(`✅ Server running on port ${config.port}`);
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down...');
      // await orchestrator.shutdown();
      httpServer.close();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
