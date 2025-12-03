import { Network } from './index';

export interface NetworkConfig {
  rpcUrl: string;
  heliusGeyserUrl: string;
  jitoUrl: string;
  jitoTipAccount: string;
  jupiterUrl: string;
}

export const NETWORK_CONFIGS: Record<Network, NetworkConfig> = {
  devnet: {
    rpcUrl: 'https://api.devnet.solana.com',
    heliusGeyserUrl: 'wss://atlas-devnet.helius-rpc.com',
    jitoUrl: 'https://ny.devnet.block-engine.jito.wtf/api/v1/bundles',
    jitoTipAccount: 'FWjCWwPnwVs8EJWwFiCC3xKqVxqcLDmN2PxPt4KhbCJN',
    jupiterUrl: 'https://api.jup.ag',
  },
  mainnet: {
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    heliusGeyserUrl: 'wss://atlas-mainnet.helius-rpc.com',
    jitoUrl: 'https://ny.mainnet.block-engine.jito.wtf/api/v1/bundles',
    jitoTipAccount: 'Awsom38c6YetPn6dBW1ztRSvVF21pWifD7yvnEm3JDp',
    jupiterUrl: 'https://api.jup.ag',
  },
};

// Jito regional endpoints (mainnet only)
export const JITO_REGIONS = {
  ny: 'https://ny.mainnet.block-engine.jito.wtf',
  amsterdam: 'https://amsterdam.mainnet.block-engine.jito.wtf',
  frankfurt: 'https://frankfurt.mainnet.block-engine.jito.wtf',
  tokyo: 'https://tokyo.mainnet.block-engine.jito.wtf',
  slc: 'https://slc.mainnet.block-engine.jito.wtf',
};

export function getNetworkConfig(network: Network): NetworkConfig {
  return NETWORK_CONFIGS[network];
}
