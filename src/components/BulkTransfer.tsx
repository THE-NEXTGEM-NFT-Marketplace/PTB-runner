import { useState, useCallback } from 'react';
import { useWallet } from '@suiet/wallet-kit';
import { Transaction } from '@mysten/sui/transactions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Send } from 'lucide-react';

export function BulkTransfer() {
  const { connected, account, signAndExecuteTransactionBlock } = useWallet();
  const [nftIds, setNftIds] = useState('');
  const [recipientAddresses, setRecipientAddresses] = useState('');
  const [senderKioskId, setSenderKioskId] = useState('');
  const [senderOwnerCapId, setSenderOwnerCapId] = useState('');
  const [nftType, setNftType] = useState('');
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

    const nfts = nftIds.split(',').map(id => id.trim()).filter(Boolean);
    const recipients = recipientAddresses.split(',').map(addr => addr.trim()).filter(Boolean);

    if (!senderKioskId || !senderOwnerCapId || !nftType) {
      setError('Sender Kiosk ID, OwnerCap ID, and NFT Type are required.');
      setLoading(false);
      return;
    }

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

    try {
      const txb = new Transaction();

      for (let i = 0; i < nfts.length; i++) {
        const nftId = nfts[i];
        const recipient = recipients[i];

        const [takenItem] = txb.moveCall({
          target: '0x2::kiosk::take',
          arguments: [
            txb.object(senderKioskId),
            txb.object(senderOwnerCapId),
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

        // Only transfer the new OwnerCap to the recipient. Never transfer the sender's OwnerCap.
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
  }, [connected, account, nftIds, recipientAddresses, senderKioskId, senderOwnerCapId, nftType, signAndExecuteTransactionBlock]);

  if (!connected) {
    return <p>Please connect your wallet to use the bulk transfer feature.</p>;
  }

  return (
    <Card className="bg-gradient-card border-border/50">
      <CardHeader>
        <CardTitle>Bulk NFT Transfer to Recipients' Kiosks</CardTitle>
        <CardDescription>
          Paste NFT IDs and recipient addresses. Provide your Kiosk ID, its OwnerCap ID, and the NFT Type.
          The PTB will be constructed directly without extra validations. Your OwnerCap is NEVER transferred.
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
          <Label htmlFor="sender-kiosk">Sender Kiosk ID (required)</Label>
          <Textarea
            placeholder="0xKIOSKID..."
            id="sender-kiosk"
            value={senderKioskId}
            onChange={(e) => setSenderKioskId(e.target.value.trim())}
            disabled={loading}
          />
        </div>
        <div className="grid w-full gap-1.5">
          <Label htmlFor="sender-cap">Sender KioskOwnerCap ID (required)</Label>
          <Textarea
            placeholder="0xOWNERCAPID..."
            id="sender-cap"
            value={senderOwnerCapId}
            onChange={(e) => setSenderOwnerCapId(e.target.value.trim())}
            disabled={loading}
          />
        </div>
        <div className="grid w-full gap-1.5">
          <Label htmlFor="nft-type">NFT Type (Move type, required)</Label>
          <Textarea
            placeholder="0x...::module::TypeName"
            id="nft-type"
            value={nftType}
            onChange={(e) => setNftType(e.target.value.trim())}
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
