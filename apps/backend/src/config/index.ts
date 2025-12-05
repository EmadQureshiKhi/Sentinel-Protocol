import dotenv from 'dotenv';
dotenv.config();

export type Network = 'devnet' | 'mainnet';

export interface Config {
  // Network
  network: Network;

  // Solana RPC
  solanaRpcUrl: string;

  // Helius Geyser
  heliusApiKey: string;
  heliusGeyserUrl: string;

  // Wallet
  walletPrivateKey: number[];

  // Jito
  jitoBundleUrl: string;

  // Jupiter
  jupiterApiUrl: string;
  jupiterApiKey: string;

  // Database
  databaseUrl: string;

  // Redis
  redisUrl: string;

  // Server
  port: number;
  corsOrigin: string;
}

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function parsePrivateKey(keyString: string): number[] {
  try {
    return JSON.parse(keyString);
  } catch {
    throw new Error('Invalid WALLET_PRIVATE_KEY format. Expected JSON array.');
  }
}

export const config: Config = {
  network: (process.env.NETWORK || 'devnet') as Network,

  solanaRpcUrl: getEnvVar('SOLANA_RPC_URL', 'https://api.devnet.solana.com'),

  heliusApiKey: getEnvVar('HELIUS_API_KEY', ''),
  heliusGeyserUrl: getEnvVar('HELIUS_GEYSER_URL', 'wss://atlas-devnet.helius-rpc.com'),

  walletPrivateKey: process.env.WALLET_PRIVATE_KEY 
    ? parsePrivateKey(process.env.WALLET_PRIVATE_KEY)
    : [],

  // Jito only works on mainnet - no devnet/testnet support
  jitoBundleUrl: getEnvVar(
    'JITO_BUNDLE_URL',
    'https://mainnet.block-engine.jito.wtf/api/v1/bundles'
  ),

  jupiterApiUrl: getEnvVar('JUPITER_API_URL', 'https://api.jup.ag'),
  jupiterApiKey: process.env.JUPITER_API_KEY || '',

  databaseUrl: getEnvVar(
    'DATABASE_URL',
    'postgresql://postgres:postgres@localhost:5432/liquidation_shield'
  ),

  redisUrl: getEnvVar('REDIS_URL', 'redis://localhost:6379'),

  port: parseInt(process.env.PORT || '3001', 10),
  corsOrigin: getEnvVar('CORS_ORIGIN', 'http://localhost:5173'),
};

export default config;
