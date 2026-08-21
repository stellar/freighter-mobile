import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { fireEvent } from "@testing-library/react-native";
import { PoolDetailsBottomSheet } from "components/screens/EarnScreen/components/PoolDetailsBottomSheet";
import { BlendCatalogPool, BlendCatalogReserve } from "config/blendTypes";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

const buildReserve = (
  assetId: string,
  symbol: string,
): BlendCatalogReserve => ({
  assetId,
  symbol,
  name: symbol,
  decimals: 7,
  enabled: true,
  utilization: null,
  supplyApy: null,
  borrowApy: null,
  emissionsSupplyApr: null,
  suppliedUsd: null,
  borrowedUsd: null,
  priceUsd: null,
});

// A pool with nulls across every unpriced field — the COMMON case per the
// live backend, not an edge case. `borrowedUsd` is a genuine zero here to
// prove null and zero render differently in the same row set.
const nullHeavyPool: BlendCatalogPool = {
  id: "CUNKNOWNPOOL",
  name: "YieldBlox Pool v2 model",
  status: "ADMIN_ACTIVE",
  suppliedUsd: null,
  borrowedUsd: 0,
  interestApy: null,
  netApy: null,
  backstopUsd: null,
  reserves: [],
};

// The Fixed pool (testnet contract id) — has a description entry and fully
// priced figures, including a supply-side rate that legitimately exceeds 1
// (a decimal fraction, not a pre-multiplied percentage).
const fixedPool: BlendCatalogPool = {
  id: "CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF",
  name: "TestnetV2",
  status: "ADMIN_ACTIVE",
  suppliedUsd: 40385476.30883376,
  borrowedUsd: 35717534.91620809,
  interestApy: 3.9199825260259216,
  netApy: 3.9199825260259216,
  backstopUsd: null,
  reserves: [],
};

describe("PoolDetailsBottomSheet", () => {
  it("renders nothing when the pool hasn't resolved yet", () => {
    const { queryByTestId } = renderWithProviders(
      <PoolDetailsBottomSheet pool={null} />,
    );
    expect(queryByTestId("pool-details-close")).toBeNull();
  });

  it("renders '--' for every unpriced figure and a real zero as $0.00, distinctly", () => {
    const { getByTestId } = renderWithProviders(
      <PoolDetailsBottomSheet pool={nullHeavyPool} />,
    );
    expect(getByTestId("pool-details-lendingInterest")).toHaveTextContent("--");
    expect(getByTestId("pool-details-currentNetApy")).toHaveTextContent("--");
    expect(getByTestId("pool-details-supplied")).toHaveTextContent("--");
    // A genuine zero must never collapse into the same "--" as null.
    expect(getByTestId("pool-details-borrowed")).toHaveTextContent("$0.00");
    // Backstop: the backend serves no `backstop_usd` for any pool today, so
    // this is null (not omitted) for the same "unavailable" reason as the
    // other three -- extends this regression to the new row.
    expect(getByTestId("pool-details-backstop")).toHaveTextContent("--");
  });

  it("renders no description for a pool with no catalog entry", () => {
    const { queryByTestId } = renderWithProviders(
      <PoolDetailsBottomSheet pool={nullHeavyPool} />,
    );
    expect(queryByTestId("pool-details-description")).toBeNull();
  });

  it("renders the pool name and formatted figures for a fully-priced pool", () => {
    const { getByText, getByTestId } = renderWithProviders(
      <PoolDetailsBottomSheet pool={fixedPool} />,
    );
    expect(getByText("TestnetV2")).toBeTruthy();
    expect(getByTestId("pool-details-lendingInterest")).toHaveTextContent(
      "392.00%",
    );
    expect(getByTestId("pool-details-currentNetApy")).toHaveTextContent(
      "392.00%",
    );
    expect(getByTestId("pool-details-supplied")).toHaveTextContent("$40.39M");
    expect(getByTestId("pool-details-borrowed")).toHaveTextContent("$35.72M");
  });

  it("renders the pool's own name directly in the header, and a separate 'Pool Details' eyebrow above the stat cards", () => {
    // Updated for the design correction (`9448:18518`): the header itself
    // still has no eyebrow stacked directly above the pool name -- but
    // unlike before, the sheet now has a "Pool Details" eyebrow of its own,
    // positioned above the two stat cards rather than the header.
    const { getByText } = renderWithProviders(
      <PoolDetailsBottomSheet pool={fixedPool} />,
    );
    expect(getByText("TestnetV2").props.children).toBe("TestnetV2");
    expect(getByText("Pool Details")).toBeTruthy();
    expect(getByText("by Blend")).toBeTruthy();
  });

  it("renders the fixed-pool description for a pool id present in the catalog", () => {
    const { getByTestId } = renderWithProviders(
      <PoolDetailsBottomSheet pool={fixedPool} />,
    );
    expect(getByTestId("pool-details-description")).toHaveTextContent(
      /Permissionless lending pool with no admin/i,
    );
  });

  it("renders the Backstop row structurally, reading '--' because the backend doesn't serve that figure yet", () => {
    // Design decision (overriding this file's earlier omission): the row
    // always renders, matching the design's structure and this app's
    // "null means unavailable, never silently omitted" rule. It happens to
    // read "--" for every live pool today because the backend serves no
    // `backstop_usd` field yet (`fixedPool.backstopUsd` is null here) --
    // and will start showing a real figure automatically once it does.
    const { getByText, getByTestId } = renderWithProviders(
      <PoolDetailsBottomSheet pool={fixedPool} />,
    );
    expect(getByText("Backstop")).toBeTruthy();
    expect(getByTestId("pool-details-backstop")).toHaveTextContent("--");
  });

  it("renders '--' for Accepted tokens when the reserve list is empty", () => {
    const { getByTestId } = renderWithProviders(
      <PoolDetailsBottomSheet pool={fixedPool} />,
    );
    expect(getByTestId("pool-details-acceptedTokens")).toHaveTextContent("--");
  });

  it("renders an icon stack (no '+N' trailer) for a reserve list at or under the visible cap", () => {
    const poolWithReserves: BlendCatalogPool = {
      ...fixedPool,
      reserves: [
        buildReserve("CUSDC...", "USDC"),
        buildReserve("CEURC...", "EURC"),
      ],
    };
    const { getByTestId, queryByTestId } = renderWithProviders(
      <PoolDetailsBottomSheet pool={poolWithReserves} />,
    );
    expect(getByTestId("pool-details-acceptedTokens")).toBeTruthy();
    expect(queryByTestId("pool-details-acceptedTokens-overflow")).toBeNull();
  });

  it("collapses reserves beyond the visible cap into a '+N' trailer", () => {
    const poolWithManyReserves: BlendCatalogPool = {
      ...fixedPool,
      reserves: [
        buildReserve("C1...", "AAA"),
        buildReserve("C2...", "BBB"),
        buildReserve("C3...", "CCC"),
        buildReserve("C4...", "DDD"),
        buildReserve("C5...", "EEE"),
        buildReserve("C6...", "FFF"),
      ],
    };
    const { getByTestId } = renderWithProviders(
      <PoolDetailsBottomSheet pool={poolWithManyReserves} />,
    );
    // 6 reserves, 4 visible -> "+2".
    expect(
      getByTestId("pool-details-acceptedTokens-overflow"),
    ).toHaveTextContent("+2");
  });

  it("the close button dismisses the sheet via the forwarded ref", () => {
    const dismissMock = jest.fn();
    const ref = React.createRef<BottomSheetModal>();
    Object.defineProperty(ref, "current", {
      value: { dismiss: dismissMock },
      writable: true,
    });

    const { getByTestId } = renderWithProviders(
      <PoolDetailsBottomSheet pool={fixedPool} bottomSheetModalRef={ref} />,
    );
    fireEvent.press(getByTestId("pool-details-close"));
    expect(dismissMock).toHaveBeenCalled();
  });

  it("the bottom 'Close' CTA also dismisses the sheet via the forwarded ref", () => {
    const dismissMock = jest.fn();
    const ref = React.createRef<BottomSheetModal>();
    Object.defineProperty(ref, "current", {
      value: { dismiss: dismissMock },
      writable: true,
    });

    const { getByTestId } = renderWithProviders(
      <PoolDetailsBottomSheet pool={fixedPool} bottomSheetModalRef={ref} />,
    );
    fireEvent.press(getByTestId("pool-details-close-cta"));
    expect(dismissMock).toHaveBeenCalled();
  });
});
