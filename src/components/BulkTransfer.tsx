import { useState, useCallback } from 'react';
import { useWallet } from '@suiet/wallet-kit';
import { Transaction } from '@mysten/sui/transactions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Send } from 'lucide-react';
import { suiClient } from '@/lib/simple-sui-client';
import { getUserKiosks } from '@/lib/kiosk-discovery';

export function BulkTransfer() {
  const { connected, account, signAndExecuteTransactionBlock } = useWallet();
  const [nftIds, setNftIds] = useState('');
  const [recipientAddresses, setRecipientAddresses] = useState('');
  const [overrideKioskId, setOverrideKioskId] = useState('');
  const [overrideOwnerCapId, setOverrideOwnerCapId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleTransfer = useCallback(async () => {
    if (!connected || !account?.address) {
      setError('Please connect your wallet first.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    const nfts = nftIds.split(',').map(id => id.trim()).filter(id => id);
    const recipients = recipientAddresses.split(',').map(addr => addr.trim()).filter(addr => addr);

    if (nfts.length === 0 || recipients.length === 0) {
      setError('Please provide at least one NFT ID and one recipient address.');
      setLoading(false);
      return;
    }

    if (nfts.length !== recipients.length) {
      setError('The number of NFT IDs must match the number of recipient addresses.');
      setLoading(false);
      return;
    }

    const usingOverride = overrideKioskId.length > 0 && overrideOwnerCapId.length > 0;

    try {
      let senderKioskAuthorityById = new Map<string, string>();

      if (!usingOverride) {
        const userKiosks = await getUserKiosks(account.address);
        if (userKiosks.length === 0) {
          setError('No kiosks found for your account.');
          setLoading(false);
          return;
        }
        senderKioskAuthorityById = new Map(userKiosks.map(k => [k.id, k.ownerCapId]));
      } else {
        senderKioskAuthorityById.set(overrideKioskId, overrideOwnerCapId);
      }

      const nftObjects = await suiClient.multiGetObjects({
        ids: nfts,
        options: { showOwner: true, showType: true },
      });

      const txb = new Transaction();

      for (let i = 0; i < nfts.length; i++) {
        const nftId = nfts[i];
        const recipient = recipients[i];
        const nftObject = nftObjects.find(o => o.data?.objectId === nftId);

        if (!nftObject?.data) {
          throw new Error(`Could not fetch object ${nftId}.`);
        }

        const nftType = nftObject.data.type || '';
        const ownerInfo = nftObject.data.owner as any;

        const inferredKioskId: string | undefined = ownerInfo && ownerInfo.ObjectOwner ? ownerInfo.ObjectOwner : undefined;
        if (!inferredKioskId) {
          throw new Error(`NFT ${nftId} is not in a kiosk (owner: ${JSON.stringify(ownerInfo)})`);
        }

        const kioskIdToUse = usingOverride ? overrideKioskId : inferredKioskId;
        if (usingOverride && inferredKioskId !== overrideKioskId) {
          throw new Error(`NFT ${nftId} is in kiosk ${inferredKioskId}, which does not match the provided kiosk ${overrideKioskId}.`);
        }

        const ownerCapId = senderKioskAuthorityById.get(kioskIdToUse);
        if (!ownerCapId) {
          throw new Error(`You do not control the kiosk (${kioskIdToUse}) containing NFT ${nftId}.`);
        }

        const [takenItem] = txb.moveCall({
          target: '0x2::kiosk::take',
          arguments: [
            txb.object(kioskIdToUse),
            txb.object(ownerCapId),
            txb.pure.id(nftId),
          ],
          typeArguments: [nftType],
        });

        const [newKiosk, newOwnerCap] = txb.moveCall({
          target: '0x2::kiosk::new',
          arguments: [],
        });

        txb.moveCall({
          target: '0x2::kiosk::place',
          arguments: [newKiosk, newOwnerCap, takenItem],
          typeArguments: [nftType],
        });

        // SAFETY: Only transfer the new kiosk OwnerCap to recipient. Never transfer the provided OwnerCap.
        txb.transferObjects([newOwnerCap], txb.pure.address(recipient));
      }

      const result = await signAndExecuteTransactionBlock({ transactionBlock: txb });
      setSuccess(`Transfer successful! Digest: ${result.digest}`);

    } catch (err: any) {
      setError(err.message || 'An unknown error occurred during transfer.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [connected, account, nftIds, recipientAddresses, overrideKioskId, overrideOwnerCapId, signAndExecuteTransactionBlock]);

  if (!connected) {
    return <p>Please connect your wallet to use the bulk transfer feature.</p>;
  }

  return (
    <Card className="bg-gradient-card border-border/50">
      <CardHeader>
        <CardTitle>Bulk NFT Transfer to Recipients' Kiosks</CardTitle>
        <CardDescription>
          Paste NFT IDs (from your kiosk) and recipient wallet addresses. Optionally specify your kiosk ID and its OwnerCap ID
          to force-use that cap. Each NFT is taken from your kiosk, placed into a freshly created kiosk, then that kiosk's
          OwnerCap is sent to the recipient. Your own OwnerCap is NEVER transferred.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid w-full gap-1.5">
          <Label htmlFor="nft-ids">NFT Object IDs (comma-separated)</Label>
          <Textarea 
            placeholder="0x..., 0x..., 0x..." 
            id="nft-ids" 
            value={nftIds}
            onChange={(e) => setNftIds(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="grid w-full gap-1.5">
          <Label htmlFor="recipient-addresses">Recipient Wallet Addresses (comma-separated)</Label>
          <Textarea 
            placeholder="0x..., 0x..., 0x..." 
            id="recipient-addresses" 
            value={recipientAddresses}
            onChange={(e) => setRecipientAddresses(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="grid w-full gap-1.5">
          <Label htmlFor="override-kiosk">Optional: Your Kiosk ID (use this kiosk for all NFTs)</Label>
          <Textarea 
            placeholder="0xKIOSKID..." 
            id="override-kiosk" 
            value={overrideKioskId}
            onChange={(e) => setOverrideKioskId(e.target.value.trim())}
            disabled={loading}
          />
        </div>
        <div className="grid w-full gap-1.5">
          <Label htmlFor="override-cap">Optional: Your KioskOwnerCap ID (for the kiosk above)</Label>
          <Textarea 
            placeholder="0xOWNERCAPID..." 
            id="override-cap" 
            value={overrideOwnerCapId}
            onChange={(e) => setOverrideOwnerCapId(e.target.value.trim())}
            disabled={loading}
          />
        </div>
        
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {success && (
          <Alert variant="default" className="bg-green-100 dark:bg-green-900">
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <Button onClick={handleTransfer} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Initiate Bulk Transfer
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
