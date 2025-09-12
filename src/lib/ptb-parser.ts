// PTB JSON Parser - Converts JSON to structured commands for Sui TransactionBlock

export interface PtbArgument {
  type: "pure" | "object" | "result";
  value?: any;
  ref?: string;
}

export interface PtbCommand {
  type: "moveCall" | "transferObjects" | "splitCoins" | "mergeCoins";
  assign?: string;
  
  // moveCall specific
  target?: string;
  arguments?: PtbArgument[];
  typeArguments?: string[];
  
  // transferObjects specific
  objects?: PtbArgument[];
  recipient?: string;
  
  // splitCoins specific
  coin?: PtbArgument;
  amounts?: number[];
  
  // mergeCoins specific
  destination?: PtbArgument;
  sources?: PtbArgument[];
}

export interface PtbJson {
  commands: PtbCommand[];
}

export function parsePtbJson(jsonString: string): PtbCommand[] {
  try {
    const parsed = JSON.parse(jsonString) as PtbJson;
    
    if (!parsed || typeof parsed !== 'object') {
      throw new Error("Invalid JSON: Root must be an object");
    }
    
    if (!Array.isArray(parsed.commands)) {
      throw new Error("Invalid JSON: 'commands' must be an array");
    }
    
    if (parsed.commands.length === 0) {
      throw new Error("Invalid JSON: 'commands' array cannot be empty");
    }
    
    // Validate each command
    const validatedCommands = parsed.commands.map((command, index) => {
      return validateCommand(command, index);
    });
    
    // Validate result references
    validateResultReferences(validatedCommands);
    
    return validatedCommands;
    
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`JSON Parse Error: ${error.message}`);
    }
    throw error;
  }
}

function validateCommand(command: any, index: number): PtbCommand {
  const commandIndex = `Command ${index + 1}`;
  
  if (!command || typeof command !== 'object') {
    throw new Error(`${commandIndex}: Command must be an object`);
  }
  
  if (!command.type || typeof command.type !== 'string') {
    throw new Error(`${commandIndex}: Command must have a 'type' string property`);
  }
  
  const validTypes = ['moveCall', 'transferObjects', 'splitCoins', 'mergeCoins'];
  if (!validTypes.includes(command.type)) {
    throw new Error(`${commandIndex}: Invalid command type '${command.type}'. Must be one of: ${validTypes.join(', ')}`);
  }
  
  switch (command.type) {
    case 'moveCall':
      return validateMoveCall(command, commandIndex);
    case 'transferObjects':
      return validateTransferObjects(command, commandIndex);
    case 'splitCoins':
      return validateSplitCoins(command, commandIndex);
    case 'mergeCoins':
      return validateMergeCoins(command, commandIndex);
    default:
      throw new Error(`${commandIndex}: Unsupported command type: ${command.type}`);
  }
}

function validateMoveCall(command: any, commandIndex: string): PtbCommand {
  if (!command.target || typeof command.target !== 'string') {
    throw new Error(`${commandIndex}: moveCall requires a 'target' string property`);
  }
  
  // Validate target format (basic check for package::module::function)
  const targetParts = command.target.split('::');
  if (targetParts.length < 3) {
    throw new Error(`${commandIndex}: target must be in format 'package::module::function'`);
  }
  
  const result: PtbCommand = {
    type: 'moveCall',
    target: command.target,
  };
  
  if (command.arguments) {
    if (!Array.isArray(command.arguments)) {
      throw new Error(`${commandIndex}: 'arguments' must be an array`);
    }
    result.arguments = command.arguments.map((arg: any, argIndex: number) => 
      validateArgument(arg, `${commandIndex}, argument ${argIndex + 1}`)
    );
  }
  
  if (command.typeArguments) {
    if (!Array.isArray(command.typeArguments)) {
      throw new Error(`${commandIndex}: 'typeArguments' must be an array`);
    }
    result.typeArguments = command.typeArguments.filter((ta: any) => typeof ta === 'string');
  }
  
  if (command.assign && typeof command.assign === 'string') {
    result.assign = command.assign;
  }
  
  return result;
}

function validateTransferObjects(command: any, commandIndex: string): PtbCommand {
  if (!command.objects || !Array.isArray(command.objects)) {
    throw new Error(`${commandIndex}: transferObjects requires an 'objects' array`);
  }
  
  if (!command.recipient || typeof command.recipient !== 'string') {
    throw new Error(`${commandIndex}: transferObjects requires a 'recipient' string`);
  }
  
  return {
    type: 'transferObjects',
    objects: command.objects.map((obj: any, objIndex: number) => 
      validateArgument(obj, `${commandIndex}, object ${objIndex + 1}`)
    ),
    recipient: command.recipient,
  };
}

function validateSplitCoins(command: any, commandIndex: string): PtbCommand {
  if (!command.coin) {
    throw new Error(`${commandIndex}: splitCoins requires a 'coin' object`);
  }
  
  if (!command.amounts || !Array.isArray(command.amounts)) {
    throw new Error(`${commandIndex}: splitCoins requires an 'amounts' array`);
  }
  
  const amounts = command.amounts.map((amount: any, amountIndex: number) => {
    if (typeof amount !== 'number' || amount <= 0) {
      throw new Error(`${commandIndex}: amount ${amountIndex + 1} must be a positive number`);
    }
    return amount;
  });
  
  const result: PtbCommand = {
    type: 'splitCoins',
    coin: validateArgument(command.coin, `${commandIndex}, coin`),
    amounts,
  };
  
  if (command.assign && typeof command.assign === 'string') {
    result.assign = command.assign;
  }
  
  return result;
}

function validateMergeCoins(command: any, commandIndex: string): PtbCommand {
  if (!command.destination) {
    throw new Error(`${commandIndex}: mergeCoins requires a 'destination' object`);
  }
  
  if (!command.sources || !Array.isArray(command.sources)) {
    throw new Error(`${commandIndex}: mergeCoins requires a 'sources' array`);
  }
  
  return {
    type: 'mergeCoins',
    destination: validateArgument(command.destination, `${commandIndex}, destination`),
    sources: command.sources.map((src: any, srcIndex: number) => 
      validateArgument(src, `${commandIndex}, source ${srcIndex + 1}`)
    ),
  };
}

function validateArgument(arg: any, context: string): PtbArgument {
  if (!arg || typeof arg !== 'object') {
    throw new Error(`${context}: Argument must be an object`);
  }
  
  if (!arg.type || typeof arg.type !== 'string') {
    throw new Error(`${context}: Argument must have a 'type' string property`);
  }
  
  const validArgTypes = ['pure', 'object', 'result'];
  if (!validArgTypes.includes(arg.type)) {
    throw new Error(`${context}: Invalid argument type '${arg.type}'. Must be one of: ${validArgTypes.join(', ')}`);
  }
  
  switch (arg.type) {
    case 'pure':
    case 'object':
      if (arg.value === undefined) {
        throw new Error(`${context}: '${arg.type}' argument requires a 'value' property`);
      }
      return { type: arg.type, value: arg.value };
      
    case 'result':
      if (!arg.ref || typeof arg.ref !== 'string') {
        throw new Error(`${context}: 'result' argument requires a 'ref' string property`);
      }
      return { type: arg.type, ref: arg.ref };
      
    default:
      throw new Error(`${context}: Unsupported argument type: ${arg.type}`);
  }
}

function validateResultReferences(commands: PtbCommand[]): void {
  const assignedNames = new Set<string>();
  
  // Collect all assigned names first
  commands.forEach((command, index) => {
    if (command.assign) {
      if (assignedNames.has(command.assign)) {
        throw new Error(`Command ${index + 1}: Duplicate assign name '${command.assign}'`);
      }
      assignedNames.add(command.assign);
    }
  });
  
  // Validate all result references
  commands.forEach((command, index) => {
    const commandIndex = `Command ${index + 1}`;
    validateCommandResultRefs(command, commandIndex, assignedNames);
  });
}

function validateCommandResultRefs(command: PtbCommand, commandIndex: string, assignedNames: Set<string>): void {
  const checkArgument = (arg: PtbArgument, context: string) => {
    if (arg.type === 'result' && arg.ref) {
      if (!assignedNames.has(arg.ref)) {
        throw new Error(`${context}: Reference '${arg.ref}' not found in any previous command's assign property`);
      }
    }
  };
  
  switch (command.type) {
    case 'moveCall':
      command.arguments?.forEach((arg, argIndex) => 
        checkArgument(arg, `${commandIndex}, argument ${argIndex + 1}`)
      );
      break;
      
    case 'transferObjects':
      command.objects?.forEach((obj, objIndex) => 
        checkArgument(obj, `${commandIndex}, object ${objIndex + 1}`)
      );
      break;
      
    case 'splitCoins':
      if (command.coin) {
        checkArgument(command.coin, `${commandIndex}, coin`);
      }
      break;
      
    case 'mergeCoins':
      if (command.destination) {
        checkArgument(command.destination, `${commandIndex}, destination`);
      }
      command.sources?.forEach((src, srcIndex) => 
        checkArgument(src, `${commandIndex}, source ${srcIndex + 1}`)
      );
      break;
  }
}