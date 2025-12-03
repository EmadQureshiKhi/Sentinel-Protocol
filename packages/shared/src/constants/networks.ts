// ===========================================
// Network Configuration
// ===========================================

export type Network = 'devnet' | 'mainnet';

export interface NetworkConfig {
  name: string;
  rpcUrl: string;
  heliusGeyserUrl: string;
  jitoUrl: string;
  jupiterUrl: string;
  explorerUrl: string;
}

export const NETWORKS: Record<Network, NetworkConfig> = {
  devnet: {
    name: 'Devnet',
    rpcUrl: 'https://api.devnet.solana.com',
    heliusGeyserUrl: 'wss://atlas-devnet.helius-rpc.com',
    jitoUrl: 'https://ny.devnet.block-engine.jito.wtf/api/v1/bundles',
    jupiterUrl: 'https://api.jup.ag',
    explorerUrl: 'https://explorer.solana.com',
  },
  mainnet: {
    name: 'Mainnet',
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    heliusGeyserUrl: 'wss://atlas-mainnet.helius-rpc.com',
    jitoUrl: 'https://ny.mainnet.block-engine.jito.wtf/api/v1/bundles',
    jupiterUrl: 'https://api.jup.ag',
    explorerUrl: 'https://explorer.solana.com',
  },
};

export function getExplorerUrl(
  signature: string,
  network: Network = 'devnet'
): string {
  const baseUrl = NETWORKS[network].explorerUrl;
  const cluster = network === 'devnet' ? '?cluster=devnet' : '';
  return `${baseUrl}/tx/${signature}${cluster}`;
}

export function getAccountExplorerUrl(
  address: string,
  network: Network = 'devnet'
): string {
  const baseUrl = NETWORKS[network].explorerUrl;
  const cluster = network === 'devnet' ? '?cluster=devnet' : '';
  return `${baseUrl}/address/${address}${cluster}`;
}
