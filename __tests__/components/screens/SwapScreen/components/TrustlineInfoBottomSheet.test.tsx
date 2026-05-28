import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { fireEvent } from "@testing-library/react-native";
import { TrustlineInfoBottomSheet } from "components/screens/SwapScreen/components/TrustlineInfoBottomSheet";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

describe("TrustlineInfoBottomSheet", () => {
  it("renders the trustline explainer copy mentioning 0.5 XLM reserve and refundable", () => {
    const { getByText } = renderWithProviders(<TrustlineInfoBottomSheet />);
    expect(getByText(/0\.5 XLM/)).toBeTruthy();
    expect(getByText(/refundable/i)).toBeTruthy();
  });

  it("tapping 'Got it' calls dismiss() on the ref", () => {
    const dismissMock = jest.fn();
    const ref = React.createRef<BottomSheetModal>();
    Object.defineProperty(ref, "current", {
      value: { dismiss: dismissMock },
      writable: true,
    });

    const { getByText } = renderWithProviders(
      <TrustlineInfoBottomSheet bottomSheetModalRef={ref} />,
    );
    fireEvent.press(getByText(/Got it/i));
    expect(dismissMock).toHaveBeenCalled();
  });
});
