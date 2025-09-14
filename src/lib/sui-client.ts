// Sui Client Configuration and Utilities
// Try direct import first, fallback to dynamic import if needed
let SuiClient: any;
let getFullnodeUrl: any;
let clientLoadPromise: Promise<void> | null = null;
let isClientLoaded = false;

// Fallback implementations
const fallbackGetFullnodeUrl = (network: 'mainnet' | 'testnet' | 'devnet'): string => {
  const urls = {
    mainnet: 'https://fullnode.mainnet.sui.io:443',
    testnet: 'https://fullnode.testnet.sui.io:443',
    devnet: 'https://fullnode.devnet.sui.io:443'
  };
  return urls[network] || urls.mainnet;
};

const fallbackSuiClient = class {
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

// Try direct import first
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const clientModule = require('@mysten/sui/client');
  SuiClient = clientModule.SuiClient;
  getFullnodeUrl = clientModule.getFullnodeUrl;
  isClientLoaded = true;
  console.log('SuiClient loaded via direct import');
} catch (directImportError) {
  console.log('Direct import failed, trying dynamic import:', directImportError);
  
  // Initialize fallback values
  getFullnodeUrl = fallbackGetFullnodeUrl;
  SuiClient = fallbackSuiClient;
  
  // Load the actual Sui client modules via dynamic import
  async function loadSuiClient(): Promise<void> {
    if (isClientLoaded) {
      return;
    }

    try {
      console.log('Attempting dynamic import of @mysten/sui/client...');
      
      if (typeof window !== 'undefined') {
        // Browser environment - use dynamic import
        const clientModule = await import('@mysten/sui/client');
        console.log('Dynamic import successful, clientModule:', clientModule);
        SuiClient = clientModule.SuiClient;
        getFullnodeUrl = clientModule.getFullnodeUrl;
      } else {
        // Node.js environment - use require
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const clientModule = require('@mysten/sui/client');
        SuiClient = clientModule.SuiClient;
        getFullnodeUrl = clientModule.getFullnodeUrl;
      }
      
      isClientLoaded = true;
      console.log('SuiClient loaded successfully via dynamic import');
    } catch (error) {
      console.warn('Failed to load @mysten/sui/client via dynamic import:', error);
      console.log('Available modules:', typeof window !== 'undefined' ? 'browser' : 'node');
      // Keep using fallback implementations
    }
  }

  // Start loading immediately
  if (typeof window !== 'undefined') {
    clientLoadPromise = loadSuiClient();
  } else {
    // In Node.js, load synchronously
    loadSuiClient().catch(console.warn);
  }
}

// Export function to ensure client is loaded
export async function ensureSuiClientLoaded(): Promise<void> {
  if (clientLoadPromise) {
    console.log('Waiting for SuiClient to load...');
    await clientLoadPromise;
    console.log('SuiClient loading completed');
  }
  
  if (!isClientLoaded) {
    console.warn('SuiClient is still not loaded after waiting');
    throw new Error('SuiClient failed to load properly');
  }
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