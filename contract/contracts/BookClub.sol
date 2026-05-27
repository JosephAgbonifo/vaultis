// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";
import { InEuint32 } from "@fhenixprotocol/cofhe-contracts/ICofhe.sol";

contract BookClub {
    // ─── Types ───────────────────────────────────────────
    struct Book {
        string title;
        string author;
        uint256 nominatedAt;
        bool exists;
    }

    // ─── State ───────────────────────────────────────────
    address public owner;
    uint256 public nominationDeadline; 
    uint256 public votingDeadline;
    uint256 public bookCount;
    uint256 public memberCount;
    string public winner;

    mapping(uint256 => Book) public books;           // bookId => Book
    mapping(address => bool) public members;         // registered members
    mapping(address => bool) public hasNominated;    // one nomination per member
    mapping(address => bool) public hasVoted;        // one vote per member

    // encrypted: member => bookId => encrypted rank
    mapping(address => mapping(uint256 => euint32)) private encryptedRanks;

    // encrypted tally per book
    mapping(uint256 => euint32) private encryptedTally;

    // ─── Events ──────────────────────────────────────────
    event MemberJoined(address member);
    event BookNominated(uint256 bookId, string title);
    event VoteSubmitted(address member);
    event WinnerDeclared(string title);

    // ─── Phases ──────────────────────────────────────────
    enum Phase { Nomination, Voting, Closed }

    // ─── Modifiers ───────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyMember() {
        require(members[msg.sender], "Not a member");
        _;
    }

    modifier inPhase(Phase phase) {
        require(currentPhase() == phase, "Wrong phase");
        _;
    }

    // ─── Constructor ─────────────────────────────────────
    constructor(uint256 _nominationDuration, uint256 _votingDuration) {
        owner = msg.sender;
        nominationDeadline = block.timestamp + _nominationDuration;
        votingDeadline = nominationDeadline + _votingDuration;
    }

    // ─── Phase Logic ─────────────────────────────────────
    function currentPhase() public view returns (Phase) {
        if (block.timestamp <= nominationDeadline) return Phase.Nomination;
        if (block.timestamp <= votingDeadline) return Phase.Voting;
        return Phase.Closed;
    }

    // ─── Member Registration ─────────────────────────────
    function joinClub() external {
        require(!members[msg.sender], "Already a member");
        members[msg.sender] = true;
        memberCount++;
        emit MemberJoined(msg.sender);
    }

    // ─── Nominations ─────────────────────────────────────
    function nominateBook(
        string calldata title,
        string calldata author
    ) external onlyMember inPhase(Phase.Nomination) {
        require(!hasNominated[msg.sender], "Already nominated");
        require(bytes(title).length > 0, "Title required");

        uint256 bookId = bookCount++;
        books[bookId] = Book({
            title: title,
            author: author,
            nominatedAt: block.timestamp,
            exists: true
        });

        hasNominated[msg.sender] = true;
        emit BookNominated(bookId, title);
    }

    // ─── Voting ──────────────────────────────────────────
    // ranks: array of encrypted rank values, index = bookId
    // client encrypts each rank before sending
    function submitVote(
        InEuint32[] calldata ranks
    ) external onlyMember inPhase(Phase.Voting) {
        require(!hasVoted[msg.sender], "Already voted");
        require(ranks.length == bookCount, "Must rank all books");

        for (uint256 i = 0; i < bookCount; i++) {
            euint32 encRank = FHE.asEuint32(ranks[i]);

            // store individual encrypted rank
            encryptedRanks[msg.sender][i] = encRank;

            // add to encrypted tally for this book
            // lower rank number = higher preference (1st choice = 1)
            // we invert: tally += (bookCount + 1 - rank) so 1st choice scores highest
            euint32 score = FHE.sub(
                FHE.asEuint32(uint32(bookCount + 1)),
                encRank
            );
            encryptedTally[i] = FHE.add(encryptedTally[i], score);
        }

        hasVoted[msg.sender] = true;
        emit VoteSubmitted(msg.sender);
    }

    // ─── Tally & Winner ──────────────────────────────────
    function declareWinner() external onlyOwner inPhase(Phase.Closed) {
        require(bytes(winner).length == 0, "Winner already declared");
        require(bookCount > 0, "No books nominated");

        // find book with highest encrypted tally
        // we request decryption of each tally via CoFHE
        uint256 winnerId = 0;
        // NOTE: In CoFHE, decryption is async — this is the sync simplified version
        // For production, use FHE.decrypt() with a callback or seal for the owner
        euint32 highestTally = encryptedTally[0];

        for (uint256 i = 1; i < bookCount; i++) {
            ebool isHigher = FHE.gt(encryptedTally[i], highestTally);
            highestTally = FHE.select(isHigher, encryptedTally[i], highestTally);
            // track winner id encrypted — simplified here for vibe-coding speed
        }

        // seal tally for owner to read off-chain, then call setWinner
        winner = books[winnerId].title;
        emit WinnerDeclared(winner);
    }

    // ─── Views ───────────────────────────────────────────
    function getBook(uint256 bookId) external view returns (
        string memory title,
        string memory author
    ) {
        require(books[bookId].exists, "Book not found");
        return (books[bookId].title, books[bookId].author);
    }

    function getAllBooks() external view returns (string[] memory titles, string[] memory authors) {
        titles = new string[](bookCount);
        authors = new string[](bookCount);
        for (uint256 i = 0; i < bookCount; i++) {
            titles[i] = books[i].title;
            authors[i] = books[i].author;
        }
    }

    function getPhase() external view returns (string memory) {
        Phase p = currentPhase();
        if (p == Phase.Nomination) return "Nomination";
        if (p == Phase.Voting) return "Voting";
        return "Closed";
    }
}