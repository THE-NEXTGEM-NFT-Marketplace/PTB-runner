import { useEffect, useState, useCallback, useMemo } from 'react';
import { useWallet } from '@suiet/wallet-kit';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Wallet, Package, ArrowRightLeft, Plus, RefreshCw, FileText, HandCoins } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  KioskInfo,
  NFTInfo,
  discoverUserKiosksAndNFTs,
  discoverUserKiosksAndNFTsProgressive
} from '@/lib/kiosk-discovery';
import { WalletConnection } from './WalletConnection';
import { NFTGrid } from './NFTGrid';
import { TransferInterface } from './TransferInterface';
import { NetworkSwitcher } from './NetworkSwitcher';
import { useNetwork } from '@/contexts/NetworkContext';
import { switchNetwork } from '@/lib/simple-sui-client';
import { RoyaltyManager } from './RoyaltyManager';

export function KioskDashboard() {
  const { connected, account } = useWallet();
  const { currentNetwork } = useNetwork();
  const [kiosks, setKiosks] = useState<KioskInfo[]>([]);
  const [nfts, setNFTs] = useState<NFTInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [debugMode, setDebugMode] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const addDebugLog = useCallback((message: string) => {
    console.log(`[Kiosk Debug] ${message}`);
    setDebugLogs(prev => [`${new Date().toLocaleTimeString()}: ${message}`, ...prev.slice(0, 9)]);
  }, []);

  const handleRefresh = () => {
    setRefreshCounter(count => count + 1);
  };

  useEffect(() => {
    let cancelled = false;
    const loadKioskData = async () => {
      if (!connected || !account?.address) {
        addDebugLog('No wallet connection or address available');
        return;
      }

      setLoading(true);
      setError(null);
      setKiosks([]);
      setNFTs([]);
      addDebugLog(`Starting kiosk discovery for address: ${account.address}`);

      try {
        addDebugLog('Fetching user kiosks and NFTs progressively...');
        await discoverUserKiosksAndNFTsProgressive(account.address, (update) => {
          if (cancelled) return;
          if (update.kiosks) setKiosks(update.kiosks);
          if (update.nfts) setNFTs(prev => [...prev, ...update.nfts!]);
          if (update.done) addDebugLog('Progressive loading complete');
        });

        if (!cancelled && kiosks.length === 0) {
          setError(`No kiosks found. Make sure you have kiosks on the current network (${currentNetwork}).`);
        }
      } catch (error: any) {
        const errorMessage = error?.message || 'Unknown error occurred';
        addDebugLog(`Error: ${errorMessage}`);
        setError(errorMessage);
        console.error('Error loading kiosk data:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    
    switchNetwork(currentNetwork);
    loadKioskData();
    return () => { cancelled = true; };
  }, [connected, account, currentNetwork, addDebugLog, refreshCounter]);

  const nftTypeCount = useMemo(() => {
    return new Set(nfts.map(nft => nft.type)).size;
  }, [nfts]);

  if (!connected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <Card className="w-96 bg-gradient-card border-accent/20">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Wallet className="w-8 h-8 text-primary" />
            </div>
            <CardTitle>Connect Your Wallet</CardTitle>
            <CardDescription>
              Connect your wallet to manage your kiosks and NFTs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WalletConnection />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-primary">Kiosk Manager</h1>
            <p className="text-muted-foreground">Manage your NFTs and kiosk operations</p>
          </div>
          <div className="flex items-center gap-4">
            <NetworkSwitcher />
            <Link to="/ptb" className="hidden sm:block">
              <Button variant="outline" size="sm" className="gap-2">
                <FileText className="w-4 h-4" />
                PTB Runner
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDebugMode(!debugMode)}
            >
              Debug {debugMode ? 'Off' : 'On'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <WalletConnection />
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Debug Panel */}
        {debugMode && (
          <Card className="mb-4 bg-muted/10 border-muted">
            <CardHeader>
              <CardTitle className="text-sm">Debug Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold mb-2">Connection Status:</p>
                  <p className="text-xs text-muted-foreground">Connected: {connected ? 'Yes' : 'No'}</p>
                  <p className="text-xs text-muted-foreground">Address: {account?.address || 'None'}</p>
                  <p className="text-xs text-muted-foreground">Network: {currentNetwork}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold mb-2">Debug Logs:</p>
                  <div className="max-h-24 overflow-y-auto">
                    {debugLogs.map((log, i) => (
                      <div key={i} className="text-xs font-mono text-muted-foreground">
                        {log}
                      </div>
                    ))}
                    {debugLogs.length === 0 && (
                      <div className="text-xs text-muted-foreground">No debug logs yet</div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="dashboard">
              <Package className="w-4 h-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="transfer">
              <ArrowRightLeft className="w-4 h-4 mr-2" />
              Transfer
            </TabsTrigger>
            <TabsTrigger value="royalties">
              <HandCoins className="w-4 h-4 mr-2" />
              Royalties
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Stats Cards */}
              <div className="lg:col-span-4 grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card className="bg-gradient-card border-primary/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                        <Package className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">My Kiosks</p>
                        {loading ? (
                          <Skeleton className="h-6 w-8" />
                        ) : (
                          <p className="text-2xl font-bold text-primary">{kiosks.length}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-card border-accent/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center">
                        <Package className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total NFTs</p>
                        {loading ? (
                          <Skeleton className="h-6 w-8" />
                        ) : (
                          <p className="text-2xl font-bold text-accent">{nfts.length}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-card border-secondary/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-secondary/20 rounded-full flex items-center justify-center">
                        <ArrowRightLeft className="w-5 h-5 text-secondary-foreground" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">NFT Types</p>
                        {loading ? (
                          <Skeleton className="h-6 w-8" />
                        ) : (
                          <p className="text-2xl font-bold text-secondary-foreground">
                            {nftTypeCount}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Kiosks List */}
              <div className="lg:col-span-2">
                <Card className="bg-gradient-card border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="w-5 h-5" />
                      Your Kiosks
                    </CardTitle>
                    <CardDescription>Manage your kiosk inventory</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="space-y-3">
                        {[1, 2].map((i) => (
                          <div key={i} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-6 w-16" />
                          </div>
                        ))}
                      </div>
                    ) : kiosks.length > 0 ? (
                      <div className="space-y-3">
                        {kiosks.map((kiosk) => (
                          <div key={kiosk.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg hover:bg-muted/30 transition-colors">
                            <div>
                              <p className="font-medium">{`${kiosk.id.slice(0, 8)}...${kiosk.id.slice(-6)}`}</p>
                              <p className="text-sm text-muted-foreground">
                                Items: {kiosk.itemCount}
                              </p>
                            </div>
                            <Badge>Active</Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Package className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                        <p className="text-muted-foreground">No kiosks found</p>
                        <p className="text-sm text-muted-foreground">Create your first kiosk to get started</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* NFT Grid */}
              <div className="lg:col-span-2">
                <Card className="bg-gradient-card border-border/50">
                  <CardHeader>
                    <CardTitle>Your NFTs</CardTitle>
                    <CardDescription>NFTs in your kiosks</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <NFTGrid nfts={nfts} loading={loading} />
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="transfer">
            <TransferInterface nfts={nfts} kiosks={kiosks} onTransferComplete={handleRefresh} />
          </TabsContent>
          <TabsContent value="royalties">
            <RoyaltyManager />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}