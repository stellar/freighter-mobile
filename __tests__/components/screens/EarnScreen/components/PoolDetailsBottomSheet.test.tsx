import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { fireEvent } from "@testing-library/react-native";
import { PoolDetailsBottomSheet } from "components/screens/EarnScreen/components/PoolDetailsBottomSheet";
import { BLEND_FIXED_POOL_IDS, BLEND_LENDING_DOCS_URL } from "config/blend";
import { BlendCatalogPool } from "config/blendTypes";
import { NETWORKS } from "config/constants";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

const mockOpenInAppBrowser = jest.fn(() => Promise.resolve());
jest.mock("hooks/useInAppBrowser", () => ({
  useInAppBrowser: () => ({ open: mockOpenInAppBrowser }),
}));

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

// The testnet Fixed pool — fully priced figures, including a supply-side rate
// that legitimately exceeds 1 (a decimal fraction, not a pre-multiplied
// percentage).
const fixedPool: BlendCatalogPool = {
  id: BLEND_FIXED_POOL_IDS[NETWORKS.TESTNET]!,
  name: "Testnet v2.1",
  status: "ADMIN_ACTIVE",
  suppliedUsd: 40385476.30883376,
  borrowedUsd: 35717534.91620809,
  interestApy: 3.9199825260259216,
  netApy: 3.9199825260259216,
  backstopUsd: null,
  reserves: [],
};

describe("PoolDetailsBottomSheet", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders nothing when the pool hasn't resolved yet", () => {
    const { queryByTestId } = renderWithProviders(
      <PoolDetailsBottomSheet pool={null} apy={0.1694} />,
    );
    expect(queryByTestId("pool-details-close")).toBeNull();
  });

  it("renders '--' for every unpriced figure and a real zero as $0.00, distinctly", () => {
    const { getByTestId } = renderWithProviders(
      <PoolDetailsBottomSheet pool={nullHeavyPool} apy={null} />,
    );
    expect(getByTestId("pool-details-depositApy")).toHaveTextContent("--");
    expect(getByTestId("pool-details-supplied")).toHaveTextContent("--");
    // A genuine zero must never collapse into the same "--" as null.
    expect(getByTestId("pool-details-borrowed")).toHaveTextContent("$0.00");
    expect(getByTestId("pool-details-backstop")).toHaveTextContent("--");
  });

  it("renders the same generic description for every pool", () => {
    const generic = /Deposit supported token into this Blend pool/i;

    [nullHeavyPool, fixedPool].forEach((pool) => {
      const { getByTestId, unmount } = renderWithProviders(
        <PoolDetailsBottomSheet pool={pool} apy={0.1694} />,
      );
      expect(getByTestId("pool-details-description")).toHaveTextContent(
        generic,
      );
      unmount();
    });
  });

  it("makes no per-pool claims, such as 'no admin', that a new deployment can falsify", () => {
    const { getByTestId } = renderWithProviders(
      <PoolDetailsBottomSheet pool={fixedPool} apy={0.1694} />,
    );
    expect(getByTestId("pool-details-description")).not.toHaveTextContent(
      /no admin/i,
    );
  });

  it("renders the pool's name, the deposit APY and the pool's liquidity", () => {
    const { getByText, getByTestId } = renderWithProviders(
      <PoolDetailsBottomSheet
        pool={{ ...fixedPool, backstopUsd: 1530000 }}
        apy={0.1694}
      />,
    );
    expect(getByText("Testnet v2.1")).toBeTruthy();
    expect(getByText("by Blend")).toBeTruthy();
    expect(getByText("Current yield")).toBeTruthy();
    expect(getByText("Pool liquidity")).toBeTruthy();
    expect(getByTestId("pool-details-depositApy")).toHaveTextContent("16.94%");
    expect(getByTestId("pool-details-supplied")).toHaveTextContent("$40.39M");
    expect(getByTestId("pool-details-borrowed")).toHaveTextContent("$35.72M");
    expect(getByTestId("pool-details-backstop")).toHaveTextContent("$1.53M");
  });

  it("leaves out the rows the design dropped", () => {
    const { queryByText } = renderWithProviders(
      <PoolDetailsBottomSheet pool={fixedPool} apy={0.1694} />,
    );
    expect(queryByText("Lending Interest")).toBeNull();
    expect(queryByText("Current Net APY")).toBeNull();
    expect(queryByText("Accepted tokens")).toBeNull();
  });

  it("opens Blend's lending docs from 'View pool details'", () => {
    const { getByTestId } = renderWithProviders(
      <PoolDetailsBottomSheet pool={fixedPool} apy={0.1694} />,
    );
    fireEvent.press(getByTestId("pool-details-view-pool-details"));
    expect(mockOpenInAppBrowser).toHaveBeenCalledWith(BLEND_LENDING_DOCS_URL);
  });

  it("has no bottom Close CTA; the header X dismisses the sheet via the forwarded ref", () => {
    const dismiss = jest.fn();
    const ref = React.createRef<BottomSheetModal>();
    Object.defineProperty(ref, "current", {
      value: { dismiss },
      writable: true,
    });
    const { getByTestId, queryByTestId } = renderWithProviders(
      <PoolDetailsBottomSheet
        pool={fixedPool}
        apy={0.1694}
        bottomSheetModalRef={ref}
      />,
    );
    expect(queryByTestId("pool-details-close-cta")).toBeNull();
    fireEvent.press(getByTestId("pool-details-close"));
    expect(dismiss).toHaveBeenCalledTimes(1);
  });
});
