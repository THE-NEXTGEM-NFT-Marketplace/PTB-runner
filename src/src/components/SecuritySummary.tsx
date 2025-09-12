import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { type PtbCommand } from "@/lib/ptb-parser";
import { Shield, AlertTriangle, ArrowRight, Code2, Send, Scissors, Merge } from "lucide-react";

interface SecuritySummaryProps {
  open: boolean;
  commands: PtbCommand[];
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

export function SecuritySummary({ open, commands, onConfirm, onCancel, loading }: SecuritySummaryProps) {
  const getCommandIcon = (type: string) => {
    switch (type) {
      case "moveCall":
        return <Code2 className="w-4 h-4" />;
      case "transferObjects":
        return <Send className="w-4 h-4" />;
      case "splitCoins":
        return <Scissors className="w-4 h-4" />;
      case "mergeCoins":
        return <Merge className="w-4 h-4" />;
      default:
        return <Code2 className="w-4 h-4" />;
    }
  };

  const getCommandDescription = (command: PtbCommand) => {
    switch (command.type) {
      case "moveCall":
        return (
          <div className="space-y-1">
            <p className="text-sm">
              Call function <code className="bg-muted px-1 rounded text-xs">{command.target}</code>
            </p>
            {command.arguments && command.arguments.length > 0 && (
              <p className="text-xs text-muted-foreground">
                with {command.arguments.length} argument{command.arguments.length !== 1 ? 's' : ''}
              </p>
            )}
            {command.typeArguments && command.typeArguments.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Type arguments: {command.typeArguments.join(', ')}
              </p>
            )}
          </div>
        );
      
      case "transferObjects":
        return (
          <div className="space-y-1">
            <p className="text-sm">
              Transfer {command.objects.length} object{command.objects.length !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-muted-foreground">
              to recipient: <code className="bg-muted px-1 rounded">{command.recipient}</code>
            </p>
          </div>
        );
      
      case "splitCoins":
        return (
          <div className="space-y-1">
            <p className="text-sm">Split coins into {command.amounts.length} amount{command.amounts.length !== 1 ? 's' : ''}</p>
            <p className="text-xs text-muted-foreground">
              Amounts: {command.amounts.join(', ')}
            </p>
          </div>
        );
      
      case "mergeCoins":
        return (
          <div className="space-y-1">
            <p className="text-sm">Merge {command.sources.length} coin{command.sources.length !== 1 ? 's' : ''} into destination</p>
            <p className="text-xs text-muted-foreground">
              Consolidating coin objects
            </p>
          </div>
        );
      
      default:
        return <p className="text-sm">Unknown command type: {command.type}</p>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto bg-gradient-card border-border/50">
        <DialogHeader className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-warning/20 rounded-full flex items-center justify-center">
              <Shield className="w-5 h-5 text-warning" />
            </div>
            <div>
              <DialogTitle className="text-xl">Transaction Security Review</DialogTitle>
              <DialogDescription>
                Please review the following transaction details before signing
              </DialogDescription>
            </div>
          </div>

          <Alert className="status-warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Security Notice:</strong> This transaction will be executed on the Sui blockchain and cannot be reversed. 
              Please verify all details carefully before proceeding.
            </AlertDescription>
          </Alert>
        </DialogHeader>

        <div className="space-y-6">
          {/* Transaction Summary */}
          <Card className="bg-muted/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                Transaction Overview
                <Badge variant="secondary">{commands.length} command{commands.length !== 1 ? 's' : ''}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                This transaction will execute {commands.length} command{commands.length !== 1 ? 's' : ''} in sequence on the Sui network.
              </p>
            </CardContent>
          </Card>

          {/* Command Details */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Command Details</h3>
            
            {commands.map((command, index) => (
              <Card key={index} className="bg-card/50 border-border/30">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center text-xs font-medium">
                      {index + 1}
                    </div>
                    <div className="flex items-center gap-2">
                      {getCommandIcon(command.type)}
                      <Badge variant="outline" className="text-xs">
                        {command.type}
                      </Badge>
                    </div>
                    {command.assign && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ArrowRight className="w-3 h-3" />
                        <code className="bg-muted px-1 rounded">{command.assign}</code>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {getCommandDescription(command)}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 bg-primary hover:bg-primary-glow transition-smooth"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2" />
                  Executing...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  Approve & Sign Transaction
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}