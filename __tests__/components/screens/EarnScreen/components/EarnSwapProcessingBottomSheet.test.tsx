import { act } from "@testing-library/react-native";
import { EarnSwapProcessingBottomSheet } from "components/screens/EarnScreen/components/EarnSwapProcessingBottomSheet";
import { TokenTypeWithCustomToken } from "config/types";
import { useSwapStore } from "ducks/swap";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

jest.mock("services/stellar", () => ({
  getTransactionDetails: jest.fn(() => new Promise(() => {})),
}));

const { track } = jest.requireMock("services/analytics/core");

const renderSheet = () =>
  renderWithProviders(
    <EarnSwapProcessingBottomSheet
      sourceAmount="10"
      sourceToken={{ type: "native", code: "XLM" }}
      destinationAmount="2"
      destinationToken={{
        type: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
        code: "EURC",
        issuer: {
          key: "GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2",
        },
      }}
      onClose={jest.fn()}
    />,
  );

// The swap inside Earn reports Swap's processing and success screens, tagged
// as opened from Earn, as the extension's does.
describe("EarnSwapProcessingBottomSheet screen views", () => {
  beforeEach(() => {
    track.mockClear();
    act(() => {
      useSwapStore.getState().resetSwap();
      useSwapStore.getState().setEntrySource("earn");
      useTransactionBuilderStore.setState({
        transactionHash: null,
        error: null,
      });
    });
  });

  it("reports swap_processing tagged as opened from Earn", () => {
    renderSheet();

    expect(track).toHaveBeenCalledWith("screen.viewed", {
      screen_name: "swap_processing",
      flow: "swap",
      step: "processing",
      source: "earn",
    });
  });

  it("reports swap_success tagged as opened from Earn, even after the swap is reset", () => {
    renderSheet();

    act(() => {
      useSwapStore.getState().resetSwap();
      useTransactionBuilderStore.setState({ transactionHash: "tx-hash" });
    });

    expect(track).toHaveBeenCalledWith("screen.viewed", {
      screen_name: "swap_success",
      flow: "swap",
      step: "success",
      source: "earn",
    });
  });
});
