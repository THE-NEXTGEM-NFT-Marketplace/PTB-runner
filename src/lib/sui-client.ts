// Sui Client Configuration and Utilities
// Use a workaround for the package exports issue
let SuiClient: any;
let getFullnodeUrl: any;

// Try to load the modules with error handling
if (typeof window !== 'undefined') {
  // Browser environment - use dynamic import
  (async () => {
    try {
      const clientModule = await import('@mysten/sui/client');
      SuiClient = clientModule.SuiClient;
      getFullnodeUrl = clientModule.getFullnodeUrl;
    } catch (error) {
      console.warn('Failed to load @mysten/sui/client:', error);
    }
  })();
} else {
  // Node.js environment - use require
  try {
    const clientModule = require('@mysten/sui/client');
    SuiClient = clientModule.SuiClient;
    getFullnodeUrl = clientModule.getFullnodeUrl;
  } catch (error) {
    console.warn('Failed to load @mysten/sui/client:', error);
  }
}

// Fallback implementations
if (!getFullnodeUrl) {
  getFullnodeUrl = (network: 'mainnet' | 'testnet' | 'devnet'): string => {
    const urls = {
      mainnet: 'https://fullnode.mainnet.sui.io:443',
      testnet: 'https://fullnode.testnet.sui.io:443',
      devnet: 'https://fullnode.devnet.sui.io:443'
    };
    return urls[network] || urls.mainnet;
  };
}

if (!SuiClient) {
  SuiClient = class {
    private url: string;
    constructor(options: { url: string }) {
      this.url = options.url;
    }
    async getOwnedObjects(params: any) {
      throw new Error('SuiClient not properly loaded - please refresh the page');
    }
    async getDynamicFields(params: any) {
      throw new Error('SuiClient not properly loaded - please refresh the page');
    }
    async getObject(params: any) {
      throw new Error('SuiClient not properly loaded - please refresh the page');
    }
  };
}

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