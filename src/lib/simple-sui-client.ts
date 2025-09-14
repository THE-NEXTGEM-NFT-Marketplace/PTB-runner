// Alternative Sui Client Implementation
// This version uses a simpler approach without dynamic imports

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// Simple SuiClient implementation that works without dynamic imports
class SimpleSuiClient {
  private url: string;
  
  constructor(options: { url: string }) {
    this.url = options.url;
  }
  
  async getOwnedObjects(params: any) {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'suix_getOwnedObjects',
        params: [
          params.owner,
          {
            filter: params.filter,
            options: params.options,
          },
          params.cursor ?? null,
          params.limit ?? 50,
        ]
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(`RPC error: ${data.error.message}`);
    }
    
    return data.result;
  }
  
  async getDynamicFields(params: any) {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'suix_getDynamicFields',
        params: [
          params.parentId,
          params.cursor ?? null,
          params.limit ?? 50,
        ]
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(`RPC error: ${data.error.message}`);
    }
    
    return data.result;
  }
  
  async getObject(params: any) {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'sui_getObject',
        params: [
          params.id,
          {
            showContent: params.options?.showContent || false,
            showType: params.options?.showType || false,
            showDisplay: params.options?.showDisplay || false,
            showOwner: params.options?.showOwner || false,
            showPreviousTransaction: params.options?.showPreviousTransaction || false,
            showStorageRebate: params.options?.showStorageRebate || false
          }
        ]
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(`RPC error: ${data.error.message}`);
    }
    
    return data.result;
  }

  async multiGetObjects(params: any) {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'sui_multiGetObjects',
        params: [
          params.ids,
          {
            showContent: params.options?.showContent || false,
            showType: params.options?.showType || false,
            showDisplay: params.options?.showDisplay || false,
            showOwner: params.options?.showOwner || false,
            showPreviousTransaction: params.options?.showPreviousTransaction || false,
            showStorageRebate: params.options?.showStorageRebate || false
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`RPC error: ${data.error.message}`);
    }

    return data.result;
  }
}

// Network configuration
const NETWORK_URLS = {
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
  devnet: 'https://fullnode.devnet.sui.io:443'
};

// Create a working SuiClient instance
export function createSuiClient(network: 'mainnet' | 'testnet' | 'devnet' = 'mainnet') {
  const url = NETWORK_URLS[network];
  console.log(`Creating SuiClient for ${network} with URL: ${url}`);
  return new SimpleSuiClient({ url });
}

// Create initial client and export a proxy that always points to it
let currentNetwork: 'mainnet' | 'testnet' | 'devnet' = 'mainnet';
let currentClient: SimpleSuiClient = createSuiClient(currentNetwork);

export const suiClient = new Proxy({} as any, {
  get: (_target, prop) => {
    return (currentClient as any)[prop as keyof SimpleSuiClient];
  }
});

// Export the class for custom instances
export { SimpleSuiClient as SuiClient };

export function switchNetwork(network: 'mainnet' | 'testnet' | 'devnet') {
  currentNetwork = network;
  currentClient = createSuiClient(network);
  console.log(`Switched to ${network} network`);
}

export function getCurrentNetwork(): 'mainnet' | 'testnet' | 'devnet' {
  return currentNetwork;
}

export function getSuiClient() {
  return currentClient;
}

// Test function
export async function testSuiClientConnection(walletAddress: string): Promise<{
  isWorking: boolean;
  error?: string;
  network: string;
}> {
  try {
    console.log(`Testing SuiClient connection for ${walletAddress} on ${currentNetwork}`);
    
    const result = await currentClient.getOwnedObjects({
      owner: walletAddress,
      limit: 1,
      options: {
        showContent: false,
        showType: false,
      }
    });
    
    console.log('✅ SuiClient test successful:', result);
    
    return {
      isWorking: true,
      network: currentNetwork
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ SuiClient test failed:', errorMessage);
    
    return {
      isWorking: false,
      error: errorMessage,
      network: currentNetwork
    };
  }
}
