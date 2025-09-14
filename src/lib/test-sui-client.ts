// Test file for the new SuiClient implementation
import { testSuiClientConnection, switchNetwork, getCurrentNetwork } from './simple-sui-client';
import { testSuiClient } from './kiosk-discovery';

// Test function
export async function testNewSuiClient() {
  console.log('🧪 Testing new SuiClient implementation...');
  
  // Test with a known wallet address
  const testWallet = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  
  try {
    // Test 1: Test connection
    console.log('Test 1: Testing connection...');
    const connectionTest = await testSuiClientConnection(testWallet);
    console.log('Connection test result:', connectionTest);
    
    if (connectionTest.isWorking) {
      console.log('✅ Connection test passed!');
    } else {
      console.log('❌ Connection test failed:', connectionTest.error);
      return false;
    }
    
    // Test 2: Test through kiosk-discovery
    console.log('Test 2: Testing through kiosk-discovery...');
    const discoveryTest = await testSuiClient(testWallet);
    console.log('Discovery test result:', discoveryTest);
    
    if (discoveryTest.isWorking) {
      console.log('✅ Discovery test passed!');
    } else {
      console.log('❌ Discovery test failed:', discoveryTest.error);
      return false;
    }
    
    // Test 3: Test network switching
    console.log('Test 3: Testing network switching...');
    console.log('Current network:', getCurrentNetwork());
    
    switchNetwork('testnet');
    console.log('Switched to testnet:', getCurrentNetwork());
    
    switchNetwork('mainnet');
    console.log('Switched back to mainnet:', getCurrentNetwork());
    
    console.log('✅ All tests passed! SuiClient is working correctly.');
    return true;
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    return false;
  }
}

// Export for use in other files
export { testNewSuiClient };
