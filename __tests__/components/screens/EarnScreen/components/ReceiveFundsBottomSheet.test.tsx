import { BottomSheetModal } from "@gorhom/bottom-sheet";
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
      "scanReceiveScreen.receive.network": "Stellar",
      "scanReceiveScreen.receive.networkSupport":
        "This address supports Stellar network.",
      "scanReceiveScreen.receive.copyButton": "Copy wallet address",
    };
    return translations[key] || key;
  },
}));

const makeRef = (dismissMock: jest.Mock) => {
  const ref = React.createRef<BottomSheetModal>();
  Object.defineProperty(ref, "current", {
    value: { dismiss: dismissMock },
    writable: true,
  });
  return ref;
};

describe("ReceiveFundsBottomSheet", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the design's copy (node 9457:46184): title, account identity, and the copy CTA", () => {
    const { getByText } = renderWithProviders(<ReceiveFundsBottomSheet />);

    expect(getByText("Receive funds")).toBeTruthy();
    expect(getByText("Account 1")).toBeTruthy();
    expect(getByText("GACJ...W5EK")).toBeTruthy();
    expect(getByText("Stellar")).toBeTruthy();
    expect(getByText("This address supports Stellar network.")).toBeTruthy();
    expect(getByText("Copy wallet address")).toBeTruthy();
  });

  it("copies the public key through the plain clipboard path (same as ReceiveTabView) when the CTA is pressed", () => {
    const { getByTestId } = renderWithProviders(<ReceiveFundsBottomSheet />);

    fireEvent.press(getByTestId("receive-funds-copy-button"));

    expect(mockCopyToClipboard).toHaveBeenCalledWith(mockAccount.publicKey);
  });

  it("dismisses via the forwarded ref when the close control is pressed", () => {
    const dismissMock = jest.fn();
    const ref = makeRef(dismissMock);
    const { getByTestId } = renderWithProviders(
      <ReceiveFundsBottomSheet bottomSheetModalRef={ref} />,
    );

    fireEvent.press(getByTestId("receive-funds-close"));
    expect(dismissMock).toHaveBeenCalledTimes(1);
  });
});
