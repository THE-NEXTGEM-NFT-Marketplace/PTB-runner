// Kiosk Discovery and NFT Management Utilities
import { suiClient } from './sui-client';
import { SuiObjectResponse, PaginatedObjectsResponse } from '@mysten/sui/client';

// Rate limiting configuration
const RATE_LIMIT_DELAY = 100; // 100ms between API calls
const MAX_DYNAMIC_FIELDS_PER_BATCH = 50; // Limit batch size for dynamic fields

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

// Discover user's kiosks by finding KioskOwnerCap objects
export async function getUserKiosks(walletAddress: string): Promise<KioskInfo[]> {
  console.log(`[getUserKiosks] Starting discovery for ${walletAddress}`);
  
  try {
    // Try multiple approaches to find kiosks
    let ownedObjects;
    
    // First try with specific KioskOwnerCap type
    try {
      console.log('[getUserKiosks] Trying specific KioskOwnerCap filter...');
      ownedObjects = await suiClient.getOwnedObjects({
        owner: walletAddress,
        filter: {
          StructType: '0x2::kiosk::KioskOwnerCap'
        },
        options: {
          showContent: true,
          showType: true,
        }
      });
      console.log(`[getUserKiosks] Found ${ownedObjects.data.length} objects with specific filter`);
    } catch (specificError) {
      console.log('[getUserKiosks] Specific filter failed, trying broader search...');
      // Fallback: get all objects and filter manually
      let allObjects: any[] = [];
      let cursor: string | null = null;
      
      do {
        const batch = await suiClient.getOwnedObjects({
          owner: walletAddress,
          cursor: cursor || undefined,
          options: {
            showContent: true,
            showType: true,
          }
        });
        allObjects.push(...batch.data);
        cursor = batch.nextCursor;
      } while (cursor);
      
      console.log(`[getUserKiosks] Found ${allObjects.length} total owned objects`);
      
      // Filter for KioskOwnerCap objects manually
      ownedObjects = {
        data: allObjects.filter(obj => 
          obj.data?.type?.includes('kiosk') && 
          (obj.data?.type?.includes('KioskOwnerCap') || obj.data?.type?.includes('OwnerCap'))
        )
      };
      console.log(`[getUserKiosks] Filtered to ${ownedObjects.data.length} kiosk-related objects`);
    }

    const kiosks: KioskInfo[] = [];
    
    for (const obj of ownedObjects.data) {
      console.log(`[getUserKiosks] Processing object: ${obj.data?.objectId}, type: ${obj.data?.type}`);
      
      if (obj.data?.content && 'fields' in obj.data.content) {
        const fields = obj.data.content.fields as any;
        console.log('[getUserKiosks] Object fields:', Object.keys(fields));
        
        // Try multiple field name variations
        const kioskId = fields.for || fields.kiosk_id || fields.kioskId || fields.kiosk || fields.id;
        
        if (kioskId) {
          console.log(`[getUserKiosks] Found kiosk ID: ${kioskId}`);
          
          try {
            // Get kiosk details to count items
            const kioskObject = await suiClient.getObject({
              id: kioskId,
              options: { showContent: true }
            });
            
            let itemCount = 0;
            if (kioskObject.data?.content && 'fields' in kioskObject.data.content) {
              const kioskFields = kioskObject.data.content.fields as any;
              itemCount = kioskFields.item_count || kioskFields.itemCount || kioskFields.items || 0;
              console.log(`[getUserKiosks] Kiosk ${kioskId} has ${itemCount} items`);
            }
            
            kiosks.push({
              id: kioskId,
              ownerCapId: obj.data.objectId,
              itemCount
            });
          } catch (kioskError) {
            console.error(`[getUserKiosks] Error fetching kiosk ${kioskId}:`, kioskError);
            // Still add the kiosk but with 0 items
            kiosks.push({
              id: kioskId,
              ownerCapId: obj.data.objectId,
              itemCount: 0
            });
          }
        } else {
          console.log('[getUserKiosks] No kiosk ID found in fields:', fields);
          console.log('[getUserKiosks] Available field names:', Object.keys(fields));
        }
      } else {
        console.log('[getUserKiosks] Object has no content or fields');
      }
    }
    
    console.log(`[getUserKiosks] Discovered ${kiosks.length} kiosks total`);
    return kiosks;
  } catch (error) {
    console.error('[getUserKiosks] Error fetching kiosks:', error);
    throw new Error(`Failed to fetch kiosks: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Get NFTs in a specific kiosk
export async function getKioskNFTs(kioskId: string): Promise<NFTInfo[]> {
  console.log(`[getKioskNFTs] Fetching NFTs for kiosk: ${kioskId}`);
  
  try {
    // Get dynamic fields with pagination support
    let allDynamicFields: any[] = [];
    let cursor: string | null = null;
    
    do {
      const dynamicFields = await suiClient.getDynamicFields({
        parentId: kioskId,
        cursor: cursor || undefined,
        limit: MAX_DYNAMIC_FIELDS_PER_BATCH, // Process in batches
      });
      
      // Rate limiting
      if (cursor) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
      }
      
      allDynamicFields.push(...dynamicFields.data);
      cursor = dynamicFields.nextCursor;
      
      console.log(`[getKioskNFTs] Batch: Found ${dynamicFields.data.length} dynamic fields, total so far: ${allDynamicFields.length}`);
    } while (cursor);
    
    console.log(`[getKioskNFTs] Total dynamic fields found: ${allDynamicFields.length}`);
    const nfts: NFTInfo[] = [];
    
    for (const field of allDynamicFields) {
      console.log(`[getKioskNFTs] Processing dynamic field: ${field.objectId}, name: ${field.name}`);
      
      try {
        const fieldObject = await suiClient.getObject({
          id: field.objectId,
          options: {
            showContent: true,
            showType: true,
            showDisplay: true,
          }
        });
        
        console.log(`[getKioskNFTs] Field object type: ${fieldObject.data?.type}`);
        
        // Check if this dynamic field is actually an NFT object directly
        if (fieldObject.data?.content && 'fields' in fieldObject.data.content) {
          const fields = fieldObject.data.content.fields as any;
          console.log(`[getKioskNFTs] Dynamic field ${field.objectId} fields:`, Object.keys(fields));
          
          // For kiosk items, the dynamic field might contain the NFT directly
          // or it might contain a reference to the NFT
          
          // First, check if this is a kiosk item wrapper
          if (fields.value) {
            console.log(`[getKioskNFTs] Found wrapper with value field: ${fields.value}`);
            
            try {
              // Get the actual NFT object
              const nftObject = await suiClient.getObject({
                id: fields.value,
                options: {
                  showContent: true,
                  showType: true,
                  showDisplay: true,
                }
              });
              
              if (nftObject.data && nftObject.data.type) {
                console.log(`[getKioskNFTs] Successfully fetched NFT via wrapper: ${fields.value}, type: ${nftObject.data.type}`);
                nfts.push({
                  id: fields.value,
                  type: nftObject.data.type,
                  display: nftObject.data.display?.data,
                  kioskId
                });
              }
            } catch (nftError) {
              console.error(`[getKioskNFTs] Error fetching NFT via wrapper ${fields.value}:`, nftError);
            }
          }
          // Check if this dynamic field object is itself an NFT
          else if (fieldObject.data?.type && 
                   (fieldObject.data.type.includes('nft') || 
                    fieldObject.data.type.includes('NFT') ||
                    fieldObject.data.display?.data)) {
            console.log(`[getKioskNFTs] Dynamic field ${field.objectId} appears to be NFT directly`);
            nfts.push({
              id: field.objectId,
              type: fieldObject.data.type,
              display: fieldObject.data.display?.data,
              kioskId
            });
          }
          // Try other common field names
          else {
            const itemId = fields.item_id || fields.itemId || fields.id || fields.item;
            if (itemId) {
              console.log(`[getKioskNFTs] Found item ID via other fields: ${itemId}`);
              
              try {
                const nftObject = await suiClient.getObject({
                  id: itemId,
                  options: {
                    showContent: true,
                    showType: true,
                    showDisplay: true,
                  }
                });
                
                if (nftObject.data && nftObject.data.type) {
                  console.log(`[getKioskNFTs] Successfully fetched NFT via item ID: ${itemId}, type: ${nftObject.data.type}`);
                  nfts.push({
                    id: itemId,
                    type: nftObject.data.type,
                    display: nftObject.data.display?.data,
                    kioskId
                  });
                }
              } catch (nftError) {
                console.error(`[getKioskNFTs] Error fetching NFT via item ID ${itemId}:`, nftError);
              }
            } else {
              console.log(`[getKioskNFTs] No recognizable NFT reference in dynamic field ${field.objectId}`);
              console.log(`[getKioskNFTs] Available fields:`, Object.keys(fields));
            }
          }
        } else {
          console.log(`[getKioskNFTs] Dynamic field ${field.objectId} has no content or fields`);
        }
      } catch (error) {
        console.error(`[getKioskNFTs] Error processing dynamic field ${field.objectId}:`, error);
        continue;
      }
    }
    
    console.log(`[getKioskNFTs] Found ${nfts.length} NFTs in kiosk ${kioskId}`);
    return nfts;
  } catch (error) {
    console.error(`[getKioskNFTs] Error fetching kiosk NFTs for ${kioskId}:`, error);
    return [];
  }
}

// Get all NFTs from all user's kiosks
export async function getAllUserNFTs(walletAddress: string): Promise<NFTInfo[]> {
  const kiosks = await getUserKiosks(walletAddress);
  const allNFTs: NFTInfo[] = [];
  
  for (const kiosk of kiosks) {
    const nfts = await getKioskNFTs(kiosk.id);
    allNFTs.push(...nfts);
  }
  
  return allNFTs;
}

// Get unique NFT types from user's collection
export async function getUserNFTTypes(walletAddress: string): Promise<string[]> {
  const nfts = await getAllUserNFTs(walletAddress);
  const types = new Set(nfts.map(nft => nft.type));
  return Array.from(types);
}

// Check if user has a kiosk
export async function hasKiosk(walletAddress: string): Promise<boolean> {
  const kiosks = await getUserKiosks(walletAddress);
  return kiosks.length > 0;
}

// Alternative method: Find NFTs by searching all owned objects
export async function findNFTsDirectly(walletAddress: string): Promise<NFTInfo[]> {
  console.log(`[findNFTsDirectly] Searching for NFTs directly owned by ${walletAddress}`);
  
  try {
    let allObjects: any[] = [];
    let cursor: string | null = null;
    
    do {
      const batch = await suiClient.getOwnedObjects({
        owner: walletAddress,
        cursor: cursor || undefined,
        options: {
          showContent: true,
          showType: true,
          showDisplay: true,
        }
      });
      allObjects.push(...batch.data);
      cursor = batch.nextCursor;
    } while (cursor);
    
    console.log(`[findNFTsDirectly] Found ${allObjects.length} total owned objects`);
    
    const nfts: NFTInfo[] = [];
    
    for (const obj of allObjects) {
      if (obj.data?.type && obj.data?.display?.data) {
        // Check if this object has NFT-like characteristics
        const hasDisplayData = obj.data.display.data.name || obj.data.display.data.image_url;
        const isNFTType = obj.data.type.includes('nft') || 
                         obj.data.type.includes('NFT') ||
                         obj.data.type.includes('collectible') ||
                         hasDisplayData;
        
        if (isNFTType) {
          console.log(`[findNFTsDirectly] Found potential NFT: ${obj.data.objectId}, type: ${obj.data.type}`);
          nfts.push({
            id: obj.data.objectId,
            type: obj.data.type,
            display: obj.data.display.data,
            kioskId: 'direct_ownership' // Mark as directly owned
          });
        }
      }
    }
    
    console.log(`[findNFTsDirectly] Found ${nfts.length} potential NFTs`);
    return nfts;
  } catch (error) {
    console.error('[findNFTsDirectly] Error finding NFTs directly:', error);
    return [];
  }
}

// Enhanced function that combines both methods
export async function getAllUserNFTsEnhanced(walletAddress: string): Promise<NFTInfo[]> {
  console.log(`[getAllUserNFTsEnhanced] Enhanced NFT discovery for ${walletAddress}`);
  
  // Get NFTs from kiosks
  const kioskNFTs = await getAllUserNFTs(walletAddress);
  console.log(`[getAllUserNFTsEnhanced] Found ${kioskNFTs.length} NFTs from kiosks`);
  
  // Get directly owned NFTs
  const directNFTs = await findNFTsDirectly(walletAddress);
  console.log(`[getAllUserNFTsEnhanced] Found ${directNFTs.length} directly owned NFTs`);
  
  // Combine and deduplicate
  const allNFTs = [...kioskNFTs];
  const kioskNFTIds = new Set(kioskNFTs.map(nft => nft.id));
  
  for (const directNFT of directNFTs) {
    if (!kioskNFTIds.has(directNFT.id)) {
      allNFTs.push(directNFT);
    }
  }
  
  console.log(`[getAllUserNFTsEnhanced] Total unique NFTs found: ${allNFTs.length}`);
  return allNFTs;
}