import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { fireEvent } from "@testing-library/react-native";
import { PoolDetailsBottomSheet } from "components/screens/EarnScreen/components/PoolDetailsBottomSheet";
import { BlendCatalogPool } from "config/blendTypes";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

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
    expect(getByTestId("pool-details-totalSupplied")).toHaveTextContent("--");
    // A genuine zero must never collapse into the same "--" as null.
    expect(getByTestId("pool-details-totalBorrowed")).toHaveTextContent(
      "$0.00",
    );
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
    expect(getByTestId("pool-details-totalSupplied")).toHaveTextContent(
      "$40.39M",
    );
    expect(getByTestId("pool-details-totalBorrowed")).toHaveTextContent(
      "$35.72M",
    );
  });

  it("renders the pool's own name as the prominent heading, with no generic eyebrow label above it", () => {
    // Pins the ProtocolDetailsBottomSheet-style hierarchy: the identity
    // content the user opened the sheet for (the pool name) takes the
    // prominent slot directly, with no "Pool details" eyebrow inverting it.
    const { getByText, queryByText } = renderWithProviders(
      <PoolDetailsBottomSheet pool={fixedPool} />,
    );
    expect(getByText("TestnetV2").props.children).toBe("TestnetV2");
    expect(queryByText("Pool details")).toBeNull();
  });

  it("renders the fixed-pool description for a pool id present in the catalog", () => {
    const { getByTestId } = renderWithProviders(
      <PoolDetailsBottomSheet pool={fixedPool} />,
    );
    expect(getByTestId("pool-details-description")).toHaveTextContent(
      /Permissionless lending pool with no admin/i,
    );
  });

  it("never renders a Backstop row — the backend doesn't serve that figure yet", () => {
    const { queryByText } = renderWithProviders(
      <PoolDetailsBottomSheet pool={fixedPool} />,
    );
    expect(queryByText(/backstop/i)).toBeNull();
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
});
