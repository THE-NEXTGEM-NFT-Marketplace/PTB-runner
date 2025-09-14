import { useState } from "react";
// Use a workaround for the package exports issue
let Transaction: any;

// Try to load the Transaction class with error handling
if (typeof window !== 'undefined') {
  // Browser environment - use dynamic import
  (async () => {
    try {
      const txModule = await import('@mysten/sui/transactions');
      Transaction = txModule.Transaction;
    } catch (error) {
      console.warn('Failed to load @mysten/sui/transactions:', error);
    }
  })();
} else {
  // Node.js environment - use require
  try {
    const txModule = require('@mysten/sui/transactions');
    Transaction = txModule.Transaction;
  } catch (error) {
    console.warn('Failed to load @mysten/sui/transactions:', error);
  }
}

// Fallback implementation
if (!Transaction) {
  Transaction = class {
    constructor() {
      throw new Error('Transaction class not properly loaded - please refresh the page');
    }
  };
}
import { useWallet } from "@suiet/wallet-kit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WalletConnection } from "./WalletConnection";
import { SecuritySummary } from "./SecuritySummary";
import { parsePtbJson, type PtbCommand } from "@/lib/ptb-parser";
import { constructTransactionBlock } from "@/lib/transaction-builder";
import { EXAMPLE_TEMPLATES } from "@/lib/examples";
import { AlertCircle, Play, FileText, Copy, Check } from "lucide-react";
import { toast } from "sonner";

type ExecutionStatus = "idle" | "parsing" | "confirming" | "executing" | "success" | "error";

export function PtbRunner() {
  const [jsonInput, setJsonInput] = useState("");
  const [commands, setCommands] = useState<PtbCommand[]>([]);
  const [status, setStatus] = useState<ExecutionStatus>("idle");
  const [error, setError] = useState<string>("");
  const [txResult, setTxResult] = useState<string>("");
  const [showSummary, setShowSummary] = useState(false);
  const [copied, setCopied] = useState(false);

  const { connected, signAndExecuteTransaction } = useWallet();

  const handleParse = () => {
    try {
      setError("");
      setStatus("parsing");
      
      const parsedCommands = parsePtbJson(jsonInput);
      setCommands(parsedCommands);
      setShowSummary(true);
      setStatus("confirming");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse JSON");
      setStatus("error");
    }
  };

  const handleExecute = async () => {
    if (!connected || !signAndExecuteTransaction) {
      toast.error("Please connect your wallet first");
      return;
    }

    try {
      setStatus("executing");
      
      const txb = constructTransactionBlock(commands);
      
      const result = await signAndExecuteTransaction({
        transaction: txb,
      });

      setTxResult(result.digest || "Transaction completed");
      setStatus("success");
      toast.success("Transaction executed successfully!");
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Transaction failed";
      setError(errorMessage);
      setStatus("error");
      toast.error(errorMessage);
    }
  };

  const handleCancel = () => {
    setShowSummary(false);
    setStatus("idle");
  };

  const handleCopyExample = (template: string) => {
    setJsonInput(template);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Template copied to editor");
  };

  const getStatusBadge = () => {
    const statusConfigs = {
      idle: { variant: "secondary" as const, text: "Ready", className: "" },
      parsing: { variant: "default" as const, text: "Parsing...", className: "" },
      confirming: { variant: "default" as const, text: "Awaiting Confirmation", className: "" },
      executing: { variant: "default" as const, text: "Executing...", className: "" },
      success: { variant: "secondary" as const, text: "Success", className: "status-success" },
      error: { variant: "destructive" as const, text: "Error", className: "" },
    };
    
    const config = statusConfigs[status];
    return (
      <Badge variant={config.variant} className={config.className}>
        {config.text}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-subtle p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-primary rounded-full text-primary-foreground font-semibold shadow-glow">
            <FileText className="w-4 h-4" />
            Sui PTB Runner
          </div>
          <h1 className="text-4xl font-bold tracking-tight">
            Programmable Transaction Block Runner
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Execute Sui PTBs from JSON with security-first validation and clear transaction previews
          </p>
        </div>

        {/* Status & Wallet */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {getStatusBadge()}
            {txResult && (
              <a
                href={`https://suiexplorer.com/txblock/${txResult}?network=testnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary-glow transition-colors"
              >
                View Transaction →
              </a>
            )}
          </div>
          <WalletConnection />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* JSON Input */}
          <Card className="bg-gradient-card border-border/50 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                PTB JSON Input
              </CardTitle>
              <CardDescription>
                Paste your Programmable Transaction Block JSON structure
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder="Paste your PTB JSON here..."
                className="min-h-[400px] code-editor bg-editor-background border-border/50 focus:border-primary/50 transition-colors"
                disabled={status === "executing"}
              />
              
              <div className="flex gap-2">
                <Button
                  onClick={handleParse}
                  disabled={!jsonInput.trim() || status === "executing" || !connected}
                  className="flex items-center gap-2 bg-primary hover:bg-primary-glow transition-smooth"
                >
                  <Play className="w-4 h-4" />
                  Execute PTB
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => setJsonInput("")}
                  disabled={status === "executing"}
                >
                  Clear
                </Button>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Templates & Examples */}
          <Card className="bg-gradient-card border-border/50 shadow-card">
            <CardHeader>
              <CardTitle>Example Templates</CardTitle>
              <CardDescription>
                Click to load pre-built PTB examples
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="examples" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="examples">Examples</TabsTrigger>
                  <TabsTrigger value="schema">Schema</TabsTrigger>
                </TabsList>
                
                <TabsContent value="examples" className="space-y-3 mt-4">
                  {Object.entries(EXAMPLE_TEMPLATES).map(([key, template]) => (
                    <div
                      key={key}
                      className="p-4 border border-border/50 rounded-lg hover:border-primary/50 transition-colors cursor-pointer group"
                      onClick={() => handleCopyExample(template.json)}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-sm group-hover:text-primary transition-colors">
                            {template.name}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            {template.description}
                          </p>
                        </div>
                        {copied ? (
                          <Check className="w-4 h-4 text-success" />
                        ) : (
                          <Copy className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        )}
                      </div>
                    </div>
                  ))}
                </TabsContent>
                
                <TabsContent value="schema" className="mt-4">
                  <div className="text-sm space-y-3">
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <h4 className="font-semibold mb-2">Supported Commands:</h4>
                      <ul className="text-xs space-y-1 text-muted-foreground">
                        <li>• <code>moveCall</code> - Call Sui Move functions</li>
                        <li>• <code>transferObjects</code> - Transfer objects to recipients</li>
                        <li>• <code>splitCoins</code> - Split coins into amounts</li>
                        <li>• <code>mergeCoins</code> - Merge coins together</li>
                      </ul>
                    </div>
                    
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <h4 className="font-semibold mb-2">Argument Types:</h4>
                      <ul className="text-xs space-y-1 text-muted-foreground">
                        <li>• <code>pure</code> - Literal values (string, number, boolean)</li>
                        <li>• <code>object</code> - Object IDs</li>
                        <li>• <code>result</code> - Reference to previous command results</li>
                      </ul>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Security Summary Modal */}
        <SecuritySummary
          open={showSummary}
          commands={commands}
          onConfirm={handleExecute}
          onCancel={handleCancel}
          loading={status === "executing"}
        />
      </div>
    </div>
  );
}