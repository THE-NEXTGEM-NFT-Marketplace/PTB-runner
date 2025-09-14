// Quick debugging script to test the new SuiClient
// Run this in the browser console to see what's happening

async function debugSuiClient() {
  console.log('🔍 Debugging SuiClient...');
  
  try {
    // Test 1: Check if simple-sui-client is available
    console.log('Test 1: Loading simple-sui-client...');
    const { testSuiClientConnection, suiClient } = await import('./src/lib/simple-sui-client');
    console.log('✅ simple-sui-client loaded successfully');
    
    // Test 2: Test connection with a dummy address
    console.log('Test 2: Testing connection...');
    const testAddress = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const connectionTest = await testSuiClientConnection(testAddress);
    console.log('Connection test result:', connectionTest);
    
    // Test 3: Try to get owned objects
    console.log('Test 3: Testing getOwnedObjects...');
    try {
      const result = await suiClient.getOwnedObjects({
        owner: testAddress,
        limit: 1,
        options: { showContent: false, showType: false }
      });
      console.log('✅ getOwnedObjects works:', result);
    } catch (error) {
      console.log('❌ getOwnedObjects failed:', error);
    }
    
    // Test 4: Check if kiosk-discovery is using the right client
    console.log('Test 4: Testing kiosk-discovery...');
    const { getUserKiosks } = await import('./src/lib/kiosk-discovery');
    console.log('✅ kiosk-discovery loaded');
    
    // Test 5: Try to get kiosks (this might fail with dummy address, but should not throw client errors)
    console.log('Test 5: Testing getUserKiosks...');
    try {
      const kiosks = await getUserKiosks(testAddress);
      console.log('✅ getUserKiosks works:', kiosks);
    } catch (error) {
      console.log('getUserKiosks error (expected with dummy address):', error.message);
      if (error.message.includes('SuiClient not properly loaded')) {
        console.log('❌ PROBLEM: Still using old SuiClient!');
      } else {
        console.log('✅ Using new SuiClient (error is expected with dummy address)');
      }
    }
    
    console.log('🎯 Debug complete!');
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// Export for use
window.debugSuiClient = debugSuiClient;

console.log('Debug function loaded. Run debugSuiClient() to test the SuiClient.');
