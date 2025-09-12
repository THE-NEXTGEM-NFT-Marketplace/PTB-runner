// Sui Client Configuration and Utilities
import { SuiClient, getFullnodeUrl } from '@mysten/sui';

export type NetworkType = 'mainnet' | 'testnet' | 'devnet';

// Network configuration
export const NETWORK_CONFIG = {
  mainnet: {
    rpcUrl: getFullnodeUrl('mainnet'),
    explorerUrl: 'https://suiexplorer.com',
  },
  testnet: {
    rpcUrl: getFullnodeUrl('testnet'),
    explorerUrl: 'https://suiexplorer.com',
  },
  devnet: {
    rpcUrl: getFullnodeUrl('devnet'),
    explorerUrl: 'https://suiexplorer.com',
  }
};

// Create network-aware Sui client
let currentClient: SuiClient;
let currentNetworkType: NetworkType = 'mainnet'; // Default to mainnet

function createSuiClient(network: NetworkType): SuiClient {
  return new SuiClient({
    url: NETWORK_CONFIG[network].rpcUrl,
  });
}

// Initialize with mainnet
currentClient = createSuiClient('mainnet');

// Get current network
export function getCurrentNetwork(): NetworkType {
  return currentNetworkType;
}

// Switch network
export function switchNetwork(network: NetworkType): void {
  currentNetworkType = network;
  currentClient = createSuiClient(network);
}

// Get current client
export function getSuiClient(): SuiClient {
  return currentClient;
}

// Backward compatibility
export const suiClient = new Proxy({} as SuiClient, {
  get: (target, prop) => {
    return currentClient[prop as keyof SuiClient];
  }
});

// Create explorer link
export function createExplorerLink(txDigest: string, type: 'transaction' | 'object' = 'transaction'): string {
  const network = getCurrentNetwork();
  const baseUrl = NETWORK_CONFIG[network].explorerUrl;
  
  if (type === 'transaction') {
    return `${baseUrl}/tx/${txDigest}?network=${network}`;
  }
  return `${baseUrl}/object/${txDigest}?network=${network}`;
}