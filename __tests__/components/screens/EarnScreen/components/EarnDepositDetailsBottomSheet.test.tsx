import { fireEvent, waitFor } from "@testing-library/react-native";
import { EarnDepositDetailsBottomSheet } from "components/screens/EarnScreen/components/EarnDepositDetailsBottomSheet";
import { NETWORKS } from "config/constants";
import { useAuthenticationStore } from "ducks/auth";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

const mockGetTransactionDetails = jest.fn();
jest.mock("services/stellar", () => ({
  getTransactionDetails: (...args: unknown[]) =>
    mockGetTransactionDetails(...args),
}));

const mockOpenInAppBrowser = jest.fn(() => Promise.resolve());
jest.mock("hooks/useInAppBrowser", () => ({
  useInAppBrowser: () => ({ open: mockOpenInAppBrowser }),
}));

const HASH = "b".repeat(64);

const renderSheet = (
  props: Partial<
    React.ComponentProps<typeof EarnDepositDetailsBottomSheet>
  > = {},
) =>
  renderWithProviders(
    <EarnDepositDetailsBottomSheet
      tokenAmount="10"
      tokenCode="USDC"
      poolName="Fixed v2.1"
      transactionHash={HASH}
      transactionXdr={null}
      onClose={jest.fn()}
      {...props}
    />,
  );

describe("EarnDepositDetailsBottomSheet", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthenticationStore.setState({ network: NETWORKS.PUBLIC });
    mockGetTransactionDetails.mockResolvedValue(null);
  });

  it("records a deposit to its pool, the amount unsigned", () => {
    const { getByText, getByTestId } = renderSheet();

    expect(getByText("Deposited USDC")).toBeTruthy();
    expect(getByText("To")).toBeTruthy();
    expect(getByTestId("earn-deposit-details-pool")).toHaveTextContent(
      "Fixed v2.1 Pool · Blend",
    );
    expect(getByTestId("earn-deposit-details-amount")).toHaveTextContent(
      "10.00 USDC",
    );
  });

  it("reads an unknown amount and a date not yet fetched as --", () => {
    const { getByTestId } = renderSheet({ tokenAmount: null });

    expect(getByTestId("earn-deposit-details-amount")).toHaveTextContent("--");
    expect(getByTestId("earn-deposit-details-date")).toHaveTextContent("--");
  });

  it("dates the record from the caller until the network answers", async () => {
    const { getByTestId } = renderSheet({
      occurredAt: "2026-08-28T12:00:00Z",
    });

    expect(getByTestId("earn-deposit-details-date")).toHaveTextContent(
      /Aug 28, 2026/,
    );
    await waitFor(() =>
      expect(mockGetTransactionDetails).toHaveBeenCalledWith(
        HASH,
        NETWORKS.PUBLIC,
      ),
    );
  });

  it("reports the explorer link to a caller that asks", () => {
    const onAction = jest.fn();
    const { getByTestId } = renderSheet({ onAction });

    fireEvent.press(getByTestId("earn-deposit-details-view-on-explorer"));

    expect(onAction).toHaveBeenCalledWith("explorer");
    expect(mockOpenInAppBrowser).toHaveBeenCalledWith(
      expect.stringContaining(`/tx/${HASH}`),
    );
  });
});
