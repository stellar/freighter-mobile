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
  it("renders the design's copy (node 13722:341905): title, one-line body, and both action labels", () => {
    const { getByText } = renderWithProviders(
      <XlmFeeShortfallBottomSheet onBuy={jest.fn()} onReceive={jest.fn()} />,
    );

    expect(getByText("XLM needed for network fees")).toBeTruthy();
    expect(getByText("Add XLM to your wallet to continue")).toBeTruthy();
    expect(getByText("Buy with Coinbase")).toBeTruthy();
    expect(getByText("Receive XLM")).toBeTruthy();
  });

  it("calls onBuy when 'Buy with Coinbase' is pressed", () => {
    const onBuy = jest.fn();
    const { getByTestId } = renderWithProviders(
      <XlmFeeShortfallBottomSheet onBuy={onBuy} onReceive={jest.fn()} />,
    );

    fireEvent.press(getByTestId("xlm-fee-shortfall-buy-button"));
    expect(onBuy).toHaveBeenCalledTimes(1);
  });

  it("calls onReceive when 'Transfer from another account' is pressed", () => {
    const onReceive = jest.fn();
    const { getByTestId } = renderWithProviders(
      <XlmFeeShortfallBottomSheet onBuy={jest.fn()} onReceive={onReceive} />,
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
      />,
    );

    fireEvent.press(getByTestId("xlm-fee-shortfall-close"));
    expect(dismissMock).toHaveBeenCalledTimes(1);
  });
});
