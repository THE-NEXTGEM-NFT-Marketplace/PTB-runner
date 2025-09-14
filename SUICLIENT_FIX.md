# SuiClient Loading Fix - Usage Guide

## Problem Fixed
The "SuiClient not properly loaded" error has been fixed by implementing proper async loading of the Sui client modules.

## How to Test

### 1. Test SuiClient Connection First
```typescript
import { testSuiClient } from './lib/kiosk-discovery';

// Test with any wallet address
const testResult = await testSuiClient('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');

if (testResult.isWorking) {
  console.log('✅ SuiClient is working!');
} else {
  console.error('❌ SuiClient failed:', testResult.error);
}
```

### 2. Use Bulk Transfer Functions
```typescript
import { 
  bulkTransferNFTs, 
  getAvailableNFTTypes,
  validateBulkTransfer 
} from './lib/kiosk-discovery';

// Get your NFT types
const nftTypes = await getAvailableNFTTypes('your-wallet-address');

// Validate before transfer
const validation = await validateBulkTransfer(
  'your-wallet-address',
  'recipient1,recipient2,recipient3',
  'your-nft-type'
);

if (validation.isValid) {
  // Proceed with transfer
  const result = await bulkTransferNFTs(
    'your-wallet-address',
    'recipient1,recipient2,recipient3',
    'your-nft-type'
  );
  
  console.log(`Transferred ${result.successful} NFTs successfully`);
}
```

## Key Changes Made

1. **Async Client Loading**: Added `ensureSuiClientLoaded()` function that waits for the Sui client to load
2. **Better Error Handling**: Improved error messages and fallback mechanisms
3. **Test Function**: Added `testSuiClient()` to verify connection before operations
4. **Automatic Loading**: All main functions now automatically ensure the client is loaded

## What Was Fixed

- **Before**: SuiClient was loaded asynchronously but functions tried to use it immediately
- **After**: All functions wait for SuiClient to load before making API calls
- **Result**: No more "SuiClient not properly loaded" errors

## Usage Tips

1. **Always test first**: Use `testSuiClient()` before bulk operations
2. **Validate inputs**: Use `validateBulkTransfer()` before executing transfers
3. **Check NFT availability**: Use `getAvailableNFTTypes()` to see what you can transfer
4. **Monitor logs**: The system provides detailed logging for debugging

## Example Workflow

```typescript
// 1. Test connection
const isWorking = await testSuiClient(walletAddress);

// 2. Get available NFT types
const nftTypes = await getAvailableNFTTypes(walletAddress);

// 3. Validate transfer
const validation = await validateBulkTransfer(walletAddress, recipients, nftType);

// 4. Execute transfer
if (validation.isValid) {
  const result = await bulkTransferNFTs(walletAddress, recipients, nftType);
}
```

The system now properly handles the async loading of Sui client modules and should work reliably in both browser and Node.js environments.
