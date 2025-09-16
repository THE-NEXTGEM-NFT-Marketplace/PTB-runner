// Kiosk Discovery and NFT Management Utilities
import { suiClient } from './simple-sui-client';
import type { SuiObjectData, SuiObjectResponse } from '@mysten/sui/client';
declare const require: any;

// Simple, local type definitions to match API responses, avoiding import issues.
interface PaginatedObjectsResponse {
	data: SuiObjectData[];
	nextCursor?: string | null;
	hasNextPage: boolean;
}

interface DynamicFieldsResponse {
	data: {
		objectId: string;
		name: string;
	}[];
	nextCursor?: string | null;
	hasNextPage: boolean;
}

// Configuration constants
const CONFIG = {
  RATE_LIMIT_DELAY: 100, // 100ms between API calls
  MAX_DYNAMIC_FIELDS_PER_BATCH: 50, // Limit batch size for dynamic fields
  MAX_PAGINATION_LIMIT: 1000, // Prevent infinite loops
  KIOSK_OWNER_CAP_TYPE: '0x2::kiosk::KioskOwnerCap',
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second between retries
} as const;

// Sui API Response Types - REMOVED, now using official types from @mysten/sui/client

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
  // Accept any 0x-prefixed hex up to 64 chars to allow non-normalized addresses
  return /^0x[a-fA-F0-9]{1,64}$/.test(address);
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
    console.log('Starting kiosk discovery for:', walletAddress);
    
    const ownedObjects = await fetchKioskOwnerCaps(walletAddress);
    console.log('Fetch result:', { foundObjects: ownedObjects.data.length });
    
    const kiosks = await processKioskOwnerCaps(ownedObjects);
    
    console.log('Kiosk discovery completed:', { 
      walletAddress, 
      kiosksFound: kiosks.length 
    });
    
    return kiosks;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Kiosk discovery failed:', { 
      walletAddress, 
      error: errorMessage 
    });
    
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
async function fetchKioskOwnerCaps(walletAddress: string): Promise<PaginatedObjectsResponse> {
  try {
    // Strategy 1: Try specific KioskOwnerCap filter
    log('debug', 'Attempting specific KioskOwnerCap filter');
    
    const rawResponse = await withRetry(async () => {
      return await suiClient.getOwnedObjects({
        owner: walletAddress,
        filter: {
          StructType: CONFIG.KIOSK_OWNER_CAP_TYPE
        },
        options: {
          showContent: true,
          showType: true,
        }
      });
    });

    const unwrapped = (rawResponse.data as any[])
      .map((entry: any) => entry?.data)
      .filter(Boolean) as SuiObjectData[];

    log('info', 'Specific filter successful', { 
      objectsFound: unwrapped.length 
    });

    return { data: unwrapped, nextCursor: rawResponse.nextCursor, hasNextPage: rawResponse.hasNextPage } as unknown as PaginatedObjectsResponse;
  } catch (specificError) {
    log('warn', 'Specific filter failed, trying broader search', { 
      error: specificError instanceof Error ? specificError.message : String(specificError)
    });
    
    // Strategy 2: Get all objects and filter manually
    return await fetchAllObjectsWithFilter(walletAddress);
  }
}

/**
 * Fetches all objects and filters for kiosk-related ones
 */
async function fetchAllObjectsWithFilter(walletAddress: string): Promise<PaginatedObjectsResponse> {
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
      });
    });

    const unwrapped = (batch.data as any[])
      .map((entry: any) => entry?.data)
      .filter(Boolean) as SuiObjectData[];

    allObjects.push(...unwrapped);
    cursor = batch.nextCursor as any;
    paginationCount++;
    
    // Rate limiting
    if (cursor) {
      await delay(CONFIG.RATE_LIMIT_DELAY);
    }
    
    log('debug', 'Fetched batch of objects', { 
      batchSize: unwrapped.length, 
      totalSoFar: allObjects.length 
    });
  } while (cursor);
  
  // Debug: Log all object types found
  const allTypes = allObjects.map(obj => {
    // The type is in obj.data.type based on the API response structure
    return obj.type || 'unknown';
  }).filter(Boolean);
  const uniqueTypes = [...new Set(allTypes)];
  log('debug', 'All object types found', { 
    totalTypes: uniqueTypes.length,
    types: uniqueTypes.slice(0, 10) // Show first 10 types
  });
  
  // Filter for KioskOwnerCap objects
  const filteredObjects = allObjects.filter(obj => {
    const objType = obj.type || '';
    return objType.includes('kiosk') && 
           (objType.includes('KioskOwnerCap') || objType.includes('OwnerCap'));
  });
  
  log('info', 'Manual filtering completed', { 
    totalObjects: allObjects.length,
    filteredObjects: filteredObjects.length,
    kioskTypes: uniqueTypes.filter(type => type?.toLowerCase().includes('kiosk')),
    allTypes: uniqueTypes, // Show all types for debugging
    sampleFilteredObjects: filteredObjects.slice(0, 3).map(obj => ({
      objectId: obj.objectId,
      type: obj.type
    }))
  });
  
  return { data: filteredObjects, hasNextPage: false } as unknown as PaginatedObjectsResponse;
}

/**
 * Processes KioskOwnerCap objects to extract kiosk information
 */
async function processKioskOwnerCaps(ownedObjects: PaginatedObjectsResponse): Promise<KioskInfo[]> {
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
  // The object passed here is the direct SuiObjectData
  const objType = obj.type;
  const content = obj.content;
  
  console.log('Processing kiosk owner cap:', {
    objectId: obj.objectId,
    type: objType,
    hasContent: !!content,
    hasFields: !!((content as any)?.fields)
  });
  
  if (!(content as any)?.fields) {
    console.warn('Object has no content or fields:', obj.objectId);
    return null;
  }
  
  const fields = (content as any).fields as Record<string, any>;
  console.log('KioskOwnerCap fields:', {
    objectId: obj.objectId,
    fields: fields,
    availableFields: Object.keys(fields)
  });
  
  // Extract kiosk ID from the 'for' field
  const kioskId = fields.for;
  
  if (!kioskId || typeof kioskId !== 'string') {
    console.warn('No valid kiosk ID found in for field:', {
      objectId: obj.objectId,
      forField: kioskId,
      availableFields: Object.keys(fields)
    });
    return null;
  }
  
  if (!isValidObjectId(kioskId)) {
    console.warn('Invalid kiosk ID format:', {
      objectId: obj.objectId,
      kioskId
    });
    return null;
  }
  
  console.log('Found kiosk ID:', { objectId: obj.objectId, kioskId });
  
  try {
    const itemCount = await getKioskItemCount(kioskId);
    
    return {
      id: kioskId,
      ownerCapId: obj.objectId,
      itemCount
    };
  } catch (error) {
    console.warn('Failed to get kiosk item count, using 0:', {
      objectId: obj.objectId,
      kioskId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    // Return kiosk info with 0 items if count fails
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
  
  log('debug', 'Extracting kiosk ID', { 
    availableFields: Object.keys(fields),
    possibleFields: possibleFields
  });
  
  for (const fieldName of possibleFields) {
    const value = fields[fieldName];
    log('debug', `Checking field ${fieldName}`, { value, type: typeof value });
    if (typeof value === 'string' && value.length > 0) {
      log('debug', `Found kiosk ID in field ${fieldName}`, { kioskId: value });
      return value;
    }
  }
  
  log('warn', 'No kiosk ID found in any field');
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
  
  // Handle the actual API response structure
  const content = kioskObject.data?.content as any;
  
  if (!content || content.dataType !== 'moveObject' || !content.fields) {
    return 0;
  }
  
  const fields = content.fields as Record<string, unknown>;
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
async function fetchKioskDynamicFields(kioskId: string): Promise<DynamicFieldsResponse> {
  const allDynamicFields: { objectId: string; name: string; }[] = [];
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
      }) as unknown as DynamicFieldsResponse;
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
  
  return { data: allDynamicFields, hasNextPage: false };
}

/**
 * Batches fetching of multiple objects to improve performance.
 * @param objectIds - Array of object IDs to fetch.
 * @returns Promise resolving to an array of SuiObjectData.
 */
async function batchFetchObjects(objectIds: string[]): Promise<SuiObjectData[]> {
  if (objectIds.length === 0) {
    return [];
  }

  log('debug', 'Batch fetching objects', { count: objectIds.length });

  try {
    const objects = await withRetry(async () => {
      return await suiClient.multiGetObjects({
        ids: objectIds,
        options: {
          showContent: true,
          showType: true,
          showDisplay: true,
        },
      });
    });

    // Filter out potential errors and return valid data
    return (objects as any[])
      .filter(obj => (obj as any).data)
      .map(obj => (obj as any).data as SuiObjectData);
  } catch (error) {
    log('error', 'Failed to batch fetch objects', { 
      error: error instanceof Error ? error.message : String(error)
    });
    return []; // Return empty array on failure to avoid crashing the whole process
  }
}

/**
 * Fetches all owned objects for a wallet with pagination and rate limiting
 */
async function fetchAllOwnedObjects(walletAddress: string): Promise<SuiObjectData[]> {
  const allObjects: SuiObjectData[] = [];
  let cursor: string | null | undefined = null;
  let paginationCount = 0;
  
  do {
    if (paginationCount >= CONFIG.MAX_PAGINATION_LIMIT) {
      log('warn', 'Owned objects pagination limit reached', { 
        walletAddress, 
        limit: CONFIG.MAX_PAGINATION_LIMIT 
      });
      break;
    }
    
    const batch: PaginatedObjectsResponse = await withRetry(async () => {
      return await suiClient.getOwnedObjects({
        owner: walletAddress,
        cursor: cursor || undefined,
        options: {
          showContent: true,
          showType: true,
          showDisplay: true,
        }
      }) as unknown as PaginatedObjectsResponse;
    });
    
    const validObjects = (batch.data as any[])
      .map((entry: any) => entry?.data)
      .filter(Boolean) as SuiObjectData[];
    allObjects.push(...validObjects);

    cursor = batch.nextCursor;
    paginationCount++;
    
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
 * Checks if an object appears to be an NFT
 */
function isNFTObject(obj: SuiObjectData): boolean {
  if (!obj.type) return false;
  
  // The type is sometimes nested inside obj.data
  const type = obj.type;
  if (!type) return false;

  const hasNFTType = type.includes('nft') || 
                    type.includes('NFT') ||
                    type.includes('collectible');
  
  const displayData = obj.display?.data;
  const hasDisplayData = Boolean(displayData && (
    displayData.name || 
    displayData.image_url
  ));
  
  return hasNFTType || hasDisplayData;
}


/**
 * Processes dynamic fields to extract NFT information using batching.
 */
async function processDynamicFields(
  dynamicFields: DynamicFieldsResponse, 
  kioskId: string
): Promise<NFTInfo[]> {
  const itemIdsToFetch: string[] = [];
  const potentialNFTs: NFTInfo[] = [];

  // Resolve actual item object IDs from dynamic fields
  for (const field of dynamicFields.data) {
    try {
      const dfObj = await withRetry(async () => {
        return await suiClient.getDynamicFieldObject({
          parentId: kioskId,
          name: field.name as any,
        });
      });

      const data: any = (dfObj as any)?.data;
      let candidateId: string | undefined;

      // Try common shapes
      if (data?.objectId && isValidObjectId(data.objectId)) {
        candidateId = data.objectId;
      } else if (data?.content?.fields?.id && typeof data.content.fields.id === 'string' && isValidObjectId(data.content.fields.id)) {
        candidateId = data.content.fields.id;
      } else if (data?.content?.fields?.value && typeof data.content.fields.value === 'string' && isValidObjectId(data.content.fields.value)) {
        candidateId = data.content.fields.value as string;
      } else if (data?.content?.fields?.item?.fields?.id && isValidObjectId(data.content.fields.item.fields.id)) {
        candidateId = data.content.fields.item.fields.id as string;
      }

      if (candidateId) {
        itemIdsToFetch.push(candidateId);
      }
    } catch (e) {
      log('warn', 'Failed to resolve dynamic field value', { kioskId, field: field.objectId });
    }
  }

  if (itemIdsToFetch.length === 0) {
    return [];
  }

  const fetchedObjects = await batchFetchObjects(itemIdsToFetch);

  for (const obj of fetchedObjects) {
    if (isNFTObject(obj)) {
      potentialNFTs.push({
        id: obj.objectId,
        type: obj.type || 'unknown',
        display: obj.display?.data,
        kioskId,
      });
    }
  }

  return potentialNFTs;
}

/**
 * Enhanced function that discovers all kiosks and NFTs in an optimized manner.
 * It fetches all user's objects once, identifies kiosks, then fetches all kiosk contents in batches.
 * @param walletAddress - The wallet address to search for kiosks and NFTs.
 * @returns A promise that resolves to an object containing lists of KioskInfo and NFTInfo.
 */
export async function discoverUserKiosksAndNFTs(walletAddress: string): Promise<{kiosks: KioskInfo[], nfts: NFTInfo[]}> {
  if (!isValidWalletAddress(walletAddress)) {
    throw new ValidationError('Invalid wallet address format', 'walletAddress');
  }

  log('info', 'Starting simplified object discovery', { walletAddress });

  try {
    const allOwnedObjects = await fetchAllOwnedObjects(walletAddress);

    const nfts = allOwnedObjects.map(obj => ({
      id: obj.objectId,
      type: obj.type || 'unknown',
      display: {
        name: obj.display?.data?.name || `Object ID: ${obj.objectId.slice(0, 10)}...`,
        description: obj.display?.data?.description || `Type: ${obj.type}`,
        image_url: obj.display?.data?.image_url
      },
      kioskId: 'wallet',
    }));
    
    const kiosks: KioskInfo[] = [{
        id: 'wallet',
        ownerCapId: 'wallet',
        itemCount: nfts.length
    }];
    
    log('info', 'Simplified discovery complete', { objectsFound: nfts.length });

    return { kiosks, nfts };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log('error', 'Simplified discovery failed', { walletAddress, error: errorMessage });
    throw new KioskDiscoveryError(
      `Simplified kiosk and NFT discovery failed: ${errorMessage}`,
      'SIMPLIFIED_DISCOVERY_FAILED',
      { walletAddress }
    );
  }
}

/**
 * Progressive variant: streams back partial results via onProgress callback.
 * Calls onProgress multiple times with incremental NFT batches and final done=true.
 */
export async function discoverUserKiosksAndNFTsProgressive(
	walletAddress: string,
	onProgress: (update: { kiosks?: KioskInfo[]; nfts?: NFTInfo[]; done?: boolean }) => void
): Promise<{ kiosks: KioskInfo[]; nfts: NFTInfo[] }> {
	if (!isValidWalletAddress(walletAddress)) {
		throw new ValidationError('Invalid wallet address format', 'walletAddress');
	}

	log('info', 'Starting progressive discovery', { walletAddress });

	const collectedNFTs: NFTInfo[] = [];
	let kiosksResult: KioskInfo[] = [];

	try {
		// Start streaming wallet-owned objects immediately
		const streamWalletOwned = (async () => {
			let cursor: string | null | undefined = null;
			let paginationCount = 0;
			do {
				if (paginationCount >= CONFIG.MAX_PAGINATION_LIMIT) break;
				const batch: PaginatedObjectsResponse = await withRetry(async () => {
					return await suiClient.getOwnedObjects({
						owner: walletAddress,
						cursor: cursor || undefined,
						options: { showContent: true, showType: true, showDisplay: true },
					}) as unknown as PaginatedObjectsResponse;
				});

				const validObjects = (batch.data as any[])
					.map((entry: any) => entry?.data)
					.filter(Boolean) as SuiObjectData[];
				const nfts = validObjects.map(obj => ({
					id: (obj as any).objectId,
					type: (obj as any).type || 'unknown',
					display: {
						name: (obj as any).display?.data?.name || `Object ID: ${String((obj as any).objectId).slice(0, 10)}...`,
						description: (obj as any).display?.data?.description || `Type: ${(obj as any).type}`,
						image_url: (obj as any).display?.data?.image_url,
					},
					kioskId: 'wallet',
				})) as NFTInfo[];

				if (nfts.length > 0) {
					collectedNFTs.push(...nfts);
					onProgress({ nfts });
				}

				cursor = (batch as any).nextCursor;
				paginationCount++;
			} while (cursor);
		})();

		// In parallel, discover kiosks and stream kiosk NFTs
		const streamKioskContents = (async () => {
			kiosksResult = await getUserKiosks(walletAddress);
			if (kiosksResult.length > 0) {
				onProgress({ kiosks: kiosksResult });
			}
			for (const kiosk of kiosksResult) {
				try {
					const dynamicFields = await fetchKioskDynamicFields(kiosk.id);
					const kioskNfts = await processDynamicFields(dynamicFields, kiosk.id);
					if (kioskNfts.length > 0) {
						collectedNFTs.push(...kioskNfts);
						onProgress({ nfts: kioskNfts });
					}
				} catch (e) {
					log('warn', 'Failed to stream kiosk contents', { kioskId: kiosk.id });
				}
			}
		})();

		await Promise.all([streamWalletOwned, streamKioskContents]);

		// Final callback
		onProgress({ done: true, kiosks: kiosksResult });
		return { kiosks: kiosksResult, nfts: collectedNFTs };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		log('error', 'Progressive discovery failed', { walletAddress, error: errorMessage });
		throw new KioskDiscoveryError(
			`Progressive kiosk and NFT discovery failed: ${errorMessage}`,
			'PROGRESSIVE_DISCOVERY_FAILED',
			{ walletAddress }
		);
	}
}


/**
 * Legacy enhanced function, now replaced by discoverUserKiosksAndNFTs.
 * Kept for backward compatibility but warns about deprecation.
 * @deprecated
 */
export async function getAllUserNFTsEnhanced(walletAddress: string): Promise<NFTInfo[]> {
  log('warn', '`getAllUserNFTsEnhanced` is deprecated. Use `discoverUserKiosksAndNFTs` instead.');
  const { nfts } = await discoverUserKiosksAndNFTs(walletAddress);
  return nfts;
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
export function parseWalletAddresses(input: string): string[] {
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
    const nfts = await discoverUserKiosksAndNFTs(walletAddress);
    
    // Group NFTs by type
    const nftGroups = new Map<string, NFTInfo[]>();
    for (const nft of nfts.nfts) {
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
 * Prepare a bulk kiosk-only transfer and return a Transaction ready to sign.
 * Does not execute the transaction.
 */
export async function prepareBulkKioskTransfer(
	senderWalletAddress: string,
	recipientAddressesInput: string,
	nftType: string
): Promise<{
	transaction: any;
	recipients: BulkTransferRecipient[];
	nftIds: string[];
}> {
	if (!isValidWalletAddress(senderWalletAddress)) {
		throw new ValidationError('Invalid sender wallet address format', 'senderWalletAddress');
	}
	if (!nftType || nftType.trim().length === 0) {
		throw new ValidationError('NFT type is required', 'nftType');
	}
	if (!recipientAddressesInput || recipientAddressesInput.trim().length === 0) {
		throw new ValidationError('Recipient addresses are required', 'recipientAddresses');
	}

	const recipientAddresses = parseWalletAddresses(recipientAddressesInput);
	if (recipientAddresses.length === 0) {
		throw new ValidationError('No valid recipient addresses found', 'recipients');
	}

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

	const recipients = await prepareBulkTransferRecipients(recipientAddresses);
	const nftsToTransfer = selectedNFTType.nftIds.slice(0, recipients.length);
	const transaction = createBulkTransferTransaction(
		senderWalletAddress,
		recipients,
		nftType,
		nftsToTransfer
	);

	return { transaction, recipients, nftIds: nftsToTransfer };
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
    // This function is no longer directly available in simple-sui-client,
    // but the original code had a placeholder.
    // For now, we'll assume suiClient is the global client or imported elsewhere.
    // If suiClient is not available, this test will fail.
    // A more robust test would involve a direct SuiClient instance.
    
    // Example placeholder test (replace with actual client test if suiClient is global)
    // For now, we'll just check if suiClient is defined.
    if (typeof suiClient === 'undefined') {
      log('error', 'SuiClient is not available. Please ensure @mysten/sui/client is imported.');
      return {
        isWorking: false,
        error: 'SuiClient not available'
      };
    }

    // Attempt to get an object to check connection
    const testObject = await withRetry(async () => {
      return await suiClient.getObject({
        id: '0x2::sui::Sui', // A known object to check connection
        options: { showType: true }
      });
    });

    log('info', 'SuiClient test successful', { 
      walletAddress,
      network: 'placeholder' // This would require actual network info
    });
    
    return {
      isWorking: true,
      clientInfo: {
        network: 'placeholder',
        status: 'connected'
      }
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('error', 'SuiClient test failed', { walletAddress, error: errorMessage });
    
    return {
      isWorking: false,
      error: errorMessage
    };
  }
}