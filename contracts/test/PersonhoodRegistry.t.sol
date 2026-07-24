// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PersonhoodRegistry} from "../src/PersonhoodRegistry.sol";

contract PersonhoodRegistryTest is Test {
    PersonhoodRegistry reg;

    address curator = address(0xC0FFEE);
    address stranger = address(0xBEEF);

    bytes32 constant ROOT_IRIS = keccak256("iris-registry:world-orb");
    bytes32 constant ROOT_ICAO = keccak256("state-document:icao-9303");

    bytes32 constant WORLD_ORB = keccak256("adapter:world-id-orb");
    bytes32 constant WORLD_DOC = keccak256("adapter:world-id-document");
    bytes32 constant ZKPASSPORT = keccak256("adapter:zkpassport");

    function setUp() public {
        reg = new PersonhoodRegistry(curator);
    }

    // ------------------------------------------------------------ helpers

    function _setOrb() internal {
        vm.prank(curator);
        reg.setAdapter(
            WORLD_ORB,
            "World ID (Orb)",
            PersonhoodRegistry.EvidenceClass.Uniqueness,
            ROOT_IRIS,
            5_00, // $5 forge — an Orb visit costs real travel time
            50, // $0.50 rent — observed floor of the resale market
            1095, // 3y validity
            true,
            "research/protocols/world-id.md"
        );
    }

    // ---------------------------------------------------------- happy path

    function test_setAdapter_storesAndReadsBack() public {
        _setOrb();

        PersonhoodRegistry.Adapter memory a = reg.getAdapter(WORLD_ORB);
        assertEq(a.name, "World ID (Orb)");
        assertEq(uint8(a.evidenceClass), uint8(PersonhoodRegistry.EvidenceClass.Uniqueness));
        assertEq(a.trustRoot, ROOT_IRIS);
        assertEq(a.forgeCostCents, 500);
        assertEq(a.rentCostCents, 50);
        assertEq(a.decayHalfLifeDays, 1095);
        assertTrue(a.live);
        assertEq(a.sourceURI, "research/protocols/world-id.md");
        assertEq(reg.adapterCount(), 1);
        assertEq(reg.revision(), 1);
    }

    /// @dev Rent must be independently expressible. World hardened against *sale* via
    ///      user-presence checks while rental stayed cheap; a single "strength" scalar
    ///      would have hidden exactly that.
    function test_forgeAndRentCostsAreIndependent() public {
        _setOrb();
        PersonhoodRegistry.Adapter memory a = reg.getAdapter(WORLD_ORB);
        assertGt(a.forgeCostCents, a.rentCostCents);
    }

    function test_setAdapter_isIdempotentOnId() public {
        _setOrb();
        _setOrb();
        assertEq(reg.adapterCount(), 1, "must not duplicate the id");
        assertEq(reg.revision(), 2, "but must still bump revision");
    }

    function test_setAdapter_updatesInPlace() public {
        _setOrb();
        vm.prank(curator);
        reg.setAdapter(
            WORLD_ORB,
            "World ID (Orb)",
            PersonhoodRegistry.EvidenceClass.Uniqueness,
            ROOT_IRIS,
            5_00,
            15_00, // resale market repriced
            1095,
            true,
            "zachxbt 2026-04-28"
        );
        assertEq(reg.getAdapter(WORLD_ORB).rentCostCents, 1500);
        assertEq(reg.adapterCount(), 1);
    }

    // ------------------------------------------------- the correlation core

    /// @notice The reason this contract exists: adapters sharing a trust root are one
    ///         piece of evidence seen twice, and a client must be able to discover that
    ///         without ever linking a user's credentials to each other.
    function test_adaptersByTrustRoot_groupsCorrelatedEvidence() public {
        _setOrb();

        vm.startPrank(curator);
        reg.setAdapter(
            WORLD_DOC,
            "World ID (document)",
            PersonhoodRegistry.EvidenceClass.StateIdentity,
            ROOT_ICAO,
            2_00,
            1_00,
            3650,
            true,
            "research/protocols/world-id.md"
        );
        reg.setAdapter(
            ZKPASSPORT,
            "ZKPassport",
            PersonhoodRegistry.EvidenceClass.StateIdentity,
            ROOT_ICAO, // same passport chip as World's document tier
            2_00,
            1_00,
            3650,
            true,
            "research/protocols/zk-passport-and-eid.md"
        );
        vm.stopPrank();

        bytes32[] memory icao = reg.adaptersByTrustRoot(ROOT_ICAO);
        assertEq(icao.length, 2, "World document tier and ZKPassport share the ICAO root");

        bytes32[] memory iris = reg.adaptersByTrustRoot(ROOT_IRIS);
        assertEq(iris.length, 1, "an Orb scan is independent of any passport");
        assertEq(iris[0], WORLD_ORB);
    }

    function test_adaptersByTrustRoot_emptyForUnknownRoot() public {
        _setOrb();
        assertEq(reg.adaptersByTrustRoot(keccak256("nope")).length, 0);
    }

    // ------------------------------------------------------------ liveness

    /// @dev Civic discontinued its uniqueness product while a major competitor kept
    ///      scoring its stamps. Liveness is a first-class field for that reason, and
    ///      discontinued adapters are retained so historical scores stay explicable.
    function test_setAdapterLiveness_retainsRecord() public {
        _setOrb();
        vm.prank(curator);
        reg.setAdapterLiveness(WORLD_ORB, false, "discontinued upstream");

        PersonhoodRegistry.Adapter memory a = reg.getAdapter(WORLD_ORB);
        assertFalse(a.live);
        assertEq(a.name, "World ID (Orb)", "record retained, not deleted");
        assertEq(reg.adapterCount(), 1);
    }

    function test_setAdapterLiveness_revertsForUnknown() public {
        vm.prank(curator);
        vm.expectRevert(abi.encodeWithSelector(PersonhoodRegistry.UnknownAdapter.selector, WORLD_ORB));
        reg.setAdapterLiveness(WORLD_ORB, false, "nope");
    }

    // ---------------------------------------------------------------- auth

    function test_onlyCurator_canSetAdapter() public {
        vm.prank(stranger);
        vm.expectRevert(PersonhoodRegistry.NotCurator.selector);
        reg.setAdapter(
            WORLD_ORB, "x", PersonhoodRegistry.EvidenceClass.Uniqueness, ROOT_IRIS, 1, 1, 0, true, "src"
        );
    }

    function test_onlyCurator_canSetLiveness() public {
        _setOrb();
        vm.prank(stranger);
        vm.expectRevert(PersonhoodRegistry.NotCurator.selector);
        reg.setAdapterLiveness(WORLD_ORB, false, "x");
    }

    function test_transferCuratorship() public {
        vm.prank(curator);
        reg.transferCuratorship(stranger);
        assertEq(reg.curator(), stranger);

        vm.prank(stranger);
        reg.setAdapter(
            WORLD_ORB, "x", PersonhoodRegistry.EvidenceClass.Uniqueness, ROOT_IRIS, 1, 1, 0, true, "src"
        );
        assertEq(reg.adapterCount(), 1);
    }

    function test_constructor_rejectsZeroCurator() public {
        vm.expectRevert(PersonhoodRegistry.ZeroAddress.selector);
        new PersonhoodRegistry(address(0));
    }

    function test_setAdapter_rejectsEmptyId() public {
        vm.prank(curator);
        vm.expectRevert(PersonhoodRegistry.EmptyId.selector);
        reg.setAdapter(
            bytes32(0), "x", PersonhoodRegistry.EvidenceClass.Uniqueness, ROOT_IRIS, 1, 1, 0, true, "src"
        );
    }

    function test_getAdapter_revertsForUnknown() public {
        vm.expectRevert(abi.encodeWithSelector(PersonhoodRegistry.UnknownAdapter.selector, WORLD_ORB));
        reg.getAdapter(WORLD_ORB);
    }

    // ------------------------------------------------------------ bulk read

    function test_allAdapters_returnsWholeOntology() public {
        _setOrb();
        vm.prank(curator);
        reg.setAdapter(
            ZKPASSPORT,
            "ZKPassport",
            PersonhoodRegistry.EvidenceClass.StateIdentity,
            ROOT_ICAO,
            2_00,
            1_00,
            3650,
            true,
            "src"
        );

        (bytes32[] memory ids, PersonhoodRegistry.Adapter[] memory adapters) = reg.allAdapters();
        assertEq(ids.length, 2);
        assertEq(adapters.length, 2);
        assertEq(ids[0], WORLD_ORB);
        assertEq(adapters[1].trustRoot, ROOT_ICAO);
    }

    // ----------------------------------------------------------------- fuzz

    function testFuzz_setAdapter_roundTrips(
        bytes32 id,
        bytes32 root,
        uint64 forgeCost,
        uint64 rentCost,
        uint32 halfLife
    ) public {
        vm.assume(id != bytes32(0));

        vm.prank(curator);
        reg.setAdapter(
            id, "fuzz", PersonhoodRegistry.EvidenceClass.Behavioral, root, forgeCost, rentCost, halfLife, true, "s"
        );

        PersonhoodRegistry.Adapter memory a = reg.getAdapter(id);
        assertEq(a.trustRoot, root);
        assertEq(a.forgeCostCents, forgeCost);
        assertEq(a.rentCostCents, rentCost);
        assertEq(a.decayHalfLifeDays, halfLife);
    }

    function testFuzz_adapterCountNeverExceedsDistinctIds(bytes32 id, uint8 writes) public {
        vm.assume(id != bytes32(0));
        writes = uint8(bound(writes, 1, 20));

        for (uint256 i; i < writes; ++i) {
            vm.prank(curator);
            reg.setAdapter(
                id, "fuzz", PersonhoodRegistry.EvidenceClass.Behavioral, ROOT_IRIS, 1, 1, 0, true, "s"
            );
        }
        assertEq(reg.adapterCount(), 1);
        assertEq(reg.revision(), writes);
    }
}
