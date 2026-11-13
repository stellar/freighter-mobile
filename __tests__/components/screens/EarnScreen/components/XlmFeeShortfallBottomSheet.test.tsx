import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { fireEvent } from "@testing-library/react-native";
import { XlmFeeShortfallBottomSheet } from "components/screens/EarnScreen/components/XlmFeeShortfallBottomSheet";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

const makeRef = (dismissMock: jest.Mock) => {
  const ref = React.createRef<BottomSheetModal>();
  Object.defineProperty(ref, "current", {
    value: { dismiss: dismissMock },
    writable: true,
  });
  return ref;
};

describe("XlmFeeShortfallBottomSheet", () => {
  it("renders the title, the one-line body, and both actions when the onramp is offered", () => {
    const { getByText } = renderWithProviders(
      <XlmFeeShortfallBottomSheet
        onBuy={jest.fn()}
        onReceive={jest.fn()}
        isBuyAvailable
      />,
    );

    expect(getByText("XLM needed for network fees")).toBeTruthy();
    expect(getByText("Add XLM to your wallet to continue")).toBeTruthy();
    expect(getByText("Buy with Coinbase")).toBeTruthy();
    expect(getByText("Receive XLM")).toBeTruthy();
  });

  it("calls onBuy when 'Buy with Coinbase' is pressed", () => {
    const onBuy = jest.fn();
    const { getByTestId } = renderWithProviders(
      <XlmFeeShortfallBottomSheet
        onBuy={onBuy}
        onReceive={jest.fn()}
        isBuyAvailable
      />,
    );

    fireEvent.press(getByTestId("xlm-fee-shortfall-buy-button"));
    expect(onBuy).toHaveBeenCalledTimes(1);
  });

  it("offers only Receive XLM where the onramp isn't available, e.g. testnet", () => {
    const { getByText, queryByTestId } = renderWithProviders(
      <XlmFeeShortfallBottomSheet
        onBuy={jest.fn()}
        onReceive={jest.fn()}
        isBuyAvailable={false}
      />,
    );

    expect(queryByTestId("xlm-fee-shortfall-buy-button")).toBeNull();
    expect(getByText("Receive XLM")).toBeTruthy();
  });

  it("calls onReceive when 'Receive XLM' is pressed", () => {
    const onReceive = jest.fn();
    const { getByTestId } = renderWithProviders(
      <XlmFeeShortfallBottomSheet
        onBuy={jest.fn()}
        onReceive={onReceive}
        isBuyAvailable
      />,
    );

    fireEvent.press(getByTestId("xlm-fee-shortfall-receive-button"));
    expect(onReceive).toHaveBeenCalledTimes(1);
  });

  it("dismisses via the forwarded ref when the close control is pressed", () => {
    const dismissMock = jest.fn();
    const ref = makeRef(dismissMock);
    const { getByTestId } = renderWithProviders(
      <XlmFeeShortfallBottomSheet
        bottomSheetModalRef={ref}
        onBuy={jest.fn()}
        onReceive={jest.fn()}
        isBuyAvailable
      />,
    );

    fireEvent.press(getByTestId("xlm-fee-shortfall-close"));
    expect(dismissMock).toHaveBeenCalledTimes(1);
  });
});
