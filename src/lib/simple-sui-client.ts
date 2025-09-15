import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';

let currentNetwork: 'mainnet' | 'testnet' | 'devnet' = 'mainnet';
let suiClient = new SuiClient({ url: getFullnodeUrl(currentNetwork) });

function getSuiClient() {
  return suiClient;
}

function switchNetwork(network: 'mainnet' | 'testnet' | 'devnet') {
  currentNetwork = network;
  suiClient = new SuiClient({ url: getFullnodeUrl(network) });
  console.log(`Switched to ${network} network`);
}

async function testSuiClientConnection(walletAddress: string): Promise<{
  isWorking: boolean;
  error?: string;
  network: string;
}> {
  try {
    console.log(`Testing SuiClient connection for ${walletAddress} on ${currentNetwork}`);
    
    const result = await suiClient.getOwnedObjects({
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

export {
  suiClient,
  getSuiClient,
  switchNetwork,
  testSuiClientConnection,
  SuiClient
};
