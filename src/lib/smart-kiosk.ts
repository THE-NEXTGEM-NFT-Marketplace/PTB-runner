// Smart Kiosk Management - Handle recipient wallet addresses with automatic kiosk discovery/creation

import { suiClient } from './sui-client';
import { getUserKiosks, KioskInfo } from './kiosk-discovery';
import { Transaction } from '@mysten/sui';

export interface RecipientInfo {
  walletAddress: string;
  kiosks: KioskInfo[];
  hasKiosk: boolean;
}

/**
 * Discover recipient information by wallet address
 */
export async function discoverRecipient(walletAddress: string): Promise<RecipientInfo> {
  try {
    const kiosks = await getUserKiosks(walletAddress);
    return {
      walletAddress,
      kiosks,
      hasKiosk: kiosks.length > 0
    };
  } catch (error) {
    console.error('Error discovering recipient:', error);
    return {
      walletAddress,
      kiosks: [],
      hasKiosk: false
    };
  }
}

/**
 * Create a new kiosk for a wallet address
 */
export function createKioskTransaction(): { transaction: Transaction; kioskResult: any; ownerCapResult: any } {
  const txb = new Transaction();
  
  // Create new kiosk
  const [kiosk, ownerCap] = txb.moveCall({
    target: '0x2::kiosk::new',
    arguments: [],
  });

  // Transfer the owner cap to the recipient
  // Note: The kiosk itself is shared and doesn't need to be transferred
  
  return {
    transaction: txb,
    kioskResult: kiosk,
    ownerCapResult: ownerCap
  };
}

/**
 * Create PTB commands for placing NFTs into a kiosk
 */
export function createPlaceNFTsCommands(
  kioskId: string,
  ownerCapId: string,
  nftIds: string[],
  nftTypes: string[]
): any[] {
  const commands = [];
  
  for (let i = 0; i < nftIds.length; i++) {
    commands.push({
      type: 'moveCall' as const,
      target: '0x2::kiosk::place',
      arguments: [
        { type: 'object' as const, value: kioskId },
        { type: 'object' as const, value: ownerCapId },
        { type: 'object' as const, value: nftIds[i] }
      ],
      typeArguments: [nftTypes[i]]
    });
  }
  
  return commands;
}

/**
 * Create a complete transaction for transferring NFTs to a recipient's kiosk
 * If recipient doesn't have a kiosk, creates one first
 */
export function createSmartKioskTransferTransaction(
  recipientInfo: RecipientInfo,
  nftIds: string[],
  nftTypes: string[]
): { transaction: Transaction; description: string } {
  const txb = new Transaction();
  let description = '';
  let targetKiosk: any;
  let targetOwnerCap: any;

  if (recipientInfo.hasKiosk && recipientInfo.kiosks.length > 0) {
    // Use existing kiosk (first one if multiple)
    const existingKiosk = recipientInfo.kiosks[0];
    targetKiosk = txb.object(existingKiosk.id);
    targetOwnerCap = txb.object(existingKiosk.ownerCapId);
    description = `Transferring ${nftIds.length} NFT(s) to existing kiosk`;
  } else {
    // Create new kiosk first
    const [kiosk, ownerCap] = txb.moveCall({
      target: '0x2::kiosk::new',
      arguments: [],
    });
    
    // Transfer owner cap to recipient
    txb.transferObjects([ownerCap], recipientInfo.walletAddress);
    
    targetKiosk = kiosk;
    targetOwnerCap = ownerCap;
    description = `Creating new kiosk and transferring ${nftIds.length} NFT(s)`;
  }

  // Place NFTs into the kiosk
  for (let i = 0; i < nftIds.length; i++) {
    txb.moveCall({
      target: '0x2::kiosk::place',
      arguments: [targetKiosk, targetOwnerCap, txb.object(nftIds[i])],
      typeArguments: [nftTypes[i]]
    });
  }

  return { transaction: txb, description };
}