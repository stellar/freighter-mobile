import { fireEvent } from "@testing-library/react-native";
import ScanQRCodeScreen from "components/screens/ScanQRCodeScreen";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

jest.mock("components/QRScanner", () => ({ QRScanner: () => null }));

jest.mock("hooks/useClearTransitionParam", () => ({
  useClearTransitionParam: jest.fn(),
}));

const mockHandleHeaderLeft = jest.fn();
jest.mock("hooks/useQRCodeScreenScanner", () => ({
  useQRCodeScreenScanner: () => ({
    handlers: {
      handleHeaderLeft: mockHandleHeaderLeft,
      handleQRCodeScanned: jest.fn(),
    },
    state: {
      title: "Scan to send",
      scannerTitle: "Scan a Stellar address",
      showManualInput: false,
    },
    ManualInputOverlay: null,
  }),
}));

const renderScreen = () =>
  renderWithProviders(
    <ScanQRCodeScreen
      navigation={{ goBack: jest.fn() } as never}
      route={{ params: { source: "address_input" } } as never}
    />,
  );

describe("ScanQRCodeScreen", () => {
  beforeEach(() => jest.clearAllMocks());

  it("closes back to Send with the X, beside its title", () => {
    const { getByLabelText, queryByLabelText, getByText } = renderScreen();

    expect(getByText("Scan to send")).toBeTruthy();
    expect(queryByLabelText("Back")).toBeNull();

    fireEvent.press(getByLabelText("Close"));

    expect(mockHandleHeaderLeft).toHaveBeenCalledTimes(1);
  });
});
