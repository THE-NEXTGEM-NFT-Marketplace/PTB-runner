import { useState, useEffect } from 'react';
import { useWallet } from '@suiet/wallet-kit';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowRightLeft, Package, Code, AlertCircle, Send, Users, Loader2 } from 'lucide-react';
import { NFTInfo, KioskInfo } from '@/lib/kiosk-discovery';
import { NFTGrid } from './NFTGrid';
import { constructTransactionBlock } from '@/lib/transaction-builder';
import { parsePtbJson } from '@/lib/ptb-parser';
import { useToast } from '@/hooks/use-toast';
import { discoverRecipient, createSmartKioskTransferTransaction, RecipientInfo } from '@/lib/smart-kiosk';

interface TransferInterfaceProps {
  nfts: NFTInfo[];
  kiosks: KioskInfo[];
  onTransferComplete: () => void;
}

export function TransferInterface({ nfts, kiosks, onTransferComplete }: TransferInterfaceProps) {
  const { signAndExecuteTransaction } = useWallet();
  const { toast } = useToast();
  const [selectedNFTs, setSelectedNFTs] = useState<NFTInfo[]>([]);
  const [recipientAddress, setRecipientAddress] = useState('');
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

  const handleDirectTransfer = async () => {
    if (!selectedNFTs.length || !recipientAddress) {
      toast({
        title: "Invalid Selection",
        description: "Please select NFTs and enter a recipient address",
        variant: "destructive"
      });
      return;
    }

    setExecuting(true);
    try {
      // Create PTB JSON for direct transfer
      const transferCommands = selectedNFTs.map(nft => ({
        type: 'transferObjects' as const,
        objects: [{ type: 'object' as const, value: nft.id }],
        recipient: recipientAddress
      }));

      const ptbJson = { commands: transferCommands };
      const commands = parsePtbJson(JSON.stringify(ptbJson));
      const txb = constructTransactionBlock(commands);

      const result = await signAndExecuteTransaction({
        transaction: txb,
      });

      toast({
        title: "Transfer Successful",
        description: `Transferred ${selectedNFTs.length} NFT(s) successfully`,
      });

      setSelectedNFTs([]);
      setRecipientAddress('');
      onTransferComplete();
    } catch (error: any) {
      console.error('Transfer error:', error);
      toast({
        title: "Transfer Failed",
        description: error.message || "Failed to transfer NFTs",
        variant: "destructive"
      });
    } finally {
      setExecuting(false);
    }
  };

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
          <Tabs defaultValue="simple" className="space-y-4">
            <TabsList>
              <TabsTrigger value="simple">Simple Transfer</TabsTrigger>
              <TabsTrigger value="kiosk">Kiosk Transfer</TabsTrigger>
              <TabsTrigger value="custom">Custom PTB</TabsTrigger>
            </TabsList>

            <TabsContent value="simple" className="space-y-4">
              {/* NFT Selection */}
              <div>
                <Label className="text-base font-medium mb-3 block">Select NFTs to Transfer</Label>
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
                  <Badge variant="secondary" className="mt-2">
                    {selectedNFTs.length} NFT(s) selected
                  </Badge>
                )}
              </div>

              {/* Recipient Address */}
              <div>
                <Label htmlFor="recipient">Recipient Address</Label>
                <Input
                  id="recipient"
                  placeholder="0x..."
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                />
              </div>

              <Button 
                onClick={handleDirectTransfer}
                disabled={!selectedNFTs.length || !recipientAddress || executing}
                className="w-full"
              >
                <Send className="w-4 h-4 mr-2" />
                {executing ? 'Transferring...' : 'Transfer NFTs'}
              </Button>
            </TabsContent>

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