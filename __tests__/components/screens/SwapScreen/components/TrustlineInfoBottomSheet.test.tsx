import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { fireEvent } from "@testing-library/react-native";
import { TrustlineInfoBottomSheet } from "components/screens/SwapScreen/components/TrustlineInfoBottomSheet";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

describe("TrustlineInfoBottomSheet", () => {
  it("renders the token-specific title interpolating the destination tokenCode", () => {
    const { getByText } = renderWithProviders(
      <TrustlineInfoBottomSheet tokenCode="AQUA" />,
    );
    // Figma copy: "This will add a trustline to AQUA"
    expect(getByText(/trustline to AQUA/i)).toBeTruthy();
  });

  it("renders the body with the bold '0.5 XLM will be reserved' span and token-specific copy", () => {
    const { getByText } = renderWithProviders(
      <TrustlineInfoBottomSheet tokenCode="AQUA" />,
    );
    expect(getByText(/0\.5 XLM will be reserved/i)).toBeTruthy();
    expect(getByText(/To hold AQUA in your wallet/i)).toBeTruthy();
  });

  it("renders the close (X) chrome button", () => {
    const { getByTestId } = renderWithProviders(
      <TrustlineInfoBottomSheet tokenCode="AQUA" />,
    );
    expect(getByTestId("trustline-info-close")).toBeTruthy();
  });

  it("tapping 'Got it' calls dismiss() on the ref", () => {
    const dismissMock = jest.fn();
    const ref = React.createRef<BottomSheetModal>();
    Object.defineProperty(ref, "current", {
      value: { dismiss: dismissMock },
      writable: true,
    });

    const { getByText } = renderWithProviders(
      <TrustlineInfoBottomSheet bottomSheetModalRef={ref} tokenCode="AQUA" />,
    );
    fireEvent.press(getByText(/Got it/i));
    expect(dismissMock).toHaveBeenCalled();
  });

  it("tapping the close (X) chrome button calls dismiss() on the ref", () => {
    const dismissMock = jest.fn();
    const ref = React.createRef<BottomSheetModal>();
    Object.defineProperty(ref, "current", {
      value: { dismiss: dismissMock },
      writable: true,
    });

    const { getByTestId } = renderWithProviders(
      <TrustlineInfoBottomSheet bottomSheetModalRef={ref} tokenCode="AQUA" />,
    );
    fireEvent.press(getByTestId("trustline-info-close"));
    expect(dismissMock).toHaveBeenCalled();
  });
});
