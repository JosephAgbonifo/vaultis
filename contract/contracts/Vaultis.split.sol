// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";
import { InEuint64 } from "@fhenixprotocol/cofhe-contracts/ICofhe.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Vaultis is Ownable {

    uint256 public constant MAX_PROPOSALS = 10;

    IERC20 public immutable governanceToken;

    enum Category { Runway, Grant, Operations, Liquidity, Other }

    struct Proposal {
        address  recipient;
        address  token;
        uint64   encAmountHint;
        uint64   unlockAt;
        string   title;
        string   rationale;
        Category category;
        address  proposer;
    }

    mapping(uint256 => mapping(uint256 => euint64)) internal forVotes;
    mapping(uint256 => mapping(uint256 => euint64)) internal againstVotes;

    enum Phase { Proposal, Voting, Tally, Veto, Executed }

    uint256 public cycleId;
    mapping(uint256 => Proposal[]) public cycleProposals;
    mapping(bytes32 => bool)       public usedNullifier;

    Phase  public phase;
    uint64 public proposalEndsAt;
    uint64 public voteEndsAt;
    uint64 public vetoEndsAt;

    uint64 public defaultProposalDuration;
    uint64 public defaultVoteDuration;
    uint64 public defaultVetoDuration;

    mapping(uint256 => mapping(uint256 => uint64)) public finalForCounts;
    mapping(uint256 => mapping(uint256 => uint64)) public finalAgainstCounts;
    mapping(uint256 => mapping(uint256 => bool))   public proposalApproved;
    mapping(uint256 => mapping(uint256 => bool))   public vetoedProposals;
    bool public resultsPublished;

    struct ExecutedCycle {
        uint256 cycleId;
        uint256 approvedCount;
        uint256 rejectedCount;
        uint64  totalAllocated;
    }
    ExecutedCycle[] public archive;

    error NotProposalPhase();
    error NotVotingPhase();
    error NotTallyPhase();
    error NotVetoPhase();
    error NotFinished();
    error WindowClosed();
    error AlreadyUsed();
    error InvalidInput();
    error Unauthorized();
    error CapReached();

    event CycleOpened(uint256 indexed cycleId, string label, uint64 proposalEndsAt, uint64 voteEndsAt);
    event ProposalSubmitted(uint256 indexed cycleId, uint256 proposalId, address indexed proposer);
    event BallotCast(uint256 indexed cycleId, address indexed voter);
    event PhaseAdvanced(uint256 indexed cycleId, Phase newPhase);
    event TallyFinalized(uint256 indexed cycleId);
    event AllocationsPublished(uint256 indexed cycleId, uint256 approvedCount);
    event CycleAbandoned(uint256 indexed cycleId, string reason);
    event VetoCast(uint256 indexed cycleId, uint256 proposalId);

    constructor(
        address _governanceToken,
        uint64  _defaultProposalDuration,
        uint64  _defaultVoteDuration,
        uint64  _defaultVetoDuration
    ) Ownable(msg.sender) {
        if (_governanceToken == address(0)) revert InvalidInput();
        governanceToken         = IERC20(_governanceToken);
        defaultProposalDuration = _defaultProposalDuration;
        defaultVoteDuration     = _defaultVoteDuration;
        defaultVetoDuration     = _defaultVetoDuration;
    }

    function _proposals() internal view returns (Proposal[] storage) {
        return cycleProposals[cycleId];
    }

    function _autoAdvance() internal {
        if (phase == Phase.Proposal && block.timestamp >= proposalEndsAt) {
            if (_proposals().length == 0) {
                phase            = Phase.Executed;
                resultsPublished = true;
                emit CycleAbandoned(cycleId, "No proposals");
                emit PhaseAdvanced(cycleId, Phase.Executed);
                return;
            }
            phase = Phase.Voting;
            emit PhaseAdvanced(cycleId, Phase.Voting);
        }
        if (phase == Phase.Voting && block.timestamp >= voteEndsAt) {
            uint256 cid = cycleId;
            uint256 n   = _proposals().length;
            for (uint256 i = 0; i < n; i++) {
                if (euint64.unwrap(forVotes[cid][i]) != 0) {
                    FHE.allowPublic(forVotes[cid][i]);
                }
                if (euint64.unwrap(againstVotes[cid][i]) != 0) {
                    FHE.allowPublic(againstVotes[cid][i]);
                }
            }
            phase = Phase.Tally;
            emit PhaseAdvanced(cycleId, Phase.Tally);
            emit TallyFinalized(cid);
        }
        if (phase == Phase.Veto && block.timestamp >= vetoEndsAt) {
            phase = Phase.Executed;
            emit PhaseAdvanced(cycleId, Phase.Executed);
        }
    }

    function _archiveCurrentCycle() internal {
        if (cycleId == 0 || phase != Phase.Executed || !resultsPublished) return;
        uint256 cid = cycleId;
        uint256 n   = cycleProposals[cid].length;
        uint256 approved;
        uint64  totalHint;
        for (uint256 i = 0; i < n; i++) {
            if (proposalApproved[cid][i]) {
                approved++;
                totalHint += cycleProposals[cid][i].encAmountHint;
            }
        }
        archive.push(ExecutedCycle(cid, approved, n - approved, totalHint));
    }

    function _openCycle(string memory label) internal {
        _archiveCurrentCycle();
        uint64 pEnd = uint64(block.timestamp) + defaultProposalDuration;
        uint64 vEnd = pEnd + defaultVoteDuration;
        uint64 xEnd = vEnd + defaultVetoDuration;
        cycleId++;
        proposalEndsAt   = pEnd;
        voteEndsAt       = vEnd;
        vetoEndsAt       = xEnd;
        phase            = Phase.Proposal;
        resultsPublished = false;
        emit CycleOpened(cycleId, label, pEnd, vEnd);
    }

    // ── Cycle management ──────────────────────────────────────────────────────

    function openCycle(
        string calldata label,
        uint64 _proposalEnd,
        uint64 _voteEnd,
        uint64 _vetoEnd
    ) external onlyOwner {
        if (_proposalEnd <= block.timestamp) revert InvalidInput();
        if (_voteEnd <= _proposalEnd)        revert InvalidInput();
        if (_vetoEnd <= _voteEnd)            revert InvalidInput();
        _archiveCurrentCycle();
        cycleId++;
        proposalEndsAt   = _proposalEnd;
        voteEndsAt       = _voteEnd;
        vetoEndsAt       = _vetoEnd;
        phase            = Phase.Proposal;
        resultsPublished = false;
        emit CycleOpened(cycleId, label, _proposalEnd, _voteEnd);
    }

    function openNextCycle(string calldata label) external {
        _autoAdvance();
        if (phase != Phase.Executed || !resultsPublished) revert NotFinished();
        _openCycle(label);
    }

    function abandonCycle(string calldata reason) external onlyOwner {
        if (phase == Phase.Executed) revert InvalidInput();
        phase            = Phase.Executed;
        resultsPublished = true;
        emit CycleAbandoned(cycleId, reason);
        emit PhaseAdvanced(cycleId, Phase.Executed);
    }

    function setDefaultDurations(uint64 p, uint64 v, uint64 x) external onlyOwner {
        defaultProposalDuration = p;
        defaultVoteDuration     = v;
        defaultVetoDuration     = x;
    }

    // ── Proposals ─────────────────────────────────────────────────────────────

    function submitProposal(
        address         recipient,
        address         token,
        uint64          encAmountHint,
        uint64          unlockAt,
        string calldata title,
        string calldata rationale,
        Category        category
    ) external {
        _autoAdvance();
        if (phase != Phase.Proposal)                      revert NotProposalPhase();
        if (block.timestamp >= proposalEndsAt)            revert WindowClosed();
        if (_proposals().length >= MAX_PROPOSALS)         revert CapReached();
        if (recipient == address(0))                      revert InvalidInput();
        if (bytes(title).length == 0)                     revert InvalidInput();
        if (unlockAt <= block.timestamp)                  revert InvalidInput();
        // Balance check removed — msg.sender is the relayer, verified off-chain by relay server.

        uint256 id = _proposals().length;
        cycleProposals[cycleId].push(Proposal(
            recipient, token, encAmountHint, unlockAt,
            title, rationale, category, msg.sender
        ));
        emit ProposalSubmitted(cycleId, id, msg.sender);
    }

    // ── Voting ────────────────────────────────────────────────────────────────

    function castBallot(
        bytes32              nullifier,
        uint256[]  calldata  proposalIds,
        InEuint64[] calldata encForWeights,
        InEuint64[] calldata encAgainstWeights
    ) external {
        _autoAdvance();
        if (phase != Phase.Voting)                           revert NotVotingPhase();
        if (block.timestamp >= voteEndsAt)                  revert WindowClosed();
        if (usedNullifier[nullifier])                       revert AlreadyUsed();
        // Balance check removed — msg.sender is the relayer not the voter.
        // Relay server verifies voter balance off-chain before submitting.
        if (proposalIds.length == 0)                        revert InvalidInput();
        if (proposalIds.length != encForWeights.length)     revert InvalidInput();
        if (proposalIds.length != encAgainstWeights.length) revert InvalidInput();

        uint256 n   = _proposals().length;
        uint256 cid = cycleId;
        usedNullifier[nullifier] = true;

        for (uint256 i = 0; i < proposalIds.length; i++) {
            uint256 pid = proposalIds[i];
            if (pid >= n) revert InvalidInput();

            euint64 fv = FHE.asEuint64(encForWeights[i]);
            euint64 av = FHE.asEuint64(encAgainstWeights[i]);

            forVotes[cid][pid] = euint64.unwrap(forVotes[cid][pid]) == 0
                ? fv : FHE.add(forVotes[cid][pid], fv);
            FHE.allowThis(forVotes[cid][pid]);

            againstVotes[cid][pid] = euint64.unwrap(againstVotes[cid][pid]) == 0
                ? av : FHE.add(againstVotes[cid][pid], av);
            FHE.allowThis(againstVotes[cid][pid]);
        }
        emit BallotCast(cid, msg.sender);
    }

    // ── Finalize / Veto / Publish ─────────────────────────────────────────────

    function finalize() external {
        _autoAdvance();
        if (phase != Phase.Tally) revert NotTallyPhase();
        vetoEndsAt = uint64(block.timestamp) + defaultVetoDuration;
        phase      = Phase.Veto;
        emit PhaseAdvanced(cycleId, Phase.Veto);
    }

    function vetoProposal(uint256 proposalId) external onlyOwner {
        if (phase != Phase.Veto)               revert NotVetoPhase();
        if (block.timestamp >= vetoEndsAt)     revert WindowClosed();
        if (proposalId >= _proposals().length) revert InvalidInput();
        vetoedProposals[cycleId][proposalId] = true;
        emit VetoCast(cycleId, proposalId);
    }

    function publishAllocations(
        uint64[] calldata forCounts,
        uint64[] calldata againstCounts
    ) external {
        _autoAdvance();
        if (phase != Phase.Veto && phase != Phase.Tally) revert NotVetoPhase();
        uint256 n = _proposals().length;
        if (forCounts.length != n || againstCounts.length != n) revert InvalidInput();

        uint256 cid    = cycleId;
        uint256 approved;

        for (uint256 i = 0; i < n; i++) {
            finalForCounts[cid][i]     = forCounts[i];
            finalAgainstCounts[cid][i] = againstCounts[i];

            bool vetoed = vetoedProposals[cid][i];

            // Simple majority: forVotes must exceed againstVotes and not be vetoed
            if (forCounts[i] > againstCounts[i] && !vetoed) {
                proposalApproved[cid][i] = true;
                approved++;
            }
        }

        resultsPublished = true;
        phase            = Phase.Executed;
        emit AllocationsPublished(cid, approved);
        emit PhaseAdvanced(cid, Phase.Executed);
    }

    // ── FHE tally handles ─────────────────────────────────────────────────────

    function getTallyHandles() external view returns (
        uint256[] memory forHandles,
        uint256[] memory againstHandles
    ) {
        uint256 cid = cycleId;
        uint256 n   = _proposals().length;
        forHandles     = new uint256[](n);
        againstHandles = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            forHandles[i]     = uint256(euint64.unwrap(forVotes[cid][i]));
            againstHandles[i] = uint256(euint64.unwrap(againstVotes[cid][i]));
        }
    }

    function proposalCount() external view returns (uint256) {
        return _proposals().length;
    }

    function getProposal(uint256 cid, uint256 id) external view returns (
        address recipient, address token, uint64 encAmountHint, uint64 unlockAt,
        string memory title, string memory rationale, Category category, address proposer
    ) {
        Proposal storage p = cycleProposals[cid][id];
        return (p.recipient, p.token, p.encAmountHint, p.unlockAt, p.title, p.rationale, p.category, p.proposer);
    }

    function cycleProposalsLength(uint256 cid) external view returns (uint256) {
        return cycleProposals[cid].length;
    }

    function archiveLength() external view returns (uint256) {
        return archive.length;
    }

    function archiveAt(uint256 i) external view returns (
        uint256 cid, uint256 approvedCount, uint256 rejectedCount, uint64 totalAllocated
    ) {
        ExecutedCycle storage c = archive[i];
        return (c.cycleId, c.approvedCount, c.rejectedCount, c.totalAllocated);
    }
}
