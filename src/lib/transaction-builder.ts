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
    case 'shareObject':
      return executeShareObject(txb, command, resultMap);
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
  const recipientArg = txb.pure.address(command.recipient);
  
  txb.transferObjects(objects, recipientArg);
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

function executeShareObject(
  txb: Transaction,
  command: PtbCommand,
  resultMap: Map<string, any>
): any {
  if (!command.object) {
    throw new Error("shareObject command missing object");
  }

  const object = resolveArgument(txb, command.object, resultMap);
  return txb.shareObject(object);
}

function resolveArgument(
  txb: Transaction,
  arg: PtbArgument,
  resultMap: Map<string, any>
): any {
  switch (arg.type) {
    case 'pure':
      // Handle different value types for pure arguments with enhanced options
      if (typeof arg.value === 'string') {
        // Auto-detect Sui address-like strings and encode as address
        if (isLikelySuiAddress(arg.value)) {
          return txb.pure.address(arg.value);
        }

        // Handle explicit encoding options
        if (arg.encoding === 'ascii') {
          return txb.pure.ascii(arg.value);
        } else if (arg.encoding === 'hex') {
          return txb.pure(Array.from(Buffer.from(arg.value, 'hex')));
        } else {
          // Default to UTF-8 string
          return txb.pure.string(arg.value);
        }
      } else if (typeof arg.value === 'number') {
        // Handle different number sizes
        if (Number.isInteger(arg.value)) {
          if (arg.value >= 0 && arg.value <= 255) {
            return txb.pure.u8(arg.value);
          } else if (arg.value >= 0 && arg.value <= 65535) {
            return txb.pure.u16(arg.value);
          } else if (arg.value >= 0 && arg.value <= 4294967295) {
            return txb.pure.u32(arg.value);
          } else if (arg.value >= 0 && arg.value <= Number.MAX_SAFE_INTEGER) {
            return txb.pure.u64(BigInt(arg.value));
          } else {
            return txb.pure.u128(BigInt(arg.value));
          }
        } else {
          return txb.pure.u64(BigInt(Math.round(arg.value)));
        }
      } else if (typeof arg.value === 'boolean') {
        return txb.pure.bool(arg.value);
      } else if (typeof arg.value === 'bigint') {
        return txb.pure.u256(arg.value);
      } else if (Array.isArray(arg.value)) {
        // Handle byte arrays
        return txb.pure(arg.value);
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

    case 'vector':
      if (!arg.elements || !Array.isArray(arg.elements)) {
        throw new Error("Vector argument missing elements array");
      }

      if (arg.elements.length === 0) {
        throw new Error("Vector argument cannot be empty - use Option<T> for optional empty vectors");
      }

      try {
        const resolvedElements = arg.elements.map(elem =>
          resolveArgument(txb, elem, resultMap)
        );
        return resolvedElements;
      } catch (error) {
        throw new Error(`Vector element resolution failed: ${error instanceof Error ? error.message : String(error)}`);
      }

    case 'option':
      if (arg.none) {
        return { None: true }; // Sui's Option::None as a struct
      } else if (arg.some) {
        try {
          return { Some: resolveArgument(txb, arg.some, resultMap) }; // Sui's Option::Some as a struct
        } catch (error) {
          throw new Error(`Option value resolution failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else {
        throw new Error("Option argument must have either 'none' or 'some' property");
      }

    case 'witness':
      if (typeof arg.value !== 'string') {
        throw new Error(`Witness argument value must be a string, got: ${typeof arg.value}`);
      }
      // Witness objects in Sui are typically used for one-time witness patterns
      // We create a pure value with the witness type
      return txb.object(arg.value);

    default:
      throw new Error(`Unsupported argument type: ${(arg as any).type}`);
  }
}

function isLikelySuiAddress(value: string): boolean {
  // Heuristic: hex string starting with 0x and at least 40 hex chars total length
  if (typeof value !== 'string') return false;
  if (!value.startsWith('0x')) return false;
  const hex = value.slice(2);
  if (hex.length < 40) return false;
  return /^[0-9a-fA-F]+$/.test(hex);
}