import { useWallet } from "@suiet/wallet-kit";
import { ConnectButton } from "@suiet/wallet-kit";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, LogOut } from "lucide-react";

export function WalletConnection() {
  const { connected, account, disconnect } = useWallet();

  if (connected && account) {
    return (
      <Card className="bg-gradient-card border-success/20 shadow-card">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-success/20 rounded-full flex items-center justify-center">
            <Wallet className="w-4 h-4 text-success" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="status-success text-xs">
                Connected
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {account.address ? 
                `${account.address.slice(0, 6)}...${account.address.slice(-4)}` 
                : 'Connected'
              }
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => disconnect()}
            className="hover:bg-destructive/20 hover:text-destructive transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <ConnectButton
      className="bg-primary hover:bg-primary-glow transition-smooth shadow-elegant text-primary-foreground"
    >
      Connect Wallet
    </ConnectButton>
  );
}