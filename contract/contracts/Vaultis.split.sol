// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";
import { InEuint64 } from "@fhenixprotocol/cofhe-contracts/ICofhe.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Vaultis {

    uint256 public constant MAX_OPEN_PROPOSALS = 10;
    uint256 public constant FAUCET_AMOUNT       = 10 * 10 ** 18;
    uint256 public constant FAUCET_COOLDOWN     = 24 hours;

    IERC20 public immutable governanceToken;

    enum Category { Runway, Grant, Operations, Liquidity, Other }
    enum Status   { Pending, Fulfilled, Abandoned }

    struct Proposal {
        address  recipient;
        address  token;                // asset to pay out — usually governanceToken, kept generic
        uint256  amount;               // real payout amount, PLAIN (not FHE — votes stay private, payouts don't)
        uint64   expiresAt;            // set by proposer at submission time
        string   title;
        string   rationale;
        Category category;
        address  proposer;
        bool     resolutionRequested;  // step 1 done: tallies opened for decryption
        bool     resolved;             // step 2 done: outcome executed
        Status   status;
    }

    Proposal[] public proposals;
    uint256 public openProposalCount;

    mapping(uint256 => euint64) internal forVotes;
    mapping(uint256 => euint64) internal againstVotes;
    mapping(uint256 => uint64)  public finalForCount;
    mapping(uint256 => uint64)  public finalAgainstCount;

    mapping(uint256 => mapping(bytes32 => bool)) public usedNullifier;
    mapping(address => uint256) public lastFaucetClaim;

    error InvalidInput();
    error WindowClosed();
    error NotExpiredYet();
    error AlreadyResolved();
    error ResolutionNotRequested();
    error AlreadyUsed();
    error CapReached();
    error TreasuryInsufficient();
    error FaucetCooldown();

    event ProposalSubmitted(uint256 indexed proposalId, address indexed proposer, uint64 expiresAt);
    event BallotCast(uint256 indexed proposalId, address indexed caller);
    event ResolutionRequested(uint256 indexed proposalId);
    event ProposalResolved(uint256 indexed proposalId, Status status, uint64 forCount, uint64 againstCount);
    event FaucetClaimed(address indexed to, uint256 amount);

    constructor(address _governanceToken) {
        if (_governanceToken == address(0)) revert InvalidInput();
        governanceToken = IERC20(_governanceToken);
    }

    // ── Proposals ─────────────────────────────────────────────────────────────

    function submitProposal(
        address         recipient,
        address         token,
        uint256         amount,
        uint64          expiresAt,
        string calldata title,
        string calldata rationale,
        Category        category
    ) external returns (uint256 proposalId) {
        if (recipient == address(0))                 revert InvalidInput();
        if (bytes(title).length == 0)                revert InvalidInput();
        if (amount == 0)                              revert InvalidInput();
        if (expiresAt <= block.timestamp)             revert InvalidInput();
        if (openProposalCount >= MAX_OPEN_PROPOSALS)  revert CapReached();

        proposalId = proposals.length;
        proposals.push(Proposal({
            recipient: recipient,
            token: token,
            amount: amount,
            expiresAt: expiresAt,
            title: title,
            rationale: rationale,
            category: category,
            proposer: msg.sender,
            resolutionRequested: false,
            resolved: false,
            status: Status.Pending
        }));
        openProposalCount++;
        emit ProposalSubmitted(proposalId, msg.sender, expiresAt);
    }

    // ── Voting ────────────────────────────────────────────────────────────────

    function castBallot(
        uint256   proposalId,
        bytes32   nullifier,
        InEuint64 calldata encForWeight,
        InEuint64 calldata encAgainstWeight
    ) external {
        if (proposalId >= proposals.length)        revert InvalidInput();
        Proposal storage p = proposals[proposalId];
        if (block.timestamp >= p.expiresAt)        revert WindowClosed();
        if (p.resolved)                            revert AlreadyResolved();
        if (usedNullifier[proposalId][nullifier])  revert AlreadyUsed();

        usedNullifier[proposalId][nullifier] = true;

        euint64 fv = FHE.asEuint64(encForWeight);
        euint64 av = FHE.asEuint64(encAgainstWeight);

        forVotes[proposalId] = euint64.unwrap(forVotes[proposalId]) == 0
            ? fv : FHE.add(forVotes[proposalId], fv);
        FHE.allowThis(forVotes[proposalId]);

        againstVotes[proposalId] = euint64.unwrap(againstVotes[proposalId]) == 0
            ? av : FHE.add(againstVotes[proposalId], av);
        FHE.allowThis(againstVotes[proposalId]);

        emit BallotCast(proposalId, msg.sender);
    }

    // ── Resolution (two-step: open for decryption -> finalize with plain counts) ─

    function resolve(uint256 proposalId) external {
        if (proposalId >= proposals.length)  revert InvalidInput();
        Proposal storage p = proposals[proposalId];
        if (block.timestamp < p.expiresAt)   revert NotExpiredYet();
        if (p.resolved)                      revert AlreadyResolved();
        if (p.resolutionRequested)           revert AlreadyResolved(); // already in flight

        if (euint64.unwrap(forVotes[proposalId]) != 0) {
            FHE.allowPublic(forVotes[proposalId]);
        }
        if (euint64.unwrap(againstVotes[proposalId]) != 0) {
            FHE.allowPublic(againstVotes[proposalId]);
        }

        p.resolutionRequested = true;
        emit ResolutionRequested(proposalId);
    }

    function finalizeResolution(
        uint256 proposalId,
        uint64  forCount,
        uint64  againstCount
    ) external {
        if (proposalId >= proposals.length) revert InvalidInput();
        Proposal storage p = proposals[proposalId];
        if (!p.resolutionRequested)         revert ResolutionNotRequested();
        if (p.resolved)                     revert AlreadyResolved();

        finalForCount[proposalId]     = forCount;
        finalAgainstCount[proposalId] = againstCount;

        bool approved = forCount > againstCount;

        if (approved) {
            // Reverts (proposal stays Pending) if treasury can't cover it —
            // anyone can call this again once the treasury refills.
            bool ok = IERC20(p.token).transfer(p.recipient, p.amount);
            if (!ok) revert TreasuryInsufficient();
            p.status = Status.Fulfilled;
        } else {
            p.status = Status.Abandoned;
        }

        p.resolved = true;
        openProposalCount--;
        emit ProposalResolved(proposalId, p.status, forCount, againstCount);
    }

    // ── Faucet (now draws from treasury, not minted) ─────────────────────────────

    function faucet() external {
        if (block.timestamp < lastFaucetClaim[msg.sender] + FAUCET_COOLDOWN) revert FaucetCooldown();
        lastFaucetClaim[msg.sender] = block.timestamp;
        bool ok = governanceToken.transfer(msg.sender, FAUCET_AMOUNT);
        if (!ok) revert TreasuryInsufficient();
        emit FaucetClaimed(msg.sender, FAUCET_AMOUNT);
    }

    function canClaimFaucet(address user) external view returns (bool eligible, uint256 cooldownEndsAt) {
        cooldownEndsAt = lastFaucetClaim[user] + FAUCET_COOLDOWN;
        eligible       = block.timestamp >= cooldownEndsAt;
    }

    // ── Views ─────────────────────────────────────────────────────────────────

    function proposalCount() external view returns (uint256) {
        return proposals.length;
    }

    function getProposal(uint256 id) external view returns (Proposal memory) {
        return proposals[id];
    }

    function getTallyHandles(uint256 id) external view returns (uint256 forHandle, uint256 againstHandle) {
        forHandle     = uint256(euint64.unwrap(forVotes[id]));
        againstHandle = uint256(euint64.unwrap(againstVotes[id]));
    }

    function treasuryBalance() external view returns (uint256) {
        return governanceToken.balanceOf(address(this));
    }

    function isNullifierUsed(uint256 proposalId, bytes32 nullifier) external view returns (bool) {
        return usedNullifier[proposalId][nullifier];
    }
}