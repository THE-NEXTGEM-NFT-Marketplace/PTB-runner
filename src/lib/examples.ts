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

  nftStakingStake: {
    name: "NFT Staking: Stake NFT",
    description: "Stake NFT from kiosk into staking contract vault",
    json: JSON.stringify({
      "commands": [
        {
          "type": "moveCall",
          "target": "0xSTAKING_PACKAGE::staking::stake_nft",
          "arguments": [
            { "type": "object", "value": "0xSTAKING_VAULT" },
            { "type": "object", "value": "0xUSER_KIOSK" },
            { "type": "object", "value": "0xUSER_KIOSK_CAP" },
            { "type": "object", "value": "0xNFT_TO_STAKE" },
            { "type": "pure", "value": 30 }
          ],
          "typeArguments": ["0xNFT_PACKAGE::nft::NFT"],
          "assign": "stake_position"
        }
      ]
    }, null, 2)
  },

  nftStakingUnstake: {
    name: "NFT Staking: Unstake NFT",
    description: "Unstake NFT from staking contract vault",
    json: JSON.stringify({
      "commands": [
        {
          "type": "moveCall",
          "target": "0xSTAKING_PACKAGE::staking::unstake_nft",
          "arguments": [
            { "type": "object", "value": "0xSTAKING_VAULT" },
            { "type": "object", "value": "0xUSER_KIOSK" },
            { "type": "object", "value": "0xUSER_KIOSK_CAP" },
            { "type": "object", "value": "0xSTAKE_POSITION" }
          ],
          "typeArguments": ["0xNFT_PACKAGE::nft::NFT"],
          "assign": "unstaked_nft"
        },
        {
          "type": "moveCall",
          "target": "0x2::kiosk::place",
          "arguments": [
            { "type": "object", "value": "0xUSER_KIOSK" },
            { "type": "object", "value": "0xUSER_KIOSK_CAP" },
            { "type": "result", "ref": "unstaked_nft" }
          ],
          "typeArguments": ["0xNFT_PACKAGE::nft::NFT"]
        }
      ]
    }, null, 2)
  },

  nftStakingClaimRewards: {
    name: "NFT Staking: Claim Rewards",
    description: "Claim rewards from NFT staking",
    json: JSON.stringify({
      "commands": [
        {
          "type": "moveCall",
          "target": "0xSTAKING_PACKAGE::staking::claim_rewards",
          "arguments": [
            { "type": "object", "value": "0xSTAKING_VAULT" },
            { "type": "object", "value": "0xSTAKE_POSITION" }
          ],
          "typeArguments": ["0xNFT_PACKAGE::nft::NFT"],
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

  nftStakingComplex: {
    name: "NFT Staking: Complete Flow",
    description: "Stake NFT, claim rewards, and unstake in one transaction",
    json: JSON.stringify({
      "commands": [
        {
          "type": "moveCall",
          "target": "0xSTAKING_PACKAGE::staking::stake_nft",
          "arguments": [
            { "type": "object", "value": "0xSTAKING_VAULT" },
            { "type": "object", "value": "0xUSER_KIOSK" },
            { "type": "object", "value": "0xUSER_KIOSK_CAP" },
            { "type": "object", "value": "0xNFT_TO_STAKE" },
            { "type": "pure", "value": 30 }
          ],
          "typeArguments": ["0xNFT_PACKAGE::nft::NFT"],
          "assign": "stake_position"
        },
        {
          "type": "moveCall",
          "target": "0xSTAKING_PACKAGE::staking::claim_rewards",
          "arguments": [
            { "type": "object", "value": "0xSTAKING_VAULT" },
            { "type": "result", "ref": "stake_position" }
          ],
          "typeArguments": ["0xNFT_PACKAGE::nft::NFT"],
          "assign": "staking_rewards"
        },
        {
          "type": "transferObjects",
          "objects": [{ "type": "result", "ref": "staking_rewards" }],
          "recipient": "0xUSER_ADDRESS"
        },
        {
          "type": "moveCall",
          "target": "0xSTAKING_PACKAGE::staking::unstake_nft",
          "arguments": [
            { "type": "object", "value": "0xSTAKING_VAULT" },
            { "type": "object", "value": "0xUSER_KIOSK" },
            { "type": "object", "value": "0xUSER_KIOSK_CAP" },
            { "type": "result", "ref": "stake_position" }
          ],
          "typeArguments": ["0xNFT_PACKAGE::nft::NFT"],
          "assign": "unstaked_nft"
        },
        {
          "type": "moveCall",
          "target": "0x2::kiosk::place",
          "arguments": [
            { "type": "object", "value": "0xUSER_KIOSK" },
            { "type": "object", "value": "0xUSER_KIOSK_CAP" },
            { "type": "result", "ref": "unstaked_nft" }
          ],
          "typeArguments": ["0xNFT_PACKAGE::nft::NFT"]
        }
      ]
    }, null, 2)
  },

  nftStakingFromKiosk: {
    name: "NFT Staking: From Kiosk",
    description: "Stake NFT directly from user's kiosk into staking vault",
    json: JSON.stringify({
      "commands": [
        {
          "type": "moveCall",
          "target": "0xSTAKING_PACKAGE::staking::stake_nft_from_kiosk",
          "arguments": [
            { "type": "object", "value": "0xSTAKING_VAULT" },
            { "type": "object", "value": "0xUSER_KIOSK" },
            { "type": "object", "value": "0xUSER_KIOSK_CAP" },
            { "type": "object", "value": "0xNFT_IN_KIOSK" },
            { "type": "pure", "value": 90 }
          ],
          "typeArguments": ["0xNFT_PACKAGE::nft::NFT"],
          "assign": "stake_position"
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

  customFunctionExample: {
    name: "Custom Function Call",
    description: "Call any Move function with any argument pattern",
    json: JSON.stringify({
      "commands": [
        {
          "type": "moveCall",
          "target": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef::my_module::my_function",
          "arguments": [
            { "type": "pure", "value": "Hello World", "encoding": "utf8" },
            { "type": "object", "value": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" },
            { "type": "pure", "value": 42, "moveType": "u64" },
            {
              "type": "vector",
              "elements": [
                { "type": "pure", "value": "0x1111111111111111111111111111111111111111111111111111111111111111" },
                { "type": "pure", "value": "0x2222222222222222222222222222222222222222222222222222222222222222" }
              ]
            },
            {
              "type": "option",
              "some": { "type": "object", "value": "0xoptional_object_id" }
            }
          ],
          "typeArguments": [
            "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef::my_types::MyType",
            "0x2::sui::SUI"
          ],
          "assign": "custom_result"
        },
        {
          "type": "moveCall",
          "target": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef::other_module::process_result",
          "arguments": [
            { "type": "result", "ref": "custom_result" },
            { "type": "pure", "value": true }
          ],
          "typeArguments": ["0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef::my_types::MyType"]
        }
      ]
    }, null, 2)
  },

  flexibleArgumentExample: {
    name: "Flexible Arguments Demo",
    description: "Demonstrates all argument types in one function call",
    json: JSON.stringify({
      "commands": [
        {
          "type": "moveCall",
          "target": "0xPACKAGE::module::flexible_function",
          "arguments": [
            { "type": "pure", "value": "string_arg", "encoding": "ascii" },
            { "type": "pure", "value": 123, "moveType": "u64" },
            { "type": "pure", "value": true },
            { "type": "object", "value": "0xobject_id" },
            {
              "type": "vector",
              "elements": [
                { "type": "pure", "value": 1 },
                { "type": "pure", "value": 2 },
                { "type": "pure", "value": 3 }
              ]
            },
            {
              "type": "option",
              "some": { "type": "pure", "value": "has_value" }
            },
            { "type": "witness", "value": "0xwitness_type" }
          ],
          "typeArguments": ["0xPACKAGE::types::MyType"],
          "assign": "flexible_result"
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
  },

  transferPolicyCompleteFixed: {
    name: "Transfer Policy: Complete (Fixed)",
    description: "Create, share, and transfer a transfer policy with correct result referencing",
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
          "type": "shareObject",
          "object": { "type": "result", "ref": "policy" }
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
  }
};