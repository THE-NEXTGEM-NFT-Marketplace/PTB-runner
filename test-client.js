// Quick test to verify the new SuiClient is working
// Run this in the browser console to test

async function testNewSuiClient() {
  console.log('🧪 Testing new SuiClient implementation...');
  
  try {
    // Import the new client
    const { testSuiClientConnection, switchNetwork, getCurrentNetwork } = await import('./src/lib/simple-sui-client');
    
    // Test with a known wallet address
    const testWallet = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    
    console.log('Test 1: Testing connection...');
    const connectionTest = await testSuiClientConnection(testWallet);
    console.log('Connection test result:', connectionTest);
    
    if (connectionTest.isWorking) {
      console.log('✅ Connection test passed!');
      console.log('Current network:', getCurrentNetwork());
      
      // Test network switching
      console.log('Test 2: Testing network switching...');
      switchNetwork('testnet');
      console.log('Switched to testnet:', getCurrentNetwork());
      
      switchNetwork('mainnet');
      console.log('Switched back to mainnet:', getCurrentNetwork());
      
      console.log('✅ All tests passed! SuiClient is working correctly.');
      return true;
    } else {
      console.log('❌ Connection test failed:', connectionTest.error);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    return false;
  }
}

// Export for use
window.testNewSuiClient = testNewSuiClient;

console.log('Test function loaded. Run testNewSuiClient() to test the new SuiClient.');
