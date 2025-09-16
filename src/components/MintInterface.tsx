import { useState } from 'react';
import { useWallet } from '@suiet/wallet-kit';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Package, Wand2, Search, ClipboardCopy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Transaction } from '@mysten/sui/transactions';
import { getUserKiosks, KioskInfo } from '@/lib/kiosk-discovery';

const PACKAGE_ID = '0xbd672d1c158c963ade8549ae83bda75f29f6b3ce0c59480f3921407c4e8c6781';
const MODULE = 'governance_nfts';
const FUNCTION = 'batch_mint_to_kiosk';

const ADMIN_CAP = '0xe1e2131617eb3523fd2bd67ffaa8281bd263304a5a2012e5cdf9295377126066';
const MINTING_CONTROL = '0x4c097147e9c1d2d59bd0f7ae42c8bf906c6fae8b939e47d30189c580b05ba9e7';
const TRANSFER_POLICY = '0x19697e068f28eda3b7db19dc5430bac452312912e605f50663c58a78962ef26e';

type TierKey = 'council' | 'governor' | 'voter';
const TIER_TO_U8: Record<TierKey, number> = {
  council: 0,
  governor: 1,
  voter: 2,
};

export function MintInterface() {
  const { signAndExecuteTransaction } = useWallet();
  const { toast } = useToast();

  const [tier, setTier] = useState<TierKey>('voter');
  const [startEdition, setStartEdition] = useState('');
  const [count, setCount] = useState('');
  const [kioskId, setKioskId] = useState('');
  const [ownerCapId, setOwnerCapId] = useState('');
  const [lookupAddress, setLookupAddress] = useState('');
  const [lookupResult, setLookupResult] = useState<KioskInfo[] | null>(null);
  const [executing, setExecuting] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);

  const handleLookup = async () => {
    if (!lookupAddress || lookupAddress.length < 10) {
      toast({ title: 'Invalid address', description: 'Enter a valid wallet address', variant: 'destructive' });
      return;
    }
    setLookingUp(true);
    try {
      const kiosks = await getUserKiosks(lookupAddress);
      setLookupResult(kiosks);
      if (kiosks.length === 0) {
        toast({ title: 'No kiosks found', description: 'This wallet has no kiosks on the current network' });
      }
    } catch (e: any) {
      toast({ title: 'Lookup failed', description: e?.message || 'Could not fetch kiosks', variant: 'destructive' });
    } finally {
      setLookingUp(false);
    }
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copied', description: `${label} copied` });
    } catch {
      toast({ title: 'Copy failed', description: 'Could not copy to clipboard', variant: 'destructive' });
    }
  };

  const handleMint = async () => {
    // Basic validation
    if (!startEdition || !count || !kioskId || !ownerCapId) {
      toast({ title: 'Missing fields', description: 'Fill Start Edition, Count, Kiosk, and KioskOwnerCap', variant: 'destructive' });
      return;
    }

    const startEditionNum = Number(startEdition);
    const countNum = Number(count);
    if (!Number.isFinite(startEditionNum) || startEditionNum < 1) {
      toast({ title: 'Invalid Start Edition', description: 'Enter a positive number', variant: 'destructive' });
      return;
    }
    if (!Number.isFinite(countNum) || countNum < 1) {
      toast({ title: 'Invalid Count', description: 'Enter a positive number', variant: 'destructive' });
      return;
    }

    setExecuting(true);
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::${FUNCTION}`,
        arguments: [
          tx.object(ADMIN_CAP),
          tx.object(MINTING_CONTROL),
          tx.pure.u8(TIER_TO_U8[tier]),
          tx.pure.u64(BigInt(startEditionNum)),
          tx.pure.u64(BigInt(countNum)),
          tx.object(TRANSFER_POLICY),
          tx.object(kioskId),
          tx.object(ownerCapId),
        ],
      });

      await signAndExecuteTransaction({ transaction: tx });
      toast({ title: 'Mint submitted', description: `Minting ${countNum} ${tier} NFT(s) starting at ${startEditionNum}` });
      setCount('');
      setStartEdition('');
    } catch (e: any) {
      toast({ title: 'Mint failed', description: e?.message || 'Transaction failed', variant: 'destructive' });
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5" />
            Mint SuiLFG NFTs to Kiosk
          </CardTitle>
          <CardDescription>Batch mint directly into a kiosk with locked policy</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Tier */}
          <div className="grid gap-2">
            <Label>3. Tier (u8)</Label>
            <Select value={tier} onValueChange={(v: TierKey) => setTier(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="council">Council (0)</SelectItem>
                <SelectItem value="governor">Governor (1)</SelectItem>
                <SelectItem value="voter">Voter (2)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Start Edition */}
          <div className="grid gap-2">
            <Label>4. Start Edition (u64)</Label>
            <Input value={startEdition} onChange={(e) => setStartEdition(e.target.value)} placeholder="e.g., 301" />
            <p className="text-xs text-muted-foreground">Must equal the next available edition for the selected tier.</p>
          </div>

          {/* Count */}
          <div className="grid gap-2">
            <Label>5. Count (u64)</Label>
            <Input value={count} onChange={(e) => setCount(e.target.value)} placeholder="e.g., 200" />
          </div>

          {/* Kiosk */}
          <div className="grid gap-2">
            <Label>7. Kiosk (Object ID)</Label>
            <div className="flex gap-2">
              <Input value={kioskId} onChange={(e) => setKioskId(e.target.value)} placeholder="0x..." />
              <Button type="button" variant="outline" onClick={() => copy(kioskId, 'Kiosk ID')}><ClipboardCopy className="w-4 h-4" /></Button>
            </div>
          </div>

          {/* KioskOwnerCap */}
          <div className="grid gap-2">
            <Label>8. KioskOwnerCap (Object ID)</Label>
            <div className="flex gap-2">
              <Input value={ownerCapId} onChange={(e) => setOwnerCapId(e.target.value)} placeholder="0x..." />
              <Button type="button" variant="outline" onClick={() => copy(ownerCapId, 'Owner Cap ID')}><ClipboardCopy className="w-4 h-4" /></Button>
            </div>
          </div>

          <Alert>
            <AlertDescription className="space-y-1">
              <div>1. AdminCap: <span className="font-mono break-all">{ADMIN_CAP}</span></div>
              <div>2. MintingControl: <span className="font-mono break-all">{MINTING_CONTROL}</span></div>
              <div>6. TransferPolicy: <span className="font-mono break-all">{TRANSFER_POLICY}</span></div>
            </AlertDescription>
          </Alert>

          <Button className="w-full" onClick={handleMint} disabled={executing}>
            <Package className="w-4 h-4 mr-2" />
            {executing ? 'Submitting...' : 'Mint to Kiosk'}
          </Button>
        </CardContent>
      </Card>

      {/* Lookup section */}
      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Lookup Kiosk by Wallet
          </CardTitle>
          <CardDescription>Fetch kiosk ID and owner cap for any wallet address</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>Wallet Address</Label>
            <div className="flex gap-2">
              <Input value={lookupAddress} onChange={(e) => setLookupAddress(e.target.value)} placeholder="0x..." />
              <Button type="button" variant="outline" onClick={handleLookup} disabled={lookingUp}>
                {lookingUp ? 'Looking up...' : 'Lookup'}
              </Button>
            </div>
          </div>

          {lookupResult && (
            <div className="space-y-3">
              {lookupResult.length === 0 ? (
                <div className="text-sm text-muted-foreground">No kiosks found for this address.</div>
              ) : (
                lookupResult.map((k) => (
                  <div key={k.id} className="p-3 bg-muted/20 rounded-md border border-border/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">Kiosk</div>
                      <div className="text-xs text-muted-foreground">Items: {k.itemCount}</div>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Kiosk ID:</span>
                        <span className="text-xs font-mono break-all">{k.id}</span>
                        <Button size="sm" variant="outline" onClick={() => copy(k.id, 'Kiosk ID')}>Copy</Button>
                        <Button size="sm" onClick={() => setKioskId(k.id)}>Use</Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Owner Cap ID:</span>
                        <span className="text-xs font-mono break-all">{k.ownerCapId}</span>
                        <Button size="sm" variant="outline" onClick={() => copy(k.ownerCapId, 'Owner Cap ID')}>Copy</Button>
                        <Button size="sm" onClick={() => setOwnerCapId(k.ownerCapId)}>Use</Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


