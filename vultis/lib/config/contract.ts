// ─── Contract Addresses ───────────────────────────────────────────────────────
// Set these in .env.local after deployment.

export const VAULTIS_ADDRESS = (process.env.NEXT_PUBLIC_VAULTIS_ADDRESS ??
  "") as `0x${string}`;

export const VAULTIS_LENS_ADDRESS = (process.env
  .NEXT_PUBLIC_VAULTIS_LENS_ADDRESS ?? "") as `0x${string}`;

export const GOVERNANCE_TOKEN_ADDRESS = (process.env
  .NEXT_PUBLIC_GOVERNANCE_TOKEN_ADDRESS ?? "") as `0x${string}`;

// ─── Vaultis ABI (core contract) ───────────────────────────────────────────────
// Holds: state, all writes, and getTallyHandles (the one FHE-touching view
// that had to stay here since it unwraps euint64 storage directly).
//
// getCurrentPhase, getPhaseDeadlines, getTimeUntilNextPhase, getAllProposals,
// getResults, getArchive, isAbandoned all moved to VaultisLens — see below.

export const VAULTIS_ABI = [
  {
    inputs: [
      {
        internalType: "address",
        name: "_governanceToken",
        type: "address",
      },
      {
        internalType: "uint64",
        name: "_defaultProposalDuration",
        type: "uint64",
      },
      {
        internalType: "uint64",
        name: "_defaultVoteDuration",
        type: "uint64",
      },
      {
        internalType: "uint64",
        name: "_defaultVetoDuration",
        type: "uint64",
      },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [],
    name: "AlreadyUsed",
    type: "error",
  },
  {
    inputs: [],
    name: "CapReached",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint8",
        name: "got",
        type: "uint8",
      },
      {
        internalType: "uint8",
        name: "expected",
        type: "uint8",
      },
    ],
    name: "InvalidEncryptedInput",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidInput",
    type: "error",
  },
  {
    inputs: [],
    name: "NotFinished",
    type: "error",
  },
  {
    inputs: [],
    name: "NotProposalPhase",
    type: "error",
  },
  {
    inputs: [],
    name: "NotTallyPhase",
    type: "error",
  },
  {
    inputs: [],
    name: "NotVetoPhase",
    type: "error",
  },
  {
    inputs: [],
    name: "NotVotingPhase",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "owner",
        type: "address",
      },
    ],
    name: "OwnableInvalidOwner",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "OwnableUnauthorizedAccount",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "int32",
        name: "value",
        type: "int32",
      },
    ],
    name: "SecurityZoneOutOfBounds",
    type: "error",
  },
  {
    inputs: [],
    name: "Unauthorized",
    type: "error",
  },
  {
    inputs: [],
    name: "WindowClosed",
    type: "error",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "cycleId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "approvedCount",
        type: "uint256",
      },
    ],
    name: "AllocationsPublished",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "cycleId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "voter",
        type: "address",
      },
    ],
    name: "BallotCast",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "cycleId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "string",
        name: "reason",
        type: "string",
      },
    ],
    name: "CycleAbandoned",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "cycleId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "string",
        name: "label",
        type: "string",
      },
      {
        indexed: false,
        internalType: "uint64",
        name: "proposalEndsAt",
        type: "uint64",
      },
      {
        indexed: false,
        internalType: "uint64",
        name: "voteEndsAt",
        type: "uint64",
      },
    ],
    name: "CycleOpened",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "previousOwner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "OwnershipTransferred",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "cycleId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "enum Vaultis.Phase",
        name: "newPhase",
        type: "uint8",
      },
    ],
    name: "PhaseAdvanced",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "cycleId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "proposalId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "proposer",
        type: "address",
      },
    ],
    name: "ProposalSubmitted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "cycleId",
        type: "uint256",
      },
    ],
    name: "TallyFinalized",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "cycleId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "proposalId",
        type: "uint256",
      },
    ],
    name: "VetoCast",
    type: "event",
  },
  {
    inputs: [],
    name: "MAX_PROPOSALS",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "QUORUM_BPS",
    outputs: [
      {
        internalType: "uint16",
        name: "",
        type: "uint16",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "reason",
        type: "string",
      },
    ],
    name: "abandonCycle",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "archive",
    outputs: [
      {
        internalType: "uint256",
        name: "cycleId",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "approvedCount",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "rejectedCount",
        type: "uint256",
      },
      {
        internalType: "uint64",
        name: "totalAllocated",
        type: "uint64",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "i",
        type: "uint256",
      },
    ],
    name: "archiveAt",
    outputs: [
      {
        internalType: "uint256",
        name: "cid",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "approvedCount",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "rejectedCount",
        type: "uint256",
      },
      {
        internalType: "uint64",
        name: "totalAllocated",
        type: "uint64",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "archiveLength",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "nullifier",
        type: "bytes32",
      },
      {
        internalType: "uint256[]",
        name: "proposalIds",
        type: "uint256[]",
      },
      {
        components: [
          {
            internalType: "uint256",
            name: "ctHash",
            type: "uint256",
          },
          {
            internalType: "uint8",
            name: "securityZone",
            type: "uint8",
          },
          {
            internalType: "uint8",
            name: "utype",
            type: "uint8",
          },
          {
            internalType: "bytes",
            name: "signature",
            type: "bytes",
          },
        ],
        internalType: "struct InEuint64[]",
        name: "encForWeights",
        type: "tuple[]",
      },
      {
        components: [
          {
            internalType: "uint256",
            name: "ctHash",
            type: "uint256",
          },
          {
            internalType: "uint8",
            name: "securityZone",
            type: "uint8",
          },
          {
            internalType: "uint8",
            name: "utype",
            type: "uint8",
          },
          {
            internalType: "bytes",
            name: "signature",
            type: "bytes",
          },
        ],
        internalType: "struct InEuint64[]",
        name: "encAgainstWeights",
        type: "tuple[]",
      },
    ],
    name: "castBallot",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "cycleId",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "cycleProposals",
    outputs: [
      {
        internalType: "address",
        name: "recipient",
        type: "address",
      },
      {
        internalType: "address",
        name: "token",
        type: "address",
      },
      {
        internalType: "uint64",
        name: "encAmountHint",
        type: "uint64",
      },
      {
        internalType: "uint64",
        name: "unlockAt",
        type: "uint64",
      },
      {
        internalType: "string",
        name: "title",
        type: "string",
      },
      {
        internalType: "string",
        name: "rationale",
        type: "string",
      },
      {
        internalType: "enum Vaultis.Category",
        name: "category",
        type: "uint8",
      },
      {
        internalType: "address",
        name: "proposer",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "cid",
        type: "uint256",
      },
    ],
    name: "cycleProposalsLength",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "defaultProposalDuration",
    outputs: [
      {
        internalType: "uint64",
        name: "",
        type: "uint64",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "defaultVetoDuration",
    outputs: [
      {
        internalType: "uint64",
        name: "",
        type: "uint64",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "defaultVoteDuration",
    outputs: [
      {
        internalType: "uint64",
        name: "",
        type: "uint64",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "finalAgainstCounts",
    outputs: [
      {
        internalType: "uint64",
        name: "",
        type: "uint64",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "finalForCounts",
    outputs: [
      {
        internalType: "uint64",
        name: "",
        type: "uint64",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "finalize",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "cid",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
    ],
    name: "getProposal",
    outputs: [
      {
        internalType: "address",
        name: "recipient",
        type: "address",
      },
      {
        internalType: "address",
        name: "token",
        type: "address",
      },
      {
        internalType: "uint64",
        name: "encAmountHint",
        type: "uint64",
      },
      {
        internalType: "uint64",
        name: "unlockAt",
        type: "uint64",
      },
      {
        internalType: "string",
        name: "title",
        type: "string",
      },
      {
        internalType: "string",
        name: "rationale",
        type: "string",
      },
      {
        internalType: "enum Vaultis.Category",
        name: "category",
        type: "uint8",
      },
      {
        internalType: "address",
        name: "proposer",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getTallyHandles",
    outputs: [
      {
        internalType: "uint256[]",
        name: "forHandles",
        type: "uint256[]",
      },
      {
        internalType: "uint256[]",
        name: "againstHandles",
        type: "uint256[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "governanceToken",
    outputs: [
      {
        internalType: "contract IERC20",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "label",
        type: "string",
      },
      {
        internalType: "uint64",
        name: "_proposalEnd",
        type: "uint64",
      },
      {
        internalType: "uint64",
        name: "_voteEnd",
        type: "uint64",
      },
      {
        internalType: "uint64",
        name: "_vetoEnd",
        type: "uint64",
      },
    ],
    name: "openCycle",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "label",
        type: "string",
      },
    ],
    name: "openNextCycle",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "phase",
    outputs: [
      {
        internalType: "enum Vaultis.Phase",
        name: "",
        type: "uint8",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "proposalApproved",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "proposalCount",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "proposalEndsAt",
    outputs: [
      {
        internalType: "uint64",
        name: "",
        type: "uint64",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint64[]",
        name: "forCounts",
        type: "uint64[]",
      },
      {
        internalType: "uint64[]",
        name: "againstCounts",
        type: "uint64[]",
      },
    ],
    name: "publishAllocations",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "renounceOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "resultsPublished",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint64",
        name: "p",
        type: "uint64",
      },
      {
        internalType: "uint64",
        name: "v",
        type: "uint64",
      },
      {
        internalType: "uint64",
        name: "x",
        type: "uint64",
      },
    ],
    name: "setDefaultDurations",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "recipient",
        type: "address",
      },
      {
        internalType: "address",
        name: "token",
        type: "address",
      },
      {
        internalType: "uint64",
        name: "encAmountHint",
        type: "uint64",
      },
      {
        internalType: "uint64",
        name: "unlockAt",
        type: "uint64",
      },
      {
        internalType: "string",
        name: "title",
        type: "string",
      },
      {
        internalType: "string",
        name: "rationale",
        type: "string",
      },
      {
        internalType: "enum Vaultis.Category",
        name: "category",
        type: "uint8",
      },
    ],
    name: "submitProposal",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    name: "usedNullifier",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "vetoEndsAt",
    outputs: [
      {
        internalType: "uint64",
        name: "",
        type: "uint64",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "proposalId",
        type: "uint256",
      },
    ],
    name: "vetoProposal",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "voteEndsAt",
    outputs: [
      {
        internalType: "uint64",
        name: "",
        type: "uint64",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

// ─── VaultisLens ABI (stateless read-only companion) ──────────────────────────
// Deployed separately. Holds the views that were moved off the core contract
// to keep it under the 24KB EVM code-size limit. Point all UI reads of these
// functions at VAULTIS_LENS_ADDRESS, not VAULTIS_ADDRESS.

export const VAULTIS_LENS_ABI = [
  {
    inputs: [
      {
        internalType: "address",
        name: "_vaultis",
        type: "address",
      },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [],
    name: "getAllProposals",
    outputs: [
      {
        components: [
          {
            internalType: "address",
            name: "recipient",
            type: "address",
          },
          {
            internalType: "address",
            name: "token",
            type: "address",
          },
          {
            internalType: "uint64",
            name: "encAmountHint",
            type: "uint64",
          },
          {
            internalType: "uint64",
            name: "unlockAt",
            type: "uint64",
          },
          {
            internalType: "string",
            name: "title",
            type: "string",
          },
          {
            internalType: "string",
            name: "rationale",
            type: "string",
          },
          {
            internalType: "enum IVaultis.Category",
            name: "category",
            type: "uint8",
          },
          {
            internalType: "address",
            name: "proposer",
            type: "address",
          },
        ],
        internalType: "struct VaultisLens.ProposalView[]",
        name: "out",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getArchive",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "cycleId",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "approvedCount",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "rejectedCount",
            type: "uint256",
          },
          {
            internalType: "uint64",
            name: "totalAllocated",
            type: "uint64",
          },
        ],
        internalType: "struct VaultisLens.ExecutedCycleView[]",
        name: "out",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getCurrentPhase",
    outputs: [
      {
        internalType: "string",
        name: "",
        type: "string",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getPhaseDeadlines",
    outputs: [
      {
        internalType: "uint64",
        name: "",
        type: "uint64",
      },
      {
        internalType: "uint64",
        name: "",
        type: "uint64",
      },
      {
        internalType: "uint64",
        name: "",
        type: "uint64",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getResults",
    outputs: [
      {
        internalType: "string[]",
        name: "titles",
        type: "string[]",
      },
      {
        internalType: "uint64[]",
        name: "forCounts",
        type: "uint64[]",
      },
      {
        internalType: "uint64[]",
        name: "againstCounts",
        type: "uint64[]",
      },
      {
        internalType: "bool[]",
        name: "approved",
        type: "bool[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getTimeUntilNextPhase",
    outputs: [
      {
        internalType: "string",
        name: "",
        type: "string",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "isAbandoned",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "vaultis",
    outputs: [
      {
        internalType: "contract IVaultis",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

// ─── Governance Token ABI ─────────────────────────────────────────────────────

export const GOVERNANCE_TOKEN_ABI = [
  {
    inputs: [
      {
        internalType: "string",
        name: "name_",
        type: "string",
      },
      {
        internalType: "string",
        name: "symbol_",
        type: "string",
      },
      {
        internalType: "uint256",
        name: "initialSupply",
        type: "uint256",
      },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "spender",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "allowance",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "needed",
        type: "uint256",
      },
    ],
    name: "ERC20InsufficientAllowance",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "sender",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "balance",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "needed",
        type: "uint256",
      },
    ],
    name: "ERC20InsufficientBalance",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "approver",
        type: "address",
      },
    ],
    name: "ERC20InvalidApprover",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "receiver",
        type: "address",
      },
    ],
    name: "ERC20InvalidReceiver",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "sender",
        type: "address",
      },
    ],
    name: "ERC20InvalidSender",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "spender",
        type: "address",
      },
    ],
    name: "ERC20InvalidSpender",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "owner",
        type: "address",
      },
    ],
    name: "OwnableInvalidOwner",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "OwnableUnauthorizedAccount",
    type: "error",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "owner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "spender",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
    ],
    name: "Approval",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "to",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "FaucetClaimed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "previousOwner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "OwnershipTransferred",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "from",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "to",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
    ],
    name: "Transfer",
    type: "event",
  },
  {
    inputs: [],
    name: "FAUCET_AMOUNT",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "FAUCET_COOLDOWN",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "owner",
        type: "address",
      },
      {
        internalType: "address",
        name: "spender",
        type: "address",
      },
    ],
    name: "allowance",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "spender",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
    ],
    name: "approve",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "balanceOf",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "user",
        type: "address",
      },
    ],
    name: "canClaim",
    outputs: [
      {
        internalType: "bool",
        name: "eligible",
        type: "bool",
      },
      {
        internalType: "uint256",
        name: "cooldownEndsAt",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [
      {
        internalType: "uint8",
        name: "",
        type: "uint8",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "faucet",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "lastClaimed",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "to",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "mint",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "name",
    outputs: [
      {
        internalType: "string",
        name: "",
        type: "string",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "renounceOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [
      {
        internalType: "string",
        name: "",
        type: "string",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "to",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
    ],
    name: "transfer",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "from",
        type: "address",
      },
      {
        internalType: "address",
        name: "to",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
    ],
    name: "transferFrom",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// ─── Category label map ───────────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<number, string> = {
  0: "Runway",
  1: "Grant",
  2: "Operations",
  3: "Liquidity",
  4: "Other",
};

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(
  ([value, label]) => ({ value: Number(value), label })
);

// ─── Phase label map ──────────────────────────────────────────────────────────

export const PHASE_LABELS: Record<string, string> = {
  Proposal: "Proposal Window",
  Voting: "Voting",
  Tally: "Tally",
  Veto: "Veto Window",
  Executed: "Executed",
};

export const PHASE_ORDER = [
  "Proposal",
  "Voting",
  "Tally",
  "Veto",
  "Executed",
] as const;
export type VaultisPhase = (typeof PHASE_ORDER)[number];
