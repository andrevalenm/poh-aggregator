// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title PersonhoodRegistry
/// @notice A public ontology of proof-of-personhood protocols — what each one proves,
///         which trust root it reads, and what it costs an adversary to defeat.
///
/// @dev THIS CONTRACT STORES NO USER RECORDS, AND THAT IS THE POINT.
///
///      The obvious design for a personhood aggregator is a mapping from address to
///      humanity score. We deliberately reject it. A permanent, globally enumerable
///      record asserting "this address is a verified human" is itself a harm: revocation
///      cannot unpublish it, and whoever maintains it becomes the one party able to join
///      a user's World ID, passport proof and social graph — precisely the correlation
///      that each protocol's nullifier design exists to prevent.
///
///      We avoid it because correlation is a property of the credential *class*, not of
///      the user. To avoid double-counting one passport read by four protocols, we never
///      need to know that *your* two credentials share a root — only that those two
///      *protocols* read the same root. That is a fact about the world, and it is what
///      lives here. Scoring then happens client-side, and no party ever holds the join key.
///
///      Consequence: every weight below is a dated human judgement, not a measurement.
///      Each carries the source it was derived from, and every change emits an event, so
///      a subject can always ask "why did my score change?" and get an answer with a
///      block number attached.
contract PersonhoodRegistry {
    // ---------------------------------------------------------------- types

    /// @notice What a credential fundamentally demonstrates. Distinct classes are not
    ///         interchangeable: liveness proves a human was present, never that they are
    ///         unique, and no class here proves independent control.
    enum EvidenceClass {
        Unspecified,
        Uniqueness, // one credential per human, sybil-resistant by construction
        StateIdentity, // a government asserts this person exists
        SocialTrust, // other humans vouched; only as honest as the graph
        Liveness, // a human was present, but may hold many credentials
        Behavioral // account history and heuristics; the weakest class
    }

    /// @param trustRoot        Shared-origin key. Adapters with an equal trustRoot are
    ///                         correlated evidence and MUST saturate rather than sum.
    /// @param forgeCostCents   Cost for an adversary to manufacture this credential.
    /// @param rentCostCents    Cost to rent one from a willing holder. Deliberately
    ///                         separate: hardening against sale (liveness re-checks,
    ///                         identity staking) leaves rental untouched, and collapsing
    ///                         both into one number overrates exactly the protocols that
    ///                         did the most security work.
    /// @param decayHalfLifeDays Days after which the credential carries half weight.
    ///                          Zero means it does not decay.
    /// @param live             False when the upstream protocol is discontinued. Kept
    ///                         rather than deleted so historical scores stay explicable.
    /// @param sourceURI        Where the costs above were derived from. Auditability is
    ///                         the whole basis for trusting a curated weight.
    struct Adapter {
        string name;
        EvidenceClass evidenceClass;
        bytes32 trustRoot;
        uint64 forgeCostCents;
        uint64 rentCostCents;
        uint32 decayHalfLifeDays;
        bool live;
        bool exists;
        string sourceURI;
    }

    // ------------------------------------------------------------- storage

    address public curator;

    /// @notice Incremented on every mutation so clients can cheaply detect staleness.
    uint64 public revision;

    mapping(bytes32 => Adapter) private _adapters;
    bytes32[] private _adapterIds;

    // -------------------------------------------------------------- events

    event AdapterSet(
        bytes32 indexed id,
        string name,
        EvidenceClass evidenceClass,
        bytes32 indexed trustRoot,
        uint64 forgeCostCents,
        uint64 rentCostCents,
        uint32 decayHalfLifeDays,
        bool live,
        string sourceURI,
        uint64 revision
    );
    event AdapterLivenessSet(bytes32 indexed id, bool live, string reason, uint64 revision);
    event CuratorTransferred(address indexed from, address indexed to);

    // -------------------------------------------------------------- errors

    error NotCurator();
    error UnknownAdapter(bytes32 id);
    error EmptyId();
    error ZeroAddress();

    // ----------------------------------------------------------- modifiers

    modifier onlyCurator() {
        if (msg.sender != curator) revert NotCurator();
        _;
    }

    constructor(address curator_) {
        if (curator_ == address(0)) revert ZeroAddress();
        curator = curator_;
        emit CuratorTransferred(address(0), curator_);
    }

    // ---------------------------------------------------------- mutations

    /// @notice Create or update an adapter. Idempotent on `id`.
    function setAdapter(
        bytes32 id,
        string calldata name,
        EvidenceClass evidenceClass,
        bytes32 trustRoot,
        uint64 forgeCostCents,
        uint64 rentCostCents,
        uint32 decayHalfLifeDays,
        bool live,
        string calldata sourceURI
    ) external onlyCurator {
        if (id == bytes32(0)) revert EmptyId();

        Adapter storage a = _adapters[id];
        if (!a.exists) {
            a.exists = true;
            _adapterIds.push(id);
        }

        a.name = name;
        a.evidenceClass = evidenceClass;
        a.trustRoot = trustRoot;
        a.forgeCostCents = forgeCostCents;
        a.rentCostCents = rentCostCents;
        a.decayHalfLifeDays = decayHalfLifeDays;
        a.live = live;
        a.sourceURI = sourceURI;

        unchecked {
            ++revision;
        }
        emit AdapterSet(
            id, name, evidenceClass, trustRoot, forgeCostCents, rentCostCents, decayHalfLifeDays, live, sourceURI, revision
        );
    }

    /// @notice Flip liveness without restating the whole record. Upstream protocols get
    ///         discontinued quietly and a stale credential scored as live is a real bug.
    function setAdapterLiveness(bytes32 id, bool live, string calldata reason) external onlyCurator {
        Adapter storage a = _adapters[id];
        if (!a.exists) revert UnknownAdapter(id);
        a.live = live;
        unchecked {
            ++revision;
        }
        emit AdapterLivenessSet(id, live, reason, revision);
    }

    function transferCuratorship(address to) external onlyCurator {
        if (to == address(0)) revert ZeroAddress();
        emit CuratorTransferred(curator, to);
        curator = to;
    }

    // ------------------------------------------------------------- reading

    function getAdapter(bytes32 id) external view returns (Adapter memory) {
        Adapter memory a = _adapters[id];
        if (!a.exists) revert UnknownAdapter(id);
        return a;
    }

    function adapterCount() external view returns (uint256) {
        return _adapterIds.length;
    }

    function adapterIdAt(uint256 index) external view returns (bytes32) {
        return _adapterIds[index];
    }

    /// @notice Whole ontology in one call. Small enough to be practical and it saves
    ///         clients an N+1 round trip on every scoring request.
    function allAdapters() external view returns (bytes32[] memory ids, Adapter[] memory adapters) {
        uint256 n = _adapterIds.length;
        ids = new bytes32[](n);
        adapters = new Adapter[](n);
        for (uint256 i; i < n;) {
            ids[i] = _adapterIds[i];
            adapters[i] = _adapters[_adapterIds[i]];
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Adapter ids sharing a trust root — the correlated set that must saturate
    ///         together rather than sum.
    function adaptersByTrustRoot(bytes32 trustRoot) external view returns (bytes32[] memory ids) {
        uint256 n = _adapterIds.length;
        uint256 hits;
        for (uint256 i; i < n;) {
            if (_adapters[_adapterIds[i]].trustRoot == trustRoot) ++hits;
            unchecked {
                ++i;
            }
        }
        ids = new bytes32[](hits);
        uint256 j;
        for (uint256 i; i < n;) {
            bytes32 id = _adapterIds[i];
            if (_adapters[id].trustRoot == trustRoot) {
                ids[j] = id;
                unchecked {
                    ++j;
                }
            }
            unchecked {
                ++i;
            }
        }
    }
}
