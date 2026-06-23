// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

interface IVaultis {
    enum Phase { Proposal, Voting, Tally, Veto, Executed }
    enum Category { Runway, Grant, Operations, Liquidity, Other }

    function cycleId() external view returns (uint256);
    function phase() external view returns (Phase);
    function proposalEndsAt() external view returns (uint64);
    function voteEndsAt() external view returns (uint64);
    function vetoEndsAt() external view returns (uint64);
    function resultsPublished() external view returns (bool);

    function finalForCounts(uint256 cid, uint256 id) external view returns (uint64);
    function finalAgainstCounts(uint256 cid, uint256 id) external view returns (uint64);
    function proposalApproved(uint256 cid, uint256 id) external view returns (bool);

    function proposalCount() external view returns (uint256);
    function cycleProposalsLength(uint256 cid) external view returns (uint256);

    function getProposal(uint256 cid, uint256 id) external view returns (
        address recipient, address token, uint64 encAmountHint, uint64 unlockAt,
        string memory title, string memory rationale, Category category, address proposer
    );

    function archiveLength() external view returns (uint256);
    function archiveAt(uint256 i) external view returns (
        uint256 cid, uint256 approvedCount, uint256 rejectedCount, uint64 totalAllocated
    );
}

/**
 * Stateless read-only companion to Vaultis. Deployed separately so the
 * 24KB EVM code-size limit on the core contract (which already carries
 * the CoFHE FHE library) isn't shared with UI-convenience views.
 *
 * Point the frontend at this contract for all `get*` reads; keep writes
 * and getTallyHandles() pointed at the core Vaultis contract.
 */
contract VaultisLens {

    IVaultis public immutable vaultis;

    struct ProposalView {
        address recipient;
        address token;
        uint64  encAmountHint;
        uint64  unlockAt;
        string  title;
        string  rationale;
        IVaultis.Category category;
        address proposer;
    }

    struct ExecutedCycleView {
        uint256 cycleId;
        uint256 approvedCount;
        uint256 rejectedCount;
        uint64  totalAllocated;
    }

    constructor(address _vaultis) {
        vaultis = IVaultis(_vaultis);
    }

    function getAllProposals() external view returns (ProposalView[] memory out) {
        uint256 cid = vaultis.cycleId();
        uint256 n   = vaultis.cycleProposalsLength(cid);
        out = new ProposalView[](n);
        for (uint256 i = 0; i < n; i++) {
            (
                address recipient, address token, uint64 encAmountHint, uint64 unlockAt,
                string memory title, string memory rationale, IVaultis.Category category, address proposer
            ) = vaultis.getProposal(cid, i);
            out[i] = ProposalView(recipient, token, encAmountHint, unlockAt, title, rationale, category, proposer);
        }
    }

    function getResults() external view returns (
        string[] memory titles,
        uint64[] memory forCounts,
        uint64[] memory againstCounts,
        bool[]   memory approved
    ) {
        require(vaultis.resultsPublished(), "Results not published yet");
        uint256 cid = vaultis.cycleId();
        uint256 n   = vaultis.cycleProposalsLength(cid);

        titles        = new string[](n);
        forCounts     = new uint64[](n);
        againstCounts = new uint64[](n);
        approved      = new bool[](n);

        for (uint256 i = 0; i < n; i++) {
            (, , , , string memory title, , , ) = vaultis.getProposal(cid, i);
            titles[i]        = title;
            forCounts[i]     = vaultis.finalForCounts(cid, i);
            againstCounts[i] = vaultis.finalAgainstCounts(cid, i);
            approved[i]      = vaultis.proposalApproved(cid, i);
        }
    }

    function getArchive() external view returns (ExecutedCycleView[] memory out) {
        uint256 n = vaultis.archiveLength();
        out = new ExecutedCycleView[](n);
        for (uint256 i = 0; i < n; i++) {
            (uint256 cid, uint256 approvedCount, uint256 rejectedCount, uint64 totalAllocated) =
                vaultis.archiveAt(i);
            out[i] = ExecutedCycleView(cid, approvedCount, rejectedCount, totalAllocated);
        }
    }

    function getCurrentPhase() external view returns (string memory) {
        uint256 cid = vaultis.cycleId();
        uint256 n   = vaultis.cycleProposalsLength(cid);
        IVaultis.Phase p = vaultis.phase();
        uint64 pEnd = vaultis.proposalEndsAt();
        uint64 vEnd = vaultis.voteEndsAt();
        uint64 xEnd = vaultis.vetoEndsAt();

        if (p == IVaultis.Phase.Proposal && block.timestamp >= pEnd) {
            if (n == 0) return "Executed";
            if (block.timestamp >= vEnd) return "Tally";
            return "Voting";
        }
        if (p == IVaultis.Phase.Voting && block.timestamp >= vEnd) return "Tally";
        if (p == IVaultis.Phase.Tally  && block.timestamp >= xEnd) return "Veto";
        if (p == IVaultis.Phase.Proposal) return "Proposal";
        if (p == IVaultis.Phase.Voting)   return "Voting";
        if (p == IVaultis.Phase.Tally)    return "Tally";
        if (p == IVaultis.Phase.Veto)     return "Veto";
        return "Executed";
    }

    function getPhaseDeadlines() external view returns (uint64, uint64, uint64) {
        return (vaultis.proposalEndsAt(), vaultis.voteEndsAt(), vaultis.vetoEndsAt());
    }

    function getTimeUntilNextPhase() external view returns (string memory, uint256) {
        uint256 now_ = block.timestamp;
        uint256 cid  = vaultis.cycleId();
        uint256 n    = vaultis.cycleProposalsLength(cid);
        IVaultis.Phase eff = vaultis.phase();
        uint64 pEnd = vaultis.proposalEndsAt();
        uint64 vEnd = vaultis.voteEndsAt();
        uint64 xEnd = vaultis.vetoEndsAt();

        if (eff == IVaultis.Phase.Proposal && now_ >= pEnd) {
            if (n == 0) return ("", 0);
            eff = IVaultis.Phase.Voting;
        }
        if (eff == IVaultis.Phase.Voting && now_ >= vEnd) eff = IVaultis.Phase.Tally;
        if (eff == IVaultis.Phase.Tally  && now_ >= xEnd) eff = IVaultis.Phase.Veto;

        if (eff == IVaultis.Phase.Proposal) return ("Voting",   pEnd > now_ ? pEnd - now_ : 0);
        if (eff == IVaultis.Phase.Voting)   return ("Tally",    vEnd > now_ ? vEnd - now_ : 0);
        if (eff == IVaultis.Phase.Tally)    return ("Veto",     xEnd > now_ ? xEnd - now_ : 0);
        if (eff == IVaultis.Phase.Veto)     return ("Executed", xEnd > now_ ? xEnd - now_ : 0);
        return ("", 0);
    }

    function isAbandoned() external view returns (bool) {
        uint256 cid = vaultis.cycleId();
        return vaultis.phase() == IVaultis.Phase.Executed
            && vaultis.resultsPublished()
            && vaultis.cycleProposalsLength(cid) == 0;
    }
}
