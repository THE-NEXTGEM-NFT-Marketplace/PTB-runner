import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Globe, Loader2 } from 'lucide-react';
import { useNetwork, NetworkType } from '@/contexts/NetworkContext';

export function NetworkSwitcher() {
  const { currentNetwork, setNetwork, isChangingNetwork } = useNetwork();

  const getNetworkColor = (network: NetworkType) => {
    switch (network) {
      case 'mainnet':
        return 'bg-success text-success-foreground';
      case 'testnet':
        return 'bg-warning text-warning-foreground';
      case 'devnet':
        return 'bg-destructive text-destructive-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <Globe className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Network:</span>
      </div>
      
      <div className="flex items-center gap-2">
        {isChangingNetwork ? (
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Switching...</span>
          </div>
        ) : (
          <>
            <Badge variant="outline" className={getNetworkColor(currentNetwork)}>
              {currentNetwork.charAt(0).toUpperCase() + currentNetwork.slice(1)}
            </Badge>
            <Select 
              value={currentNetwork} 
              onValueChange={(value) => setNetwork(value as NetworkType)}
              disabled={isChangingNetwork}
            >
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mainnet">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-success"></div>
                    Mainnet
                  </div>
                </SelectItem>
                <SelectItem value="testnet">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-warning"></div>
                    Testnet
                  </div>
                </SelectItem>
                <SelectItem value="devnet">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-destructive"></div>
                    Devnet
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </>
        )}
      </div>
    </div>
  );
}