// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

interface IVaultis {
    enum Category { Runway, Grant, Operations, Liquidity, Other }
    enum Status   { Pending, Fulfilled, Abandoned }

    struct Proposal {
        address  recipient;
        address  token;
        uint256  amount;
        uint64   expiresAt;
        string   title;
        string   rationale;
        Category category;
        address  proposer;
        bool     resolutionRequested;
        bool     resolved;
        Status   status;
    }

    function proposalCount() external view returns (uint256);
    function getProposal(uint256 id) external view returns (Proposal memory);
    function treasuryBalance() external view returns (uint256);
    function finalForCount(uint256 id) external view returns (uint64);
    function finalAgainstCount(uint256 id) external view returns (uint64);
}

contract VaultisLens {

    IVaultis public immutable vaultis;


    struct ProposalView {
        uint256           id;
        address           recipient;
        address           token;
        uint256           amount;
        uint64            expiresAt;
        string            title;
        string            rationale;
        IVaultis.Category category;
        address           proposer;
        DisplayStatus     displayStatus;
        uint64            finalForCount;
        uint64            finalAgainstCount;
    }

    constructor(address _vaultis) {
        vaultis = IVaultis(_vaultis);
    }
// VaultisLens.sol
enum DisplayStatus { Active, ReadyToResolve, ResolutionPending, Fulfilled, Abandoned }

function _displayStatus(IVaultis.Proposal memory p) internal view returns (DisplayStatus) {
    if (p.resolved) {
        return p.status == IVaultis.Status.Fulfilled
            ? DisplayStatus.Fulfilled
            : DisplayStatus.Abandoned;
    }
    if (p.resolutionRequested) return DisplayStatus.ResolutionPending;
    if (block.timestamp >= p.expiresAt) return DisplayStatus.ReadyToResolve;
    return DisplayStatus.Active;
}

    function getProposalView(uint256 id) public view returns (ProposalView memory) {
        IVaultis.Proposal memory p = vaultis.getProposal(id);
        return ProposalView({
            id: id,
            recipient: p.recipient,
            token: p.token,
            amount: p.amount,
            expiresAt: p.expiresAt,
            title: p.title,
            rationale: p.rationale,
            category: p.category,
            proposer: p.proposer,
            displayStatus: _displayStatus(p),
            finalForCount: vaultis.finalForCount(id),
            finalAgainstCount: vaultis.finalAgainstCount(id)
        });
    }

    function getAllProposals() external view returns (ProposalView[] memory out) {
        uint256 n = vaultis.proposalCount();
        out = new ProposalView[](n);
        for (uint256 i = 0; i < n; i++) {
            out[i] = getProposalView(i);
        }
    }

    function treasuryBalance() external view returns (uint256) {
        return vaultis.treasuryBalance();
    }
}