// Transaction Block Builder - Converts parsed commands to Sui TransactionBlock

import { Transaction } from "@mysten/sui/transactions";
import { type PtbCommand, type PtbArgument } from "./ptb-parser";

export function constructTransactionBlock(commands: PtbCommand[]): Transaction {
  const txb = new Transaction();
  const resultMap = new Map<string, any>();
  
  for (const command of commands) {
    const result = executeCommand(txb, command, resultMap);
    
    // Store result if command has an assign name
    if (command.assign && result !== undefined) {
      resultMap.set(command.assign, result);
    }
  }
  
  return txb;
}

function executeCommand(
  txb: Transaction, 
  command: PtbCommand, 
  resultMap: Map<string, any>
): any {
  switch (command.type) {
    case 'moveCall':
      return executeMoveCall(txb, command, resultMap);
    case 'transferObjects':
      return executeTransferObjects(txb, command, resultMap);
    case 'splitCoins':
      return executeSplitCoins(txb, command, resultMap);
    case 'mergeCoins':
      return executeMergeCoins(txb, command, resultMap);
    default:
      throw new Error(`Unsupported command type: ${(command as any).type}`);
  }
}

function executeMoveCall(
  txb: Transaction, 
  command: PtbCommand, 
  resultMap: Map<string, any>
): any {
  if (!command.target) {
    throw new Error("moveCall command missing target");
  }
  
  const args = command.arguments?.map(arg => resolveArgument(txb, arg, resultMap)) || [];
  const typeArgs = command.typeArguments || [];
  
  return txb.moveCall({
    target: command.target,
    arguments: args,
    typeArguments: typeArgs,
  });
}

function executeTransferObjects(
  txb: Transaction, 
  command: PtbCommand, 
  resultMap: Map<string, any>
): void {
  if (!command.objects || !command.recipient) {
    throw new Error("transferObjects command missing objects or recipient");
  }
  
  const objects = command.objects.map(obj => resolveArgument(txb, obj, resultMap));
  
  txb.transferObjects(objects, command.recipient);
}

function executeSplitCoins(
  txb: Transaction, 
  command: PtbCommand, 
  resultMap: Map<string, any>
): any {
  if (!command.coin || !command.amounts) {
    throw new Error("splitCoins command missing coin or amounts");
  }
  
  const coin = resolveArgument(txb, command.coin, resultMap);
  const amounts = command.amounts.map(amount => txb.pure.u64(amount));
  
  return txb.splitCoins(coin, amounts);
}

function executeMergeCoins(
  txb: Transaction, 
  command: PtbCommand, 
  resultMap: Map<string, any>
): void {
  if (!command.destination || !command.sources) {
    throw new Error("mergeCoins command missing destination or sources");
  }
  
  const destination = resolveArgument(txb, command.destination, resultMap);
  const sources = command.sources.map(src => resolveArgument(txb, src, resultMap));
  
  txb.mergeCoins(destination, sources);
}

function resolveArgument(
  txb: Transaction, 
  arg: PtbArgument, 
  resultMap: Map<string, any>
): any {
  switch (arg.type) {
    case 'pure':
      // Handle different value types for pure arguments
      if (typeof arg.value === 'string') {
        return txb.pure.string(arg.value);
      } else if (typeof arg.value === 'number') {
        return txb.pure.u64(arg.value);
      } else if (typeof arg.value === 'boolean') {
        return txb.pure.bool(arg.value);
      } else {
        return txb.pure(arg.value);
      }
      
    case 'object':
      if (typeof arg.value !== 'string') {
        throw new Error(`Object argument value must be a string, got: ${typeof arg.value}`);
      }
      return txb.object(arg.value);
      
    case 'result':
      if (!arg.ref) {
        throw new Error("Result argument missing ref property");
      }
      
      const result = resultMap.get(arg.ref);
      if (result === undefined) {
        throw new Error(`Result reference '${arg.ref}' not found`);
      }
      return result;
      
    default:
      throw new Error(`Unsupported argument type: ${(arg as any).type}`);
  }
}