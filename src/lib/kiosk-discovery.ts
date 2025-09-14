// Kiosk Discovery and NFT Management Utilities
import { suiClient, testSuiClientConnection } from './simple-sui-client';

// Configuration constants
const CONFIG = {
  RATE_LIMIT_DELAY: 100, // 100ms between API calls
  MAX_DYNAMIC_FIELDS_PER_BATCH: 50, // Limit batch size for dynamic fields
  MAX_PAGINATION_LIMIT: 1000, // Prevent infinite loops
  KIOSK_OWNER_CAP_TYPE: '0x2::kiosk::KioskOwnerCap',
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second between retries
} as const;

// Sui API Response Types
interface SuiObjectData {
  objectId: string;
  type?: string;
  content?: {
    dataType: string;
    fields: Record<string, unknown>;
  };
  display?: {
    data?: {
      name?: string;
      description?: string;
      image_url?: string;
    };
  };
}

interface SuiOwnedObjectsResponse {
  data: SuiObjectData[];
  nextCursor?: string | null;
}

interface SuiDynamicField {
  objectId: string;
  name: string;
}

interface SuiDynamicFieldsResponse {
  data: SuiDynamicField[];
  nextCursor?: string | null;
}

interface SuiObjectResponse {
  data?: SuiObjectData | null;
}

// Custom Error Types
export class KioskDiscoveryError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'KioskDiscoveryError';
  }
}

export class RateLimitError extends KioskDiscoveryError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT');
  }
}

export class ValidationError extends KioskDiscoveryError {
  constructor(message: string, field?: string) {
    super(message, 'VALIDATION_ERROR', field ? { field } : undefined);
  }
}

// Main interfaces
export interface KioskInfo {
  id: string;
  ownerCapId: string;
  itemCount: number;
}

export interface NFTInfo {
  id: string;
  type: string;
  display?: {
    name?: string;
    description?: string;
    image_url?: string;
  };
  kioskId: string;
}

// Utility functions
function isValidWalletAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(address);
}

function isValidObjectId(id: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(id);
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry<T>(
  operation: () => Promise<T>,
  attempts: number = CONFIG.RETRY_ATTEMPTS,
  delayMs: number = CONFIG.RETRY_DELAY
): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i < attempts; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (i < attempts - 1) {
        await delay(delayMs * (i + 1)); // Exponential backoff
      }
    }
  }
  
  throw lastError!;
}

function log(level: 'debug' | 'info' | 'warn' | 'error', message: string, context?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  
  if (context) {
    console[level](logMessage, context);
  } else {
    console[level](logMessage);
  }
}

/**
 * Discovers user's kiosks by finding KioskOwnerCap objects
 * @param walletAddress - The wallet address to search for kiosks
 * @returns Promise resolving to array of KioskInfo objects
 * @throws ValidationError if wallet address is invalid
 * @throws KioskDiscoveryError if kiosk discovery fails
 */
export async function getUserKiosks(walletAddress: string): Promise<KioskInfo[]> {
  // Input validation
  if (!isValidWalletAddress(walletAddress)) {
    throw new ValidationError('Invalid wallet address format', 'walletAddress');
  }

  log('info', 'Starting kiosk discovery', { walletAddress });
  
  try {
    const ownedObjects = await fetchKioskOwnerCaps(walletAddress);
    const kiosks = await processKioskOwnerCaps(ownedObjects);
    
    log('info', 'Kiosk discovery completed', { 
      walletAddress, 
      kiosksFound: kiosks.length 
    });
    
    return kiosks;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log('error', 'Failed to fetch kiosks', { walletAddress, error: errorMessage });
    throw new KioskDiscoveryError(
      `Failed to fetch kiosks: ${errorMessage}`,
      'KIOSK_DISCOVERY_FAILED',
      { walletAddress }
    );
  }
}

/**
 * Fetches KioskOwnerCap objects using multiple strategies
 */
async function fetchKioskOwnerCaps(walletAddress: string): Promise<SuiOwnedObjectsResponse> {
  try {
    // Strategy 1: Try specific KioskOwnerCap filter
    log('debug', 'Attempting specific KioskOwnerCap filter');
    
    const specificResponse = await withRetry(async () => {
      return await suiClient.getOwnedObjects({
        owner: walletAddress,
        filter: {
          StructType: CONFIG.KIOSK_OWNER_CAP_TYPE
        },
        options: {
          showContent: true,
          showType: true,
        }
      }) as SuiOwnedObjectsResponse;
    });
    
    log('info', 'Specific filter successful', { 
      objectsFound: specificResponse.data.length 
    });
    
    return specificResponse;
  } catch (specificError) {
    log('warn', 'Specific filter failed, trying broader search', { 
      error: specificError instanceof Error ? specificError.message : String(specificError)
    });
    
    // Strategy 2: Get all objects and filter manually
    return await fetchAllObjectsWithFilter(walletAddress);
  }
}

/**
 * Fetches all owned objects and filters for kiosk-related ones
 */
async function fetchAllObjectsWithFilter(walletAddress: string): Promise<SuiOwnedObjectsResponse> {
  const allObjects: SuiObjectData[] = [];
  let cursor: string | null = null;
  let paginationCount = 0;
  
  do {
    if (paginationCount >= CONFIG.MAX_PAGINATION_LIMIT) {
      log('warn', 'Pagination limit reached', { limit: CONFIG.MAX_PAGINATION_LIMIT });
      break;
    }
    
    const batch = await withRetry(async () => {
      return await suiClient.getOwnedObjects({
        owner: walletAddress,
        cursor: cursor || undefined,
        options: {
          showContent: true,
          showType: true,
        }
      }) as SuiOwnedObjectsResponse;
    });
    
    allObjects.push(...batch.data);
    cursor = batch.nextCursor;
    paginationCount++;
    
    // Rate limiting
    if (cursor) {
      await delay(CONFIG.RATE_LIMIT_DELAY);
    }
    
    log('debug', 'Fetched batch of objects', { 
      batchSize: batch.data.length, 
      totalSoFar: allObjects.length 
    });
  } while (cursor);
  
  // Debug: Log all object types found
  const allTypes = allObjects.map(obj => {
    // Try different ways to get the type
    return obj.type || obj.content?.type || obj.content?.dataType || 'unknown';
  }).filter(Boolean);
  const uniqueTypes = [...new Set(allTypes)];
  log('debug', 'All object types found', { 
    totalTypes: uniqueTypes.length,
    types: uniqueTypes.slice(0, 10) // Show first 10 types
  });
  
  // Filter for KioskOwnerCap objects
  const filteredObjects = allObjects.filter(obj => {
    const objType = obj.type || obj.content?.type || obj.content?.dataType || '';
    return objType.includes('kiosk') && 
           (objType.includes('KioskOwnerCap') || objType.includes('OwnerCap'));
  });
  
  log('info', 'Manual filtering completed', { 
    totalObjects: allObjects.length,
    filteredObjects: filteredObjects.length,
    kioskTypes: uniqueTypes.filter(type => type?.toLowerCase().includes('kiosk'))
  });
  
  return { data: filteredObjects };
}

/**
 * Processes KioskOwnerCap objects to extract kiosk information
 */
async function processKioskOwnerCaps(ownedObjects: SuiOwnedObjectsResponse): Promise<KioskInfo[]> {
  const kiosks: KioskInfo[] = [];
  
  for (const obj of ownedObjects.data) {
    try {
      const kioskInfo = await processKioskOwnerCap(obj);
      if (kioskInfo) {
        kiosks.push(kioskInfo);
      }
    } catch (error) {
      log('warn', 'Failed to process kiosk owner cap', {
        objectId: obj.objectId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  return kiosks;
}

/**
 * Processes a single KioskOwnerCap object
 */
async function processKioskOwnerCap(obj: SuiObjectData): Promise<KioskInfo | null> {
  log('debug', 'Processing kiosk owner cap', { 
    objectId: obj.objectId, 
    type: obj.type 
  });
  
  if (!obj.content?.fields) {
    log('warn', 'Object has no content or fields', { objectId: obj.objectId });
    return null;
  }
  
  const fields = obj.content.fields;
  const kioskId = extractKioskId(fields);
  
  if (!kioskId) {
    log('warn', 'No kiosk ID found in fields', { 
      objectId: obj.objectId,
      availableFields: Object.keys(fields)
    });
    return null;
  }
  
  if (!isValidObjectId(kioskId)) {
    log('warn', 'Invalid kiosk ID format', { 
      objectId: obj.objectId,
      kioskId 
    });
    return null;
  }
  
  log('debug', 'Found kiosk ID', { objectId: obj.objectId, kioskId });
  
  try {
    const itemCount = await getKioskItemCount(kioskId);
    
    return {
      id: kioskId,
      ownerCapId: obj.objectId,
      itemCount
    };
  } catch (error) {
    log('warn', 'Failed to get kiosk item count, using 0', {
      kioskId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    return {
      id: kioskId,
      ownerCapId: obj.objectId,
      itemCount: 0
    };
  }
}

/**
 * Extracts kiosk ID from object fields using multiple field name variations
 */
function extractKioskId(fields: Record<string, unknown>): string | null {
  const possibleFields = ['for', 'kiosk_id', 'kioskId', 'kiosk', 'id'];
  
  for (const fieldName of possibleFields) {
    const value = fields[fieldName];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  
  return null;
}

/**
 * Gets the item count for a specific kiosk
 */
async function getKioskItemCount(kioskId: string): Promise<number> {
  const kioskObject = await withRetry(async () => {
    return await suiClient.getObject({
      id: kioskId,
      options: { showContent: true }
    }) as SuiObjectResponse;
  });
  
  if (!kioskObject.data?.content?.fields) {
    return 0;
  }
  
  const fields = kioskObject.data.content.fields;
  const possibleCountFields = ['item_count', 'itemCount', 'items'];
  
  for (const fieldName of possibleCountFields) {
    const value = fields[fieldName];
    if (typeof value === 'number' && value >= 0) {
      return value;
    }
  }
  
  return 0;
}

/**
 * Gets NFTs in a specific kiosk
 * @param kioskId - The kiosk ID to fetch NFTs from
 * @returns Promise resolving to array of NFTInfo objects
 * @throws ValidationError if kiosk ID is invalid
 * @throws KioskDiscoveryError if NFT fetching fails
 */
export async function getKioskNFTs(kioskId: string): Promise<NFTInfo[]> {
  // Input validation
  if (!isValidObjectId(kioskId)) {
    throw new ValidationError('Invalid kiosk ID format', 'kioskId');
  }

  log('info', 'Fetching NFTs for kiosk', { kioskId });
  
  try {
    const dynamicFields = await fetchKioskDynamicFields(kioskId);
    const nfts = await processDynamicFields(dynamicFields, kioskId);
    
    log('info', 'NFT fetching completed', { 
      kioskId, 
      nftsFound: nfts.length 
    });
    
    return nfts;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log('error', 'Failed to fetch kiosk NFTs', { kioskId, error: errorMessage });
    
    // Return empty array instead of throwing to maintain backward compatibility
    return [];
  }
}

/**
 * Fetches dynamic fields for a kiosk with pagination and rate limiting
 */
async function fetchKioskDynamicFields(kioskId: string): Promise<SuiDynamicFieldsResponse> {
  const allDynamicFields: SuiDynamicField[] = [];
  let cursor: string | null = null;
  let paginationCount = 0;
  
  do {
    if (paginationCount >= CONFIG.MAX_PAGINATION_LIMIT) {
      log('warn', 'Dynamic fields pagination limit reached', { 
        kioskId, 
        limit: CONFIG.MAX_PAGINATION_LIMIT 
      });
      break;
    }
    
    const dynamicFields = await withRetry(async () => {
      return await suiClient.getDynamicFields({
        parentId: kioskId,
        cursor: cursor || undefined,
        limit: CONFIG.MAX_DYNAMIC_FIELDS_PER_BATCH,
      }) as SuiDynamicFieldsResponse;
    });
    
    // Rate limiting
    if (cursor) {
      await delay(CONFIG.RATE_LIMIT_DELAY);
    }
    
    allDynamicFields.push(...dynamicFields.data);
    cursor = dynamicFields.nextCursor;
    paginationCount++;
    
    log('debug', 'Fetched batch of dynamic fields', { 
      kioskId,
      batchSize: dynamicFields.data.length, 
      totalSoFar: allDynamicFields.length 
    });
  } while (cursor);
  
  log('info', 'Dynamic fields fetching completed', { 
    kioskId,
    totalFields: allDynamicFields.length 
  });
  
  return { data: allDynamicFields };
}

/**
 * Processes dynamic fields to extract NFT information
 */
async function processDynamicFields(
  dynamicFields: SuiDynamicFieldsResponse, 
  kioskId: string
): Promise<NFTInfo[]> {
  const nfts: NFTInfo[] = [];
  
  // Process fields in batches to avoid overwhelming the API
  const batchSize = 10;
  for (let i = 0; i < dynamicFields.data.length; i += batchSize) {
    const batch = dynamicFields.data.slice(i, i + batchSize);
    
    const batchPromises = batch.map(field => 
      processDynamicField(field, kioskId).catch(error => {
        log('warn', 'Failed to process dynamic field', {
          kioskId,
          fieldId: field.objectId,
          error: error instanceof Error ? error.message : String(error)
        });
        return null;
      })
    );
    
    const batchResults = await Promise.all(batchPromises);
    const validNFTs = batchResults.filter((nft): nft is NFTInfo => nft !== null);
    nfts.push(...validNFTs);
    
    // Rate limiting between batches
    if (i + batchSize < dynamicFields.data.length) {
      await delay(CONFIG.RATE_LIMIT_DELAY);
    }
  }
  
  return nfts;
}

/**
 * Processes a single dynamic field to extract NFT information
 */
async function processDynamicField(
  field: SuiDynamicField, 
  kioskId: string
): Promise<NFTInfo | null> {
  log('debug', 'Processing dynamic field', { 
    kioskId,
    fieldId: field.objectId, 
    fieldName: field.name 
  });
  
  try {
    const fieldObject = await withRetry(async () => {
      return await suiClient.getObject({
        id: field.objectId,
        options: {
          showContent: true,
          showType: true,
          showDisplay: true,
        }
      }) as SuiObjectResponse;
    });
    
    if (!fieldObject.data) {
      log('warn', 'Dynamic field object not found', { 
        kioskId,
        fieldId: field.objectId 
      });
      return null;
    }
    
    return await extractNFTFromFieldObject(fieldObject.data, kioskId);
  } catch (error) {
    log('warn', 'Failed to process dynamic field', {
      kioskId,
      fieldId: field.objectId,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

/**
 * Extracts NFT information from a field object
 */
async function extractNFTFromFieldObject(
  fieldObject: SuiObjectData, 
  kioskId: string
): Promise<NFTInfo | null> {
  if (!fieldObject.content?.fields) {
    log('warn', 'Field object has no content or fields', { 
      kioskId,
      fieldId: fieldObject.objectId 
    });
    return null;
  }
  
  const fields = fieldObject.content.fields;
  
  // Strategy 1: Check if this is a kiosk item wrapper with a value field
  const wrapperValue = extractWrapperValue(fields);
  if (wrapperValue) {
    return await fetchNFTFromId(wrapperValue, kioskId);
  }
  
  // Strategy 2: Check if this dynamic field object is itself an NFT
  if (isNFTObject(fieldObject)) {
    return {
      id: fieldObject.objectId,
      type: fieldObject.type || 'unknown',
      display: fieldObject.display?.data,
      kioskId
    };
  }
  
  // Strategy 3: Try other common field names
  const itemId = extractItemId(fields);
  if (itemId) {
    return await fetchNFTFromId(itemId, kioskId);
  }
  
  log('debug', 'No recognizable NFT reference found', { 
    kioskId,
    fieldId: fieldObject.objectId,
    availableFields: Object.keys(fields)
  });
  
  return null;
}

/**
 * Extracts wrapper value from fields
 */
function extractWrapperValue(fields: Record<string, unknown>): string | null {
  const value = fields.value;
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  return null;
}

/**
 * Checks if an object appears to be an NFT
 */
function isNFTObject(obj: SuiObjectData): boolean {
  if (!obj.type) return false;
  
  const hasNFTType = obj.type.includes('nft') || 
                    obj.type.includes('NFT') ||
                    obj.type.includes('collectible');
  
  const hasDisplayData = Boolean(obj.display?.data && (
    obj.display.data.name || 
    obj.display.data.image_url
  ));
  
  return hasNFTType || hasDisplayData;
}

/**
 * Extracts item ID from fields using common field names
 */
function extractItemId(fields: Record<string, unknown>): string | null {
  const possibleFields = ['item_id', 'itemId', 'id', 'item'];
  
  for (const fieldName of possibleFields) {
    const value = fields[fieldName];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  
  return null;
}

/**
 * Fetches NFT information from an object ID
 */
async function fetchNFTFromId(nftId: string, kioskId: string): Promise<NFTInfo | null> {
  if (!isValidObjectId(nftId)) {
    log('warn', 'Invalid NFT ID format', { kioskId, nftId });
    return null;
  }
  
  try {
    const nftObject = await withRetry(async () => {
      return await suiClient.getObject({
        id: nftId,
        options: {
          showContent: true,
          showType: true,
          showDisplay: true,
        }
      }) as SuiObjectResponse;
    });
    
    if (!nftObject.data || !nftObject.data.type) {
      log('warn', 'NFT object not found or has no type', { kioskId, nftId });
      return null;
    }
    
    log('debug', 'Successfully fetched NFT', { 
      kioskId, 
      nftId, 
      type: nftObject.data.type 
    });
    
    return {
      id: nftId,
      type: nftObject.data.type,
      display: nftObject.data.display?.data,
      kioskId
    };
  } catch (error) {
    log('warn', 'Failed to fetch NFT', {
      kioskId,
      nftId,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

/**
 * Gets all NFTs from all user's kiosks with proper rate limiting
 * @param walletAddress - The wallet address to fetch NFTs for
 * @returns Promise resolving to array of NFTInfo objects
 * @throws ValidationError if wallet address is invalid
 * @throws KioskDiscoveryError if NFT fetching fails
 */
export async function getAllUserNFTs(walletAddress: string): Promise<NFTInfo[]> {
  // Input validation
  if (!isValidWalletAddress(walletAddress)) {
    throw new ValidationError('Invalid wallet address format', 'walletAddress');
  }

  log('info', 'Fetching all user NFTs', { walletAddress });
  
  try {
    const kiosks = await getUserKiosks(walletAddress);
    const allNFTs: NFTInfo[] = [];
    
    // Process kiosks with rate limiting
    for (let i = 0; i < kiosks.length; i++) {
      const kiosk = kiosks[i];
      
      try {
        const nfts = await getKioskNFTs(kiosk.id);
        allNFTs.push(...nfts);
        
        log('debug', 'Fetched NFTs from kiosk', { 
          walletAddress,
          kioskId: kiosk.id,
          nftsFound: nfts.length 
        });
      } catch (error) {
        log('warn', 'Failed to fetch NFTs from kiosk', {
          walletAddress,
          kioskId: kiosk.id,
          error: error instanceof Error ? error.message : String(error)
        });
        // Continue with other kiosks
      }
      
      // Rate limiting between kiosks
      if (i < kiosks.length - 1) {
        await delay(CONFIG.RATE_LIMIT_DELAY);
      }
    }
    
    log('info', 'All user NFTs fetched', { 
      walletAddress,
      totalNFTs: allNFTs.length 
    });
    
    return allNFTs;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log('error', 'Failed to fetch all user NFTs', { walletAddress, error: errorMessage });
    throw new KioskDiscoveryError(
      `Failed to fetch all user NFTs: ${errorMessage}`,
      'ALL_NFTS_FETCH_FAILED',
      { walletAddress }
    );
  }
}

/**
 * Gets unique NFT types from user's collection
 * @param walletAddress - The wallet address to get NFT types for
 * @returns Promise resolving to array of unique NFT type strings
 * @throws ValidationError if wallet address is invalid
 * @throws KioskDiscoveryError if NFT type fetching fails
 */
export async function getUserNFTTypes(walletAddress: string): Promise<string[]> {
  // Input validation
  if (!isValidWalletAddress(walletAddress)) {
    throw new ValidationError('Invalid wallet address format', 'walletAddress');
  }

  log('info', 'Fetching user NFT types', { walletAddress });
  
  try {
    const nfts = await getAllUserNFTs(walletAddress);
    const types = new Set(nfts.map(nft => nft.type));
    const uniqueTypes = Array.from(types);
    
    log('info', 'User NFT types fetched', { 
      walletAddress,
      uniqueTypes: uniqueTypes.length 
    });
    
    return uniqueTypes;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log('error', 'Failed to fetch user NFT types', { walletAddress, error: errorMessage });
    throw new KioskDiscoveryError(
      `Failed to fetch user NFT types: ${errorMessage}`,
      'NFT_TYPES_FETCH_FAILED',
      { walletAddress }
    );
  }
}

/**
 * Checks if user has a kiosk
 * @param walletAddress - The wallet address to check
 * @returns Promise resolving to boolean indicating if user has kiosks
 * @throws ValidationError if wallet address is invalid
 * @throws KioskDiscoveryError if kiosk check fails
 */
export async function hasKiosk(walletAddress: string): Promise<boolean> {
  // Input validation
  if (!isValidWalletAddress(walletAddress)) {
    throw new ValidationError('Invalid wallet address format', 'walletAddress');
  }

  log('info', 'Checking if user has kiosk', { walletAddress });
  
  try {
    const kiosks = await getUserKiosks(walletAddress);
    const hasKiosks = kiosks.length > 0;
    
    log('info', 'Kiosk check completed', { 
      walletAddress,
      hasKiosks 
    });
    
    return hasKiosks;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log('error', 'Failed to check if user has kiosk', { walletAddress, error: errorMessage });
    throw new KioskDiscoveryError(
      `Failed to check if user has kiosk: ${errorMessage}`,
      'KIOSK_CHECK_FAILED',
      { walletAddress }
    );
  }
}

/**
 * Alternative method: Find NFTs by searching all owned objects directly
 * @param walletAddress - The wallet address to search for NFTs
 * @returns Promise resolving to array of NFTInfo objects
 * @throws ValidationError if wallet address is invalid
 * @throws KioskDiscoveryError if direct NFT search fails
 */
export async function findNFTsDirectly(walletAddress: string): Promise<NFTInfo[]> {
  // Input validation
  if (!isValidWalletAddress(walletAddress)) {
    throw new ValidationError('Invalid wallet address format', 'walletAddress');
  }

  log('info', 'Searching for NFTs directly owned', { walletAddress });
  
  try {
    const allObjects = await fetchAllOwnedObjects(walletAddress);
    const nfts = filterNFTsFromObjects(allObjects);
    
    log('info', 'Direct NFT search completed', { 
      walletAddress,
      nftsFound: nfts.length 
    });
    
    return nfts;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log('error', 'Failed to find NFTs directly', { walletAddress, error: errorMessage });
    throw new KioskDiscoveryError(
      `Failed to find NFTs directly: ${errorMessage}`,
      'DIRECT_NFT_SEARCH_FAILED',
      { walletAddress }
    );
  }
}

/**
 * Fetches all owned objects for a wallet with pagination and rate limiting
 */
async function fetchAllOwnedObjects(walletAddress: string): Promise<SuiObjectData[]> {
  const allObjects: SuiObjectData[] = [];
  let cursor: string | null = null;
  let paginationCount = 0;
  
  do {
    if (paginationCount >= CONFIG.MAX_PAGINATION_LIMIT) {
      log('warn', 'Owned objects pagination limit reached', { 
        walletAddress, 
        limit: CONFIG.MAX_PAGINATION_LIMIT 
      });
      break;
    }
    
    const batch = await withRetry(async () => {
      return await suiClient.getOwnedObjects({
        owner: walletAddress,
        cursor: cursor || undefined,
        options: {
          showContent: true,
          showType: true,
          showDisplay: true,
        }
      }) as SuiOwnedObjectsResponse;
    });
    
    allObjects.push(...batch.data);
    cursor = batch.nextCursor;
    paginationCount++;
    
    // Rate limiting
    if (cursor) {
      await delay(CONFIG.RATE_LIMIT_DELAY);
    }
    
    log('debug', 'Fetched batch of owned objects', { 
      walletAddress,
      batchSize: batch.data.length, 
      totalSoFar: allObjects.length 
    });
  } while (cursor);
  
  log('info', 'All owned objects fetched', { 
    walletAddress,
    totalObjects: allObjects.length 
  });
  
  return allObjects;
}

/**
 * Filters NFTs from owned objects
 */
function filterNFTsFromObjects(objects: SuiObjectData[]): NFTInfo[] {
  const nfts: NFTInfo[] = [];
  
  for (const obj of objects) {
    if (isNFTObject(obj)) {
      log('debug', 'Found potential NFT', { 
        objectId: obj.objectId, 
        type: obj.type 
      });
      
      nfts.push({
        id: obj.objectId,
        type: obj.type || 'unknown',
        display: obj.display?.data,
        kioskId: 'direct_ownership' // Mark as directly owned
      });
    }
  }
  
  return nfts;
}

/**
 * Enhanced function that combines both kiosk and direct ownership methods
 * @param walletAddress - The wallet address to search for NFTs
 * @returns Promise resolving to array of unique NFTInfo objects
 * @throws ValidationError if wallet address is invalid
 * @throws KioskDiscoveryError if enhanced NFT search fails
 */
export async function getAllUserNFTsEnhanced(walletAddress: string): Promise<NFTInfo[]> {
  // Input validation
  if (!isValidWalletAddress(walletAddress)) {
    throw new ValidationError('Invalid wallet address format', 'walletAddress');
  }

  log('info', 'Enhanced NFT discovery started', { walletAddress });
  
  try {
    // Run both methods in parallel for better performance
    const [kioskNFTs, directNFTs] = await Promise.all([
      getAllUserNFTs(walletAddress).catch(error => {
        log('warn', 'Kiosk NFT fetching failed, continuing with direct search', {
          walletAddress,
          error: error instanceof Error ? error.message : String(error)
        });
        return [];
      }),
      findNFTsDirectly(walletAddress).catch(error => {
        log('warn', 'Direct NFT search failed, continuing with kiosk search', {
          walletAddress,
          error: error instanceof Error ? error.message : String(error)
        });
        return [];
      })
    ]);
    
    log('info', 'Both NFT search methods completed', { 
      walletAddress,
      kioskNFTs: kioskNFTs.length,
      directNFTs: directNFTs.length 
    });
    
    // Combine and deduplicate
    const allNFTs = [...kioskNFTs];
    const kioskNFTIds = new Set(kioskNFTs.map(nft => nft.id));
    
    for (const directNFT of directNFTs) {
      if (!kioskNFTIds.has(directNFT.id)) {
        allNFTs.push(directNFT);
      }
    }
    
    log('info', 'Enhanced NFT discovery completed', { 
      walletAddress,
      totalUniqueNFTs: allNFTs.length 
    });
    
    return allNFTs;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log('error', 'Enhanced NFT discovery failed', { walletAddress, error: errorMessage });
    throw new KioskDiscoveryError(
      `Enhanced NFT discovery failed: ${errorMessage}`,
      'ENHANCED_NFT_DISCOVERY_FAILED',
      { walletAddress }
    );
  }
}

// Bulk NFT Transfer System
// Use a workaround for the package exports issue
let Transaction: any;

// Try to load the Transaction class with error handling
if (typeof window !== 'undefined') {
  // Browser environment - use dynamic import
  (async () => {
    try {
      const txModule = await import('@mysten/sui/transactions');
      Transaction = txModule.Transaction;
    } catch (error) {
      console.warn('Failed to load @mysten/sui/transactions:', error);
    }
  })();
} else {
  // Node.js environment - use require
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const txModule = require('@mysten/sui/transactions');
    Transaction = txModule.Transaction;
  } catch (error) {
    console.warn('Failed to load @mysten/sui/transactions:', error);
  }
}

// Fallback implementation
if (!Transaction) {
  Transaction = class {
    constructor() {
      throw new Error('Transaction class not properly loaded - please refresh the page');
    }
  };
}

// Bulk transfer configuration
const BULK_TRANSFER_CONFIG = {
  MAX_RECIPIENTS: 100,
  BATCH_SIZE: 10, // Process recipients in batches
  DELAY_BETWEEN_BATCHES: 2000, // 2 seconds between batches
  DELAY_BETWEEN_TRANSFERS: 500, // 500ms between individual transfers
} as const;

// Bulk transfer interfaces
export interface BulkTransferRecipient {
  walletAddress: string;
  kioskId?: string;
  ownerCapId?: string;
  hasKiosk: boolean;
  status: 'pending' | 'processing' | 'success' | 'failed';
  error?: string;
}

export interface BulkTransferResult {
  totalRecipients: number;
  successful: number;
  failed: number;
  recipients: BulkTransferRecipient[];
  transactionDigests: string[];
  errors: string[];
}

export interface NFTSelection {
  type: string;
  availableCount: number;
  selectedCount: number;
  nftIds: string[];
}

// Utility functions for bulk transfers
function parseWalletAddresses(input: string): string[] {
  const addresses = input
    .split(',')
    .map(addr => addr.trim())
    .filter(addr => addr.length > 0);
  
  // Validate addresses
  const validAddresses = addresses.filter(addr => isValidWalletAddress(addr));
  const invalidAddresses = addresses.filter(addr => !isValidWalletAddress(addr));
  
  if (invalidAddresses.length > 0) {
    log('warn', 'Invalid wallet addresses found', { invalidAddresses });
  }
  
  if (validAddresses.length > BULK_TRANSFER_CONFIG.MAX_RECIPIENTS) {
    throw new ValidationError(
      `Too many recipients. Maximum allowed: ${BULK_TRANSFER_CONFIG.MAX_RECIPIENTS}`,
      'recipients'
    );
  }
  
  return validAddresses;
}

/**
 * Gets available NFT types from user's collection with counts
 * @param walletAddress - The wallet address to get NFT types for
 * @returns Promise resolving to array of NFTSelection objects
 */
export async function getAvailableNFTTypes(walletAddress: string): Promise<NFTSelection[]> {
  // Input validation
  if (!isValidWalletAddress(walletAddress)) {
    throw new ValidationError('Invalid wallet address format', 'walletAddress');
  }

  log('info', 'Getting available NFT types', { walletAddress });
  
  try {
    const nfts = await getAllUserNFTsEnhanced(walletAddress);
    
    // Group NFTs by type
    const nftGroups = new Map<string, NFTInfo[]>();
    for (const nft of nfts) {
      if (!nftGroups.has(nft.type)) {
        nftGroups.set(nft.type, []);
      }
      nftGroups.get(nft.type)!.push(nft);
    }
    
    // Convert to NFTSelection objects
    const selections: NFTSelection[] = [];
    for (const [type, nftList] of nftGroups) {
      selections.push({
        type,
        availableCount: nftList.length,
        selectedCount: 0,
        nftIds: nftList.map(nft => nft.id)
      });
    }
    
    log('info', 'Available NFT types retrieved', { 
      walletAddress,
      typesFound: selections.length 
    });
    
    return selections;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log('error', 'Failed to get available NFT types', { walletAddress, error: errorMessage });
    throw new KioskDiscoveryError(
      `Failed to get available NFT types: ${errorMessage}`,
      'NFT_TYPES_FETCH_FAILED',
      { walletAddress }
    );
  }
}

/**
 * Prepares recipients for bulk transfer by discovering/creating kiosks
 * @param walletAddresses - Array of wallet addresses
 * @returns Promise resolving to array of BulkTransferRecipient objects
 */
export async function prepareBulkTransferRecipients(walletAddresses: string[]): Promise<BulkTransferRecipient[]> {
  log('info', 'Preparing bulk transfer recipients', { recipientCount: walletAddresses.length });
  
  const recipients: BulkTransferRecipient[] = [];
  
  // Process recipients in batches to avoid overwhelming the API
  for (let i = 0; i < walletAddresses.length; i += BULK_TRANSFER_CONFIG.BATCH_SIZE) {
    const batch = walletAddresses.slice(i, i + BULK_TRANSFER_CONFIG.BATCH_SIZE);
    
    const batchPromises = batch.map(async (walletAddress) => {
      try {
        const kiosks = await getUserKiosks(walletAddress);
        const hasKiosk = kiosks.length > 0;
        
        return {
          walletAddress,
          kioskId: hasKiosk ? kiosks[0].id : undefined,
          ownerCapId: hasKiosk ? kiosks[0].ownerCapId : undefined,
          hasKiosk,
          status: 'pending' as const
        };
      } catch (error) {
        log('warn', 'Failed to prepare recipient', {
          walletAddress,
          error: error instanceof Error ? error.message : String(error)
        });
        
        return {
          walletAddress,
          hasKiosk: false,
          status: 'failed' as const,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    recipients.push(...batchResults);
    
    // Rate limiting between batches
    if (i + BULK_TRANSFER_CONFIG.BATCH_SIZE < walletAddresses.length) {
      await delay(BULK_TRANSFER_CONFIG.DELAY_BETWEEN_BATCHES);
    }
  }
  
  log('info', 'Recipients prepared', { 
    totalRecipients: recipients.length,
    withKiosks: recipients.filter(r => r.hasKiosk).length,
    withoutKiosks: recipients.filter(r => !r.hasKiosk).length
  });
  
  return recipients;
}

/**
 * Creates a transaction for transferring NFTs to multiple recipients
 * @param senderWalletAddress - The sender's wallet address
 * @param recipients - Array of prepared recipients
 * @param nftType - The NFT type to transfer
 * @param nftIds - Array of NFT IDs to transfer (one per recipient)
 * @returns Promise resolving to Transaction object
 */
export function createBulkTransferTransaction(
  senderWalletAddress: string,
  recipients: BulkTransferRecipient[],
  nftType: string,
  nftIds: string[]
): any {
  if (!isValidWalletAddress(senderWalletAddress)) {
    throw new ValidationError('Invalid sender wallet address format', 'senderWalletAddress');
  }
  
  if (recipients.length !== nftIds.length) {
    throw new ValidationError('Recipients count must match NFT IDs count', 'recipients');
  }
  
  log('info', 'Creating bulk transfer transaction', { 
    senderWalletAddress,
    recipientCount: recipients.length,
    nftType 
  });
  
  const txb = new (Transaction as any)();
  
  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i];
    const nftId = nftIds[i];
    
    if (recipient.status !== 'pending') {
      continue; // Skip failed recipients
    }
    
    try {
      if (recipient.hasKiosk && recipient.kioskId && recipient.ownerCapId) {
        // Transfer to existing kiosk
        txb.moveCall({
          target: '0x2::kiosk::place',
          arguments: [
            txb.object(recipient.kioskId),
            txb.object(recipient.ownerCapId),
            txb.object(nftId)
          ],
          typeArguments: [nftType]
        });
        
        log('debug', 'Added transfer to existing kiosk', {
          recipient: recipient.walletAddress,
          kioskId: recipient.kioskId,
          nftId
        });
      } else {
        // Create new kiosk and transfer
        const [kiosk, ownerCap] = txb.moveCall({
          target: '0x2::kiosk::new',
          arguments: [],
        });
        
        // Transfer owner cap to recipient
        txb.transferObjects([ownerCap], recipient.walletAddress);
        
        // Place NFT in the new kiosk
        txb.moveCall({
          target: '0x2::kiosk::place',
          arguments: [kiosk, ownerCap, txb.object(nftId)],
          typeArguments: [nftType]
        });
        
        log('debug', 'Added transfer to new kiosk', {
          recipient: recipient.walletAddress,
          nftId
        });
      }
    } catch (error) {
      log('error', 'Failed to add transfer to transaction', {
        recipient: recipient.walletAddress,
        nftId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      recipient.status = 'failed';
      recipient.error = error instanceof Error ? error.message : String(error);
    }
  }
  
  log('info', 'Bulk transfer transaction created', { 
    totalTransfers: recipients.filter(r => r.status === 'pending').length 
  });
  
  return txb;
}

/**
 * Main function for bulk NFT transfer
 * @param senderWalletAddress - The sender's wallet address
 * @param recipientAddressesInput - Comma-separated wallet addresses
 * @param nftType - The NFT type to transfer
 * @returns Promise resolving to BulkTransferResult
 */
export async function bulkTransferNFTs(
  senderWalletAddress: string,
  recipientAddressesInput: string,
  nftType: string
): Promise<BulkTransferResult> {
  // Input validation
  if (!isValidWalletAddress(senderWalletAddress)) {
    throw new ValidationError('Invalid sender wallet address format', 'senderWalletAddress');
  }
  
  if (!nftType || nftType.trim().length === 0) {
    throw new ValidationError('NFT type is required', 'nftType');
  }
  
  if (!recipientAddressesInput || recipientAddressesInput.trim().length === 0) {
    throw new ValidationError('Recipient addresses are required', 'recipientAddresses');
  }
  
  log('info', 'Starting bulk NFT transfer', { 
    senderWalletAddress,
    nftType,
    recipientInput: recipientAddressesInput.substring(0, 100) + '...' // Log first 100 chars
  });
  
  try {
    // Parse recipient addresses
    const recipientAddresses = parseWalletAddresses(recipientAddressesInput);
    
    if (recipientAddresses.length === 0) {
      throw new ValidationError('No valid recipient addresses found', 'recipientAddresses');
    }
    
    // Get available NFTs of the specified type
    const nftSelections = await getAvailableNFTTypes(senderWalletAddress);
    const selectedNFTType = nftSelections.find(selection => selection.type === nftType);
    
    if (!selectedNFTType) {
      throw new ValidationError(`NFT type '${nftType}' not found in sender's collection`, 'nftType');
    }
    
    if (selectedNFTType.availableCount < recipientAddresses.length) {
      throw new ValidationError(
        `Not enough NFTs available. Required: ${recipientAddresses.length}, Available: ${selectedNFTType.availableCount}`,
        'nftCount'
      );
    }
    
    // Prepare recipients
    const recipients = await prepareBulkTransferRecipients(recipientAddresses);
    
    // Select NFTs to transfer (first N NFTs of the specified type)
    const nftsToTransfer = selectedNFTType.nftIds.slice(0, recipients.length);
    
    // Create transaction
    const transaction = createBulkTransferTransaction(
      senderWalletAddress,
      recipients,
      nftType,
      nftsToTransfer
    );
    
    // Execute transaction (this would need to be implemented with wallet signing)
    // For now, we'll return the prepared transaction
    const result: BulkTransferResult = {
      totalRecipients: recipients.length,
      successful: recipients.filter(r => r.status === 'pending').length,
      failed: recipients.filter(r => r.status === 'failed').length,
      recipients,
      transactionDigests: [], // Would be populated after transaction execution
      errors: recipients.filter(r => r.error).map(r => r.error!)
    };
    
    log('info', 'Bulk transfer prepared', { 
      totalRecipients: result.totalRecipients,
      successful: result.successful,
      failed: result.failed 
    });
    
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log('error', 'Bulk transfer failed', { 
      senderWalletAddress,
      nftType,
      error: errorMessage 
    });
    
    throw new KioskDiscoveryError(
      `Bulk transfer failed: ${errorMessage}`,
      'BULK_TRANSFER_FAILED',
      { senderWalletAddress, nftType }
    );
  }
}

/**
 * Helper function to validate bulk transfer parameters
 * @param senderWalletAddress - The sender's wallet address
 * @param recipientAddressesInput - Comma-separated wallet addresses
 * @param nftType - The NFT type to transfer
 * @returns Promise resolving to validation result
 */
export async function validateBulkTransfer(
  senderWalletAddress: string,
  recipientAddressesInput: string,
  nftType: string
): Promise<{
  isValid: boolean;
  errors: string[];
  warnings: string[];
  recipientCount: number;
  availableNFTs: number;
}> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    // Validate sender address
    if (!isValidWalletAddress(senderWalletAddress)) {
      errors.push('Invalid sender wallet address format');
    }
    
    // Validate NFT type
    if (!nftType || nftType.trim().length === 0) {
      errors.push('NFT type is required');
    }
    
    // Validate recipient addresses
    if (!recipientAddressesInput || recipientAddressesInput.trim().length === 0) {
      errors.push('Recipient addresses are required');
    } else {
      try {
        const recipientAddresses = parseWalletAddresses(recipientAddressesInput);
        
        if (recipientAddresses.length === 0) {
          errors.push('No valid recipient addresses found');
        } else if (recipientAddresses.length > BULK_TRANSFER_CONFIG.MAX_RECIPIENTS) {
          errors.push(`Too many recipients. Maximum allowed: ${BULK_TRANSFER_CONFIG.MAX_RECIPIENTS}`);
        }
        
        // Check NFT availability if sender and NFT type are valid
        if (errors.length === 0 && isValidWalletAddress(senderWalletAddress) && nftType) {
          try {
            const nftSelections = await getAvailableNFTTypes(senderWalletAddress);
            const selectedNFTType = nftSelections.find(selection => selection.type === nftType);
            
            if (!selectedNFTType) {
              errors.push(`NFT type '${nftType}' not found in sender's collection`);
            } else if (selectedNFTType.availableCount < recipientAddresses.length) {
              errors.push(
                `Not enough NFTs available. Required: ${recipientAddresses.length}, Available: ${selectedNFTType.availableCount}`
              );
            }
            
            return {
              isValid: errors.length === 0,
              errors,
              warnings,
              recipientCount: recipientAddresses.length,
              availableNFTs: selectedNFTType?.availableCount || 0
            };
          } catch (nftError) {
            warnings.push(`Could not verify NFT availability: ${nftError instanceof Error ? nftError.message : String(nftError)}`);
          }
        }
        
        return {
          isValid: errors.length === 0,
          errors,
          warnings,
          recipientCount: recipientAddresses.length,
          availableNFTs: 0
        };
      } catch (parseError) {
        errors.push(`Invalid recipient addresses format: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      recipientCount: 0,
      availableNFTs: 0
    };
  } catch (error) {
    errors.push(`Validation failed: ${error instanceof Error ? error.message : String(error)}`);
    return {
      isValid: false,
      errors,
      warnings,
      recipientCount: 0,
      availableNFTs: 0
    };
  }
}

/**
 * Test function to verify SuiClient is working
 * @param walletAddress - Wallet address to test with
 * @returns Promise resolving to test result
 */
export async function testSuiClient(walletAddress: string): Promise<{
  isWorking: boolean;
  error?: string;
  clientInfo?: any;
}> {
  try {
    log('info', 'Testing SuiClient connection', { walletAddress });
    
    // Use the simple client test function
    const testResult = await testSuiClientConnection(walletAddress);
    
    if (testResult.isWorking) {
      log('info', 'SuiClient test successful', { 
        walletAddress,
        network: testResult.network
      });
      
      return {
        isWorking: true,
        clientInfo: {
          network: testResult.network,
          status: 'connected'
        }
      };
    } else {
      log('error', 'SuiClient test failed', { 
        walletAddress, 
        error: testResult.error 
      });
      
      return {
        isWorking: false,
        error: testResult.error
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('error', 'SuiClient test failed', { walletAddress, error: errorMessage });
    
    return {
      isWorking: false,
      error: errorMessage
    };
  }
}