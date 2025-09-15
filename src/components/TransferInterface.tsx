import { useState, useEffect } from 'react';
import { useWallet } from '@suiet/wallet-kit';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowRightLeft, Package, Code, AlertCircle, Users, Loader2 } from 'lucide-react';
import { NFTInfo, KioskInfo } from '@/lib/kiosk-discovery';
import { NFTGrid } from './NFTGrid';
import { constructTransactionBlock } from '@/lib/transaction-builder';
import { parsePtbJson } from '@/lib/ptb-parser';
import { parseWalletAddresses, prepareBulkTransferRecipients, createBulkTransferTransaction } from '@/lib/kiosk-discovery';
import { Transaction } from '@mysten/sui/transactions';
import { useToast } from '@/hooks/use-toast';
import { discoverRecipient, createSmartKioskTransferTransaction, RecipientInfo } from '@/lib/smart-kiosk';

interface TransferInterfaceProps {
  nfts: NFTInfo[];
  kiosks: KioskInfo[];
  onTransferComplete: () => void;
}

export function TransferInterface({ nfts, kiosks, onTransferComplete }: TransferInterfaceProps) {
  const { signAndExecuteTransaction, account } = useWallet();
  const { toast } = useToast();
  const [selectedNFTs, setSelectedNFTs] = useState<NFTInfo[]>([]);
  const [recipientAddress, setRecipientAddress] = useState('');
  const [bulkAddresses, setBulkAddresses] = useState('');
  const [recipientInfo, setRecipientInfo] = useState<RecipientInfo | null>(null);
  const [loadingRecipient, setLoadingRecipient] = useState(false);
  const [customPtb, setCustomPtb] = useState('');
  const [executing, setExecuting] = useState(false);

  // Auto-discover recipient when address changes
  useEffect(() => {
    const discoverRecipientInfo = async () => {
      if (!recipientAddress || recipientAddress.length < 10) {
        setRecipientInfo(null);
        return;
      }

      setLoadingRecipient(true);
      try {
        const info = await discoverRecipient(recipientAddress);
        setRecipientInfo(info);
      } catch (error) {
        console.error('Failed to discover recipient:', error);
        setRecipientInfo(null);
      } finally {
        setLoadingRecipient(false);
      }
    };

    const timeoutId = setTimeout(discoverRecipientInfo, 500); // Debounce
    return () => clearTimeout(timeoutId);
  }, [recipientAddress]);

  // Removed direct address transfer (kiosk-only policy)

  const handleKioskTransfer = async () => {
    if (!selectedNFTs.length || !recipientInfo) {
      toast({
        title: "Invalid Selection", 
        description: "Please select NFTs and specify a valid recipient address",
        variant: "destructive"
      });
      return;
    }

    setExecuting(true);
    try {
      const nftIds = selectedNFTs.map(nft => nft.id);
      const nftTypes = selectedNFTs.map(nft => nft.type);
      
      const { transaction, description } = createSmartKioskTransferTransaction(
        recipientInfo,
        nftIds,
        nftTypes
      );

      const result = await signAndExecuteTransaction({
        transaction: transaction,
      });

      toast({
        title: "Kiosk Transfer Successful",
        description: description,
      });

      setSelectedNFTs([]);
      setRecipientAddress('');
      setRecipientInfo(null);
      onTransferComplete();
    } catch (error: any) {
      console.error('Kiosk transfer error:', error);
      toast({
        title: "Kiosk Transfer Failed",
        description: error.message || "Failed to transfer NFTs to kiosk",
        variant: "destructive"
      });
    } finally {
      setExecuting(false);
    }
  };

  const handleBulkKioskTransfer = async () => {
    if (!selectedNFTs.length || !bulkAddresses.trim()) {
      toast({
        title: "Invalid Selection",
        description: "Select NFTs and enter comma-separated recipient addresses",
        variant: "destructive"
      });
      return;
    }

    // Require that all selected NFTs are same type and at least equal to recipient count
    const uniqueTypes = Array.from(new Set(selectedNFTs.map(n => n.type)));
    if (uniqueTypes.length !== 1) {
      toast({
        title: "Single Type Required",
        description: "Select NFTs of one type for bulk transfer",
        variant: "destructive"
      });
      return;
    }

    if (!account?.address) {
      toast({
        title: "No Wallet",
        description: "Connect your wallet to send NFTs",
        variant: "destructive"
      });
      return;
    }

    setExecuting(true);
    try {
      const nftType = uniqueTypes[0];
      const addresses = parseWalletAddresses(bulkAddresses);
      if (addresses.length === 0) {
        throw new Error('No valid recipient addresses');
      }

      if (selectedNFTs.length < addresses.length) {
        throw new Error(`You selected ${selectedNFTs.length} NFTs but provided ${addresses.length} addresses`);
      }

      const recipients = await prepareBulkTransferRecipients(addresses as string[]);
      const nftIds = selectedNFTs.map(n => n.id).slice(0, recipients.length) as string[];
      const senderAddress: string = account?.address ? account.address : '';
      if (!senderAddress) {
        throw new Error('Wallet address unavailable');
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transaction: any = createBulkTransferTransaction(senderAddress as string, recipients as any, nftType as string, nftIds as string[]);

      await (signAndExecuteTransaction as any)({ transaction });

      toast({
        title: "Bulk Transfer Submitted",
        description: `Sending ${nftIds.length} NFT(s) to ${recipients.length} kiosk(s)`,
      });

      setSelectedNFTs([]);
      setBulkAddresses('');
      setRecipientAddress('');
      setRecipientInfo(null);
      onTransferComplete();
    } catch (error: any) {
      console.error('Bulk kiosk transfer error:', error);
      toast({
        title: "Bulk Transfer Failed",
        description: error.message || "Failed to prepare bulk kiosk transfer",
        variant: "destructive"
      });
    } finally {
      setExecuting(false);
    }
  };

  const validateCustomPtb = (ptbString: string): string | null => {
    if (!ptbString.trim()) {
      return "PTB JSON cannot be empty";
    }
    
    try {
      JSON.parse(ptbString);
    } catch (error) {
      return "Invalid JSON format";
    }
    
    // Additional security checks
    const parsed = JSON.parse(ptbString);
    if (!parsed.commands || !Array.isArray(parsed.commands)) {
      return "PTB must contain a 'commands' array";
    }
    
    if (parsed.commands.length === 0) {
      return "Commands array cannot be empty";
    }
    
    // Check for potentially dangerous commands (basic validation)
    const dangerousPatterns = ['eval', 'function', 'constructor'];
    if (dangerousPatterns.some(pattern => ptbString.toLowerCase().includes(pattern))) {
      return "PTB contains potentially unsafe content";
    }
    
    return null;
  };

  const handleCustomPtb = async () => {
    const validationError = validateCustomPtb(customPtb);
    if (validationError) {
      toast({
        title: "Invalid PTB",
        description: validationError,
        variant: "destructive"
      });
      return;
    }

    setExecuting(true);
    try {
      const commands = parsePtbJson(customPtb);
      const txb = constructTransactionBlock(commands);

      const result = await signAndExecuteTransaction({
        transaction: txb,
      });

      toast({
        title: "Custom PTB Executed",
        description: "Custom transaction executed successfully",
      });

      setCustomPtb('');
      onTransferComplete();
    } catch (error: any) {
      console.error('Custom PTB error:', error);
      toast({
        title: "PTB Execution Failed",
        description: error.message || "Failed to execute custom PTB",
        variant: "destructive"
      });
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5" />
            Transfer NFTs
          </CardTitle>
          <CardDescription>
            Transfer NFTs directly or between kiosks, or execute custom PTBs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="kiosk" className="space-y-4">
            <TabsList>
              <TabsTrigger value="kiosk">Kiosk Transfer</TabsTrigger>
              <TabsTrigger value="bulk">Bulk Kiosk Transfer</TabsTrigger>
              <TabsTrigger value="custom">Custom PTB</TabsTrigger>
            </TabsList>

            <TabsContent value="kiosk" className="space-y-4">
              {/* NFT Selection */}
              <div>
                <Label className="text-base font-medium mb-3 block">Select NFTs for Kiosk Transfer</Label>
                <Card className="bg-muted/20 border-border/30">
                  <CardContent className="p-4">
                    <NFTGrid 
                      nfts={nfts} 
                      loading={false} 
                      selectable={true}
                      onSelectionChange={setSelectedNFTs}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Recipient Address */}
              <div>
                <Label htmlFor="kioskRecipient">Recipient Wallet Address</Label>
                <div className="relative">
                  <Input
                    id="kioskRecipient"
                    placeholder="0x... (wallet address)"
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                  />
                  {loadingRecipient && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
                
                {/* Recipient Status */}
                {recipientInfo && (
                  <div className="mt-2 p-3 bg-muted/30 rounded-md border border-border/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-4 h-4" />
                      <span className="text-sm font-medium">Recipient Status</span>
                    </div>
                    {recipientInfo.hasKiosk ? (
                      <div className="text-sm text-success">
                        ✓ Has {recipientInfo.kiosks.length} kiosk(s) - NFTs will be placed in existing kiosk
                      </div>
                    ) : (
                      <div className="text-sm text-warning">
                        ⚠ No kiosk found - New kiosk will be created automatically
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Enter a wallet address. If they don't have a kiosk, one will be created automatically and NFTs placed inside.
                </AlertDescription>
              </Alert>

              <Button 
                onClick={handleKioskTransfer}
                disabled={!selectedNFTs.length || !recipientInfo || executing || loadingRecipient}
                className="w-full"
              >
                <Package className="w-4 h-4 mr-2" />
                {executing ? 'Transferring...' : 
                 loadingRecipient ? 'Checking recipient...' : 
                 recipientInfo?.hasKiosk ? 'Transfer to Kiosk' : 'Create Kiosk & Transfer'}
              </Button>
            </TabsContent>

            <TabsContent value="bulk" className="space-y-4">
              <div>
                <Label className="text-base font-medium mb-3 block">Select NFTs (one type) for Bulk Transfer</Label>
                <Card className="bg-muted/20 border-border/30">
                  <CardContent className="p-4">
                    <NFTGrid 
                      nfts={nfts} 
                      loading={false} 
                      selectable={true}
                      onSelectionChange={setSelectedNFTs}
                    />
                  </CardContent>
                </Card>
                {selectedNFTs.length > 0 && (
                  <span className="mt-2 inline-block text-xs text-muted-foreground">
                    {selectedNFTs.length} NFT(s) selected
                  </span>
                )}
              </div>

              <div>
                <Label htmlFor="bulkRecipients">Recipient Wallet Addresses (comma-separated)</Label>
                <Textarea
                  id="bulkRecipients"
                  placeholder="0xabc..., 0xdef..., 0x123..."
                  value={bulkAddresses}
                  onChange={(e) => setBulkAddresses(e.target.value)}
                  rows={3}
                />
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Sends 1 NFT of the selected type to each address's kiosk. If a recipient has no kiosk, it will be created automatically. Direct-address transfers are disabled.
                </AlertDescription>
              </Alert>

              <Button 
                onClick={handleBulkKioskTransfer}
                disabled={!selectedNFTs.length || !bulkAddresses.trim() || executing}
                className="w-full"
              >
                <Package className="w-4 h-4 mr-2" />
                {executing ? 'Submitting...' : 'Send Bulk to Kiosks'}
              </Button>
            </TabsContent>

            <TabsContent value="custom" className="space-y-4">
              <div>
                <Label htmlFor="customPtb">Custom PTB JSON</Label>
                <Textarea
                  id="customPtb"
                  placeholder="Enter your custom PTB JSON here..."
                  value={customPtb}
                  onChange={(e) => setCustomPtb(e.target.value)}
                  rows={10}
                  className="font-mono text-sm"
                />
              </div>

              <Alert>
                <Code className="h-4 w-4" />
                <AlertDescription>
                  Advanced users can execute custom Programmable Transaction Blocks. Ensure your JSON is valid.
                </AlertDescription>
              </Alert>

              <Button 
                onClick={handleCustomPtb}
                disabled={!customPtb.trim() || executing}
                className="w-full"
              >
                <Code className="w-4 h-4 mr-2" />
                {executing ? 'Executing...' : 'Execute Custom PTB'}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}