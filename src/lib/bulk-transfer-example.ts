// Example usage of the bulk NFT transfer functionality
import { 
  bulkTransferNFTs, 
  validateBulkTransfer, 
  getAvailableNFTTypes,
  testSuiClient,
  BulkTransferResult 
} from './kiosk-discovery';

/**
 * Test SuiClient connection before attempting bulk transfer
 */
export async function testConnection(walletAddress: string) {
  console.log('Testing SuiClient connection...');
  const testResult = await testSuiClient(walletAddress);
  
  if (testResult.isWorking) {
    console.log('✅ SuiClient is working correctly!');
    console.log('Client info:', testResult.clientInfo);
    return true;
  } else {
    console.error('❌ SuiClient test failed:', testResult.error);
    return false;
  }
}

/**
 * Example function demonstrating bulk NFT transfer
 */
export async function exampleBulkTransfer() {
  // Example parameters
  const senderWalletAddress = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  const recipientAddresses = '0x1111111111111111111111111111111111111111111111111111111111111111,0x2222222222222222222222222222222222222222222222222222222222222222,0x3333333333333333333333333333333333333333333333333333333333333333';
  const nftType = '0x2::nft::NFT';
  
  try {
    // Step 0: Test SuiClient connection first
    console.log('Step 0: Testing SuiClient connection...');
    const isConnected = await testConnection(senderWalletAddress);
    if (!isConnected) {
      console.error('Cannot proceed - SuiClient is not working');
      return;
    }
    // Step 1: Validate the transfer parameters
    console.log('Validating bulk transfer parameters...');
    const validation = await validateBulkTransfer(
      senderWalletAddress,
      recipientAddresses,
      nftType
    );
    
    if (!validation.isValid) {
      console.error('Validation failed:', validation.errors);
      return;
    }
    
    console.log('Validation passed:', {
      recipientCount: validation.recipientCount,
      availableNFTs: validation.availableNFTs,
      warnings: validation.warnings
    });
    
    // Step 2: Get available NFT types (optional - for UI selection)
    console.log('Getting available NFT types...');
    const availableTypes = await getAvailableNFTTypes(senderWalletAddress);
    console.log('Available NFT types:', availableTypes);
    
    // Step 3: Execute bulk transfer
    console.log('Executing bulk transfer...');
    const result: BulkTransferResult = await bulkTransferNFTs(
      senderWalletAddress,
      recipientAddresses,
      nftType
    );
    
    // Step 4: Handle results
    console.log('Bulk transfer completed:', {
      totalRecipients: result.totalRecipients,
      successful: result.successful,
      failed: result.failed,
      errors: result.errors
    });
    
    // Log individual recipient status
    result.recipients.forEach((recipient, index) => {
      console.log(`Recipient ${index + 1}:`, {
        address: recipient.walletAddress,
        status: recipient.status,
        hasKiosk: recipient.hasKiosk,
        error: recipient.error
      });
    });
    
    return result;
  } catch (error) {
    console.error('Bulk transfer failed:', error);
    throw error;
  }
}

/**
 * Example function for UI integration
 */
export async function getBulkTransferUI(senderWalletAddress: string) {
  try {
    // Get available NFT types for dropdown selection
    const availableTypes = await getAvailableNFTTypes(senderWalletAddress);
    
    return {
      nftTypes: availableTypes.map(type => ({
        value: type.type,
        label: `${type.type} (${type.availableCount} available)`,
        availableCount: type.availableCount
      })),
      maxRecipients: 100,
      validationRules: {
        maxRecipients: 100,
        requiredFields: ['senderWalletAddress', 'recipientAddresses', 'nftType']
      }
    };
  } catch (error) {
    console.error('Failed to get bulk transfer UI data:', error);
    throw error;
  }
}

/**
 * Example function for real-time validation
 */
export async function validateRecipientInput(
  senderWalletAddress: string,
  recipientInput: string,
  nftType: string
) {
  try {
    const validation = await validateBulkTransfer(
      senderWalletAddress,
      recipientInput,
      nftType
    );
    
    return {
      isValid: validation.isValid,
      message: validation.isValid 
        ? `Ready to transfer ${validation.recipientCount} NFTs` 
        : validation.errors.join(', '),
      recipientCount: validation.recipientCount,
      availableNFTs: validation.availableNFTs,
      warnings: validation.warnings
    };
  } catch (error) {
    return {
      isValid: false,
      message: `Validation error: ${error instanceof Error ? error.message : String(error)}`,
      recipientCount: 0,
      availableNFTs: 0,
      warnings: []
    };
  }
}
