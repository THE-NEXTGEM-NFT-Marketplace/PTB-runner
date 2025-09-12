// Example PTB JSON templates for testing and learning

export const EXAMPLE_TEMPLATES = {
  splitAndTransfer: {
    name: "Split & Transfer Coins",
    description: "Split SUI coins and transfer to recipient",
    json: JSON.stringify({
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
    }, null, 2)
  },
  
  moveCallExample: {
    name: "Move Call Example",
    description: "Call a Sui Move function with arguments",
    json: JSON.stringify({
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
    }, null, 2)
  },
  
  mergeCoinsExample: {
    name: "Merge Coins",
    description: "Merge multiple coins into one",
    json: JSON.stringify({
      "commands": [
        {
          "type": "mergeCoins",
          "destination": { "type": "object", "value": "0xaaa...bbb" },
          "sources": [
            { "type": "object", "value": "0xccc...ddd" },
            { "type": "object", "value": "0xeee...fff" }
          ]
        }
      ]
    }, null, 2)
  },
  
  complexExample: {
    name: "Complex Multi-Step",
    description: "Multiple commands with result chaining",
    json: JSON.stringify({
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
    }, null, 2)
  },

  kioskPlaceAndList: {
    name: "Kiosk: Place & List",
    description: "Place item in kiosk and list for sale",
    json: JSON.stringify({
      "commands": [
        {
          "type": "moveCall",
          "target": "0x2::kiosk::place",
          "arguments": [
            { "type": "object", "value": "0xKIOSK_ID" },
            { "type": "object", "value": "0xKIOSK_CAP" },
            { "type": "object", "value": "0xITEM_TO_PLACE" }
          ],
          "typeArguments": ["0xPACKAGE::module::ItemType"]
        },
        {
          "type": "moveCall",
          "target": "0x2::kiosk::list",
          "arguments": [
            { "type": "object", "value": "0xKIOSK_ID" },
            { "type": "object", "value": "0xKIOSK_CAP" },
            { "type": "pure", "value": "0xITEM_ID" },
            { "type": "pure", "value": 1000000000 }
          ],
          "typeArguments": ["0xPACKAGE::module::ItemType"]
        }
      ]
    }, null, 2)
  },

  kioskPurchase: {
    name: "Kiosk: Purchase Item",
    description: "Purchase an item from a kiosk",
    json: JSON.stringify({
      "commands": [
        {
          "type": "moveCall",
          "target": "0x2::kiosk::purchase",
          "arguments": [
            { "type": "object", "value": "0xKIOSK_ID" },
            { "type": "pure", "value": "0xITEM_ID" },
            { "type": "object", "value": "0xPAYMENT_COIN" }
          ],
          "typeArguments": ["0xPACKAGE::module::ItemType"],
          "assign": "purchased_item"
        },
        {
          "type": "transferObjects",
          "objects": [{ "type": "result", "ref": "purchased_item" }],
          "recipient": "0xBUYER_ADDRESS"
        }
      ]
    }, null, 2)
  },

  kioskDelist: {
    name: "Kiosk: Delist Item",
    description: "Remove item from kiosk listing",
    json: JSON.stringify({
      "commands": [
        {
          "type": "moveCall",
          "target": "0x2::kiosk::delist",
          "arguments": [
            { "type": "object", "value": "0xKIOSK_ID" },
            { "type": "object", "value": "0xKIOSK_CAP" },
            { "type": "pure", "value": "0xITEM_ID" }
          ],
          "typeArguments": ["0xPACKAGE::module::ItemType"]
        }
      ]
    }, null, 2)
  },

  kioskWithdrawProfits: {
    name: "Kiosk: Withdraw Profits",
    description: "Withdraw profits from kiosk sales",
    json: JSON.stringify({
      "commands": [
        {
          "type": "moveCall",
          "target": "0x2::kiosk::withdraw",
          "arguments": [
            { "type": "object", "value": "0xKIOSK_ID" },
            { "type": "object", "value": "0xKIOSK_CAP" },
            { "type": "pure", "value": 1000000000 }
          ],
          "typeArguments": ["0x2::sui::SUI"],
          "assign": "withdrawn_profits"
        },
        {
          "type": "transferObjects",
          "objects": [{ "type": "result", "ref": "withdrawn_profits" }],
          "recipient": "0xOWNER_ADDRESS"
        }
      ]
    }, null, 2)
  }
};