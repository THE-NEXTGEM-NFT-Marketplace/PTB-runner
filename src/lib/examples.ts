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
  },

  transferPolicyCreate: {
    name: "Transfer Policy: Create",
    description: "Create a transfer policy for an NFT collection",
    json: JSON.stringify({
      "commands": [
        {
          "type": "moveCall",
          "target": "0x2::transfer_policy::new",
          "arguments": [
            { "type": "pure", "value": "0xPUBLISHER_OBJECT_ID" }
          ],
          "typeArguments": ["0xPACKAGE::module::NFTType"],
          "assign": "policy"
        },
        {
          "type": "moveCall",
          "target": "0x2::transfer_policy::share_policy",
          "arguments": [
            { "type": "result", "ref": "policy" }
          ],
          "typeArguments": ["0xPACKAGE::module::NFTType"]
        }
      ]
    }, null, 2)
  },

  transferPolicyRule: {
    name: "Transfer Policy: Add Rule",
    description: "Add a royalty rule to transfer policy",
    json: JSON.stringify({
      "commands": [
        {
          "type": "moveCall",
          "target": "0x2::transfer_policy::add_rule",
          "arguments": [
            { "type": "pure", "value": "0x2::royalty_rule::Rule" },
            { "type": "object", "value": "0xPOLICY_ID" },
            { "type": "object", "value": "0xPOLICY_CAP" },
            { "type": "pure", "value": "0xCONFIG_OBJECT" }
          ],
          "typeArguments": ["0xPACKAGE::module::NFTType", "0x2::royalty_rule::Rule"]
        }
      ]
    }, null, 2)
  },

  stakingStake: {
    name: "Staking: Stake Tokens",
    description: "Stake tokens in a staking contract",
    json: JSON.stringify({
      "commands": [
        {
          "type": "moveCall",
          "target": "0xSTAKING_PACKAGE::staking::stake",
          "arguments": [
            { "type": "object", "value": "0xSTAKING_POOL" },
            { "type": "object", "value": "0xTOKEN_TO_STAKE" },
            { "type": "pure", "value": 365 }
          ],
          "typeArguments": ["0xTOKEN_PACKAGE::token::TOKEN"],
          "assign": "stake_position"
        }
      ]
    }, null, 2)
  },

  stakingUnstake: {
    name: "Staking: Unstake Tokens",
    description: "Unstake tokens from staking contract",
    json: JSON.stringify({
      "commands": [
        {
          "type": "moveCall",
          "target": "0xSTAKING_PACKAGE::staking::unstake",
          "arguments": [
            { "type": "object", "value": "0xSTAKING_POOL" },
            { "type": "object", "value": "0xSTAKE_POSITION" }
          ],
          "typeArguments": ["0xTOKEN_PACKAGE::token::TOKEN"],
          "assign": "unstaked_tokens"
        },
        {
          "type": "transferObjects",
          "objects": [{ "type": "result", "ref": "unstaked_tokens" }],
          "recipient": "0xUSER_ADDRESS"
        }
      ]
    }, null, 2)
  },

  stakingClaimRewards: {
    name: "Staking: Claim Rewards",
    description: "Claim staking rewards",
    json: JSON.stringify({
      "commands": [
        {
          "type": "moveCall",
          "target": "0xSTAKING_PACKAGE::staking::claim_rewards",
          "arguments": [
            { "type": "object", "value": "0xSTAKING_POOL" },
            { "type": "object", "value": "0xSTAKE_POSITION" }
          ],
          "typeArguments": ["0xTOKEN_PACKAGE::token::TOKEN"],
          "assign": "rewards"
        },
        {
          "type": "transferObjects",
          "objects": [{ "type": "result", "ref": "rewards" }],
          "recipient": "0xUSER_ADDRESS"
        }
      ]
    }, null, 2)
  },

  complexDeFi: {
    name: "DeFi: Complex Multi-Step",
    description: "Complex DeFi operation with multiple steps",
    json: JSON.stringify({
      "commands": [
        {
          "type": "splitCoins",
          "coin": { "type": "object", "value": "0xSUI_COIN" },
          "amounts": [1000000000],
          "assign": "sui_for_staking"
        },
        {
          "type": "moveCall",
          "target": "0xSTAKING_PACKAGE::staking::stake",
          "arguments": [
            { "type": "object", "value": "0xSTAKING_POOL" },
            { "type": "result", "ref": "sui_for_staking" },
            { "type": "pure", "value": 30 }
          ],
          "typeArguments": ["0x2::sui::SUI"],
          "assign": "stake_position"
        },
        {
          "type": "moveCall",
          "target": "0xSTAKING_PACKAGE::staking::claim_rewards",
          "arguments": [
            { "type": "object", "value": "0xSTAKING_POOL" },
            { "type": "result", "ref": "stake_position" }
          ],
          "typeArguments": ["0x2::sui::SUI"],
          "assign": "staking_rewards"
        },
        {
          "type": "transferObjects",
          "objects": [{ "type": "result", "ref": "staking_rewards" }],
          "recipient": "0xUSER_ADDRESS"
        }
      ]
    }, null, 2)
  },

  transferPolicyVectorExample: {
    name: "Transfer Policy: Batch Rules",
    description: "Add multiple royalty rules to transfer policy using vectors",
    json: JSON.stringify({
      "commands": [
        {
          "type": "moveCall",
          "target": "0x2::transfer_policy::add_rule",
          "arguments": [
            { "type": "pure", "value": "0x2::royalty_rule::Rule" },
            { "type": "object", "value": "0xPOLICY_ID" },
            { "type": "object", "value": "0xPOLICY_CAP" },
            { "type": "vector", "elements": [
              { "type": "pure", "value": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" },
              { "type": "pure", "value": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" }
            ]}
          ],
          "typeArguments": ["0xPACKAGE::module::NFTType", "0x2::royalty_rule::Rule"]
        }
      ]
    }, null, 2)
  },

  witnessExample: {
    name: "One-Time Witness",
    description: "Create a collection using one-time witness pattern",
    json: JSON.stringify({
      "commands": [
        {
          "type": "moveCall",
          "target": "0x2::package::create_witness",
          "arguments": [
            { "type": "witness", "value": "0xPUBLISHER_ID", "structType": "WITNESS_TYPE" }
          ],
          "typeArguments": ["0xPACKAGE::module::NFTType"],
          "assign": "witness"
        },
        {
          "type": "moveCall",
          "target": "0xPACKAGE::module::create_collection",
          "arguments": [
            { "type": "result", "ref": "witness" },
            { "type": "pure", "value": "My Collection", "encoding": "utf8" },
            { "type": "pure", "value": "A sample NFT collection", "encoding": "utf8" }
          ],
          "typeArguments": ["0xPACKAGE::module::NFTType"]
        }
      ]
    }, null, 2)
  },

  complexNestedArgs: {
    name: "Complex Nested Arguments",
    description: "Use complex nested structures and options",
    json: JSON.stringify({
      "commands": [
        {
          "type": "moveCall",
          "target": "0xPACKAGE::module::complex_function",
          "arguments": [
            {
              "type": "vector",
              "elements": [
                { "type": "pure", "value": 100 },
                { "type": "pure", "value": 200 },
                { "type": "pure", "value": 300 }
              ]
            },
            {
              "type": "option",
              "some": { "type": "pure", "value": "optional_value", "encoding": "ascii" }
            },
            {
              "type": "option",
              "none": true
            }
          ],
          "typeArguments": ["0xPACKAGE::module::ComplexType"]
        }
      ]
    }, null, 2)
  },

  transferPolicyComplete: {
    name: "Transfer Policy: Complete Setup",
    description: "Create, share, and transfer a transfer policy",
    json: JSON.stringify({
      "commands": [
        {
          "type": "moveCall",
          "target": "0x2::transfer_policy::new",
          "arguments": [
            { "type": "object", "value": "0xPUBLISHER_ID" }
          ],
          "typeArguments": ["0xPACKAGE::module::NFTType"],
          "assign": "policy"
        },
        {
          "type": "moveCall",
          "target": "0x2::transfer_policy::share_policy",
          "arguments": [
            { "type": "result", "ref": "policy" }
          ],
          "typeArguments": ["0xPACKAGE::module::NFTType"]
        },
        {
          "type": "transferObjects",
          "objects": [
            { "type": "result", "ref": "policy" }
          ],
          "recipient": "0xUSER_ADDRESS"
        }
      ]
    }, null, 2)
  },

  shareObjectExample: {
    name: "Share Object",
    description: "Make an object shared on the Sui network",
    json: JSON.stringify({
      "commands": [
        {
          "type": "shareObject",
          "object": { "type": "object", "value": "0xOBJECT_TO_SHARE" }
        }
      ]
    }, null, 2)
  }
};