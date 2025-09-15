import { useEffect, useState, useCallback } from 'react';
import { useWallet } from '@suiet/wallet-kit';
import { Transaction } from '@mysten/sui/transactions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, HandCoins } from 'lucide-react';
import { getUserTransferPolicies, TransferPolicyInfo } from '@/lib/royalty-discovery';
import { Alert, AlertDescription } from './ui/alert';

export function RoyaltyManager() {
  const { connected, account, signAndExecuteTransactionBlock } = useWallet();
  const [policies, setPolicies] = useState<TransferPolicyInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRoyaltyData = useCallback(async () => {
    if (!connected || !account?.address) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const userPolicies = await getUserTransferPolicies(account.address);
      setPolicies(userPolicies);
      if (userPolicies.length === 0) {
        setError("No royalty policies found for your account.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load royalty data.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [connected, account?.address]);

  useEffect(() => {
    if (connected && account?.address) {
      loadRoyaltyData();
    }
  }, [connected, account?.address, loadRoyaltyData]);

  const handleWithdraw = async (policy: TransferPolicyInfo) => {
    if (!account) return;

    try {
      const typeArgument = policy.type.match(/<(.*)>/)?.[1];
      if (!typeArgument) {
        throw new Error("Could not determine the type for the transfer policy.");
      }
        
      const txb = new Transaction();
      txb.moveCall({
        target: '0x2::transfer_policy::withdraw',
        arguments: [
            txb.object(policy.id),
            txb.object(policy.capId),
            txb.pure.option('u64', null) // Withdraw all profits
        ],
        typeArguments: [typeArgument],
      });
      
      const result = await signAndExecuteTransactionBlock({
          transactionBlock: txb,
      });

      console.log('Withdrawal successful:', result);
      // You can add a success toast/notification here.
      loadRoyaltyData(); // Refresh data after withdrawal
    } catch (e) {
      console.error('Withdrawal failed:', e);
      // You can add an error toast/notification here.
    }
  };

  if (!connected) {
    return <p>Please connect your wallet.</p>
  }

  return (
    <Card className="bg-gradient-card border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
            Royalty Management
          <Button variant="outline" size="sm" onClick={loadRoyaltyData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
        <CardDescription>Withdraw royalties from your transfer policies.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-8 w-24" />
              </div>
            ))}
          </div>
        ) : error ? (
            <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        ) : policies.length > 0 ? (
          <div className="space-y-3">
            {policies.map((policy) => (
              <div key={policy.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg hover:bg-muted/30 transition-colors">
                <div>
                  <p className="font-medium">{`Policy: ${policy.id.slice(0, 8)}...${policy.id.slice(-6)}`}</p>
                  <p className="text-sm text-muted-foreground">
                    Balance: {parseInt(policy.balance, 10) / 1_000_000_000} SUI
                  </p>
                </div>
                <Button size="sm" onClick={() => handleWithdraw(policy)} disabled={parseInt(policy.balance, 10) === 0}>
                  <HandCoins className="w-4 h-4 mr-2" />
                  Withdraw
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No royalty policies found.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
