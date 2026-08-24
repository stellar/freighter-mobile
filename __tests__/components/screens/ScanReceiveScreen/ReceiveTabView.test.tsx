import { fireEvent } from "@testing-library/react-native";
import { ReceiveTabView } from "components/screens/ScanReceiveScreen/ReceiveTabView";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

jest.mock("react-native-qrcode-svg");

const mockAccount = {
  publicKey: "GACJYENHYW2LGHBNNGNZ4NCBGZYVTGTZM4CJLQIOQQ5IUZU3SYWOW5EK",
  accountName: "Test Account",
};

jest.mock("hooks/useGetActiveAccount", () => ({
  __esModule: true,
  default: () => ({ account: mockAccount }),
}));

const mockCopyToClipboard = jest.fn();
jest.mock("hooks/useClipboard", () => ({
  useClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
}));

jest.mock("hooks/useAppTranslation", () => () => ({
  t: (key: string) => {
    const translations: Record<string, string> = {
      "scanReceiveScreen.receive.network": "Stellar",
      "scanReceiveScreen.receive.networkSupport":
        "This address supports Stellar network.",
      "scanReceiveScreen.receive.copyButton": "Copy wallet address",
    };
    return translations[key] || key;
  },
}));

describe("ReceiveTabView", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the account name and truncated address", () => {
    const { getByText } = renderWithProviders(<ReceiveTabView />);

    expect(getByText("Test Account")).toBeTruthy();
    expect(getByText("GACJ...W5EK")).toBeTruthy();
  });

  it("copies the public key when the copy button is pressed", () => {
    const { getByText } = renderWithProviders(<ReceiveTabView />);

    fireEvent.press(getByText("Copy wallet address"));

    expect(mockCopyToClipboard).toHaveBeenCalledWith(mockAccount.publicKey);
  });
});
