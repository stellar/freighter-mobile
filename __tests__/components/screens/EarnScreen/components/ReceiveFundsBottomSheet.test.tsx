import { fireEvent } from "@testing-library/react-native";
import { ReceiveFundsBottomSheet } from "components/screens/EarnScreen/components/ReceiveFundsBottomSheet";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

jest.mock("react-native-qrcode-svg");

const mockAccount = {
  publicKey: "GACJYENHYW2LGHBNNGNZ4NCBGZYVTGTZM4CJLQIOQQ5IUZU3SYWOW5EK",
  accountName: "Account 1",
};

jest.mock("hooks/useGetActiveAccount", () => ({
  __esModule: true,
  default: () => ({ account: mockAccount }),
}));

const mockCopyToClipboard = jest.fn();
jest.mock("hooks/useClipboard", () => ({
  useClipboard: () => ({
    copyToClipboard: mockCopyToClipboard,
    getClipboardText: jest.fn(),
  }),
}));

jest.mock("hooks/useAppTranslation", () => () => ({
  t: (key: string) => {
    const translations: Record<string, string> = {
      "earnReceiveFunds.title": "Receive funds",
      "earnReceiveFunds.networkSupport":
        "This address supports Stellar network.",
      "earnReceiveFunds.copyAddress": "Copy address",
    };
    return translations[key] || key;
  },
}));

describe("ReceiveFundsBottomSheet", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderSheet = (
    props: { onBack?: jest.Mock; onClose?: jest.Mock } = {},
  ) =>
    renderWithProviders(
      <ReceiveFundsBottomSheet
        onBack={props.onBack ?? jest.fn()}
        onClose={props.onClose ?? jest.fn()}
      />,
    );

  it("renders the title, the QR, the network line and the copy CTA, without the account row", () => {
    const { getByText, getByTestId, queryByText } = renderSheet();

    expect(getByText("Receive funds")).toBeTruthy();
    expect(getByTestId("receive-funds-qr")).toBeTruthy();
    expect(getByText("This address supports Stellar network.")).toBeTruthy();
    expect(getByText("Copy address")).toBeTruthy();
    expect(queryByText("Account 1")).toBeNull();
  });

  it("copies the public key through the plain clipboard path (same as ReceiveTabView) when the CTA is pressed", () => {
    const { getByTestId } = renderSheet();

    fireEvent.press(getByTestId("receive-funds-copy-button"));

    expect(mockCopyToClipboard).toHaveBeenCalledWith(mockAccount.publicKey);
  });

  it("goes back to the sheet below with the back arrow", () => {
    const onBack = jest.fn();
    const onClose = jest.fn();
    const { getByTestId } = renderSheet({ onBack, onClose });

    fireEvent.press(getByTestId("receive-funds-back"));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes both sheets with the X", () => {
    const onBack = jest.fn();
    const onClose = jest.fn();
    const { getByTestId } = renderSheet({ onBack, onClose });

    fireEvent.press(getByTestId("receive-funds-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onBack).not.toHaveBeenCalled();
  });
});
