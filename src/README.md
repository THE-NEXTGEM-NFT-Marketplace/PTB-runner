# Sui PTB Runner

A professional, security-first web application for executing Sui Programmable Transaction Blocks (PTBs) from JSON configurations.

## Features

- 🔒 **Security-First**: Human-readable transaction previews before execution
- 🎨 **Professional UI**: Clean, developer-friendly interface with dark theme
- 📝 **JSON Parser**: Robust validation for PTB command structures
- 🔗 **Wallet Integration**: Seamless connection with Sui wallets
- 📚 **Example Templates**: Pre-built PTB examples for learning
- ⚡ **Real-time Feedback**: Live status updates and error handling

## Getting Started

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Usage

1. **Connect Wallet**: Click "Connect Wallet" to connect your Sui wallet
2. **Input JSON**: Paste your PTB JSON configuration into the editor
3. **Review**: Click "Execute PTB" to see the security summary
4. **Sign**: Review the transaction details and approve to execute

## JSON Schema

The application accepts JSON with the following structure:

```json
{
  "commands": [
    {
      "type": "moveCall | transferObjects | splitCoins | mergeCoins",
      "assign": "optional_result_name",
      // ... command-specific properties
    }
  ]
}
```

### Supported Commands

#### moveCall
```json
{
  "type": "moveCall",
  "target": "0x2::coin::split",
  "arguments": [
    { "type": "object", "value": "0x..." },
    { "type": "pure", "value": 1000000 }
  ],
  "typeArguments": ["0x2::sui::SUI"],
  "assign": "split_result"
}
```

#### transferObjects
```json
{
  "type": "transferObjects",
  "objects": [
    { "type": "result", "ref": "split_result" }
  ],
  "recipient": "0x..."
}
```

#### splitCoins
```json
{
  "type": "splitCoins",
  "coin": { "type": "object", "value": "0x..." },
  "amounts": [1000000, 500000],
  "assign": "new_coins"
}
```

#### mergeCoins
```json
{
  "type": "mergeCoins",
  "destination": { "type": "object", "value": "0x..." },
  "sources": [
    { "type": "object", "value": "0x..." }
  ]
}
```

### Argument Types

- **`pure`**: Literal values (strings, numbers, booleans)
- **`object`**: Sui object IDs (must be valid object addresses)
- **`result`**: Reference to a previous command's result via `assign` name

## Example Templates

### Simple Split & Transfer
```json
{
  "commands": [
    {
      "type": "splitCoins",
      "coin": { "type": "object", "value": "0x123...abc" },
      "amounts": [1000000000],
      "assign": "split_result"
    },
    {
      "type": "transferObjects",
      "objects": [{ "type": "result", "ref": "split_result" }],
      "recipient": "0x456...def"
    }
  ]
}
```

### Move Function Call
```json
{
  "commands": [
    {
      "type": "moveCall",
      "target": "0x2::coin::mint_and_transfer",
      "arguments": [
        { "type": "pure", "value": 1000000 },
        { "type": "pure", "value": "0x789...ghi" }
      ],
      "typeArguments": ["0x2::sui::SUI"],
      "assign": "minted_coin"
    }
  ]
}
```

### Complex Multi-Step Transaction
```json
{
  "commands": [
    {
      "type": "splitCoins",
      "coin": { "type": "object", "value": "0x111...222" },
      "amounts": [500000000, 300000000],
      "assign": "split_coins"
    },
    {
      "type": "moveCall",
      "target": "0x2::pay::split_and_transfer",
      "arguments": [
        { "type": "result", "ref": "split_coins" },
        { "type": "pure", "value": "0x333...444" }
      ],
      "typeArguments": ["0x2::sui::SUI"]
    },
    {
      "type": "transferObjects",
      "objects": [{ "type": "result", "ref": "split_coins" }],
      "recipient": "0x555...666"
    }
  ]
}
```

## Security Features

### Transaction Preview
- **Human-readable summaries** of each command
- **Clear action descriptions** with argument details
- **Required approval step** before wallet signing
- **Command numbering** showing execution order

### Validation
- **JSON schema validation** with detailed error messages
- **Reference checking** for result dependencies
- **Type validation** for all arguments and commands
- **Object ID format validation**

### Error Handling
- **Descriptive error messages** for invalid JSON
- **Line-specific feedback** for parsing errors
- **Real-time status updates** during execution
- **Transaction failure handling** with clear explanations

## Architecture

### Components
- **PtbRunner**: Main application interface
- **WalletConnection**: Sui wallet integration
- **SecuritySummary**: Transaction preview modal
- **Parser**: JSON validation and command parsing
- **TransactionBuilder**: PTB construction and execution

### Libraries
- **@mysten/sui**: Sui blockchain interaction
- **@suiet/wallet-kit**: Wallet connection and signing
- **React + TypeScript**: Modern web framework
- **Tailwind CSS**: Utility-first styling
- **Shadcn/UI**: Professional component library

## Development

### Project Structure
```
src/
├── components/          # React components
│   ├── ui/             # Base UI components
│   ├── PtbRunner.tsx   # Main application
│   ├── WalletConnection.tsx
│   └── SecuritySummary.tsx
├── lib/                # Utilities and logic
│   ├── ptb-parser.ts   # JSON parsing and validation
│   ├── transaction-builder.ts # PTB construction
│   └── examples.ts     # Template examples
└── pages/              # Application pages
    └── Index.tsx
```

### Design System
The application uses a cohesive design system with:
- **Semantic color tokens** for consistent theming
- **Professional dark theme** optimized for developers
- **Smooth animations** and transitions
- **Clear visual hierarchy** for security and trust

## Contributing

This project follows modern web development best practices:
- TypeScript for type safety
- Semantic design tokens
- Component-based architecture
- Security-first approach
- Comprehensive error handling

## License

MIT License - feel free to use this project as a foundation for your own Sui applications.