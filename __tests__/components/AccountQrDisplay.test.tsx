import { AccountQrDisplay } from "components/AccountQrDisplay";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

jest.mock("react-native-qrcode-svg");

jest.mock("hooks/useAppTranslation", () => () => ({
  t: (key: string) => {
    const translations: Record<string, string> = {
      "scanReceiveScreen.receive.network": "Stellar",
    };
    return translations[key] || key;
  },
}));

const publicKey = "GACJYENHYW2LGHBNNGNZ4NCBGZYVTGTZM4CJLQIOQQ5IUZU3SYWOW5EK";

describe("AccountQrDisplay", () => {
  it("renders the account name, truncated address, and the network pill", () => {
    const { getByText } = renderWithProviders(
      <AccountQrDisplay publicKey={publicKey} accountName="Account 1" />,
    );

    expect(getByText("Account 1")).toBeTruthy();
    expect(getByText("GACJ...W5EK")).toBeTruthy();
    expect(getByText("Stellar")).toBeTruthy();
  });

  it("renders an empty name line when no account name is provided", () => {
    const { getByText, queryByText } = renderWithProviders(
      <AccountQrDisplay publicKey={publicKey} />,
    );

    expect(getByText("GACJ...W5EK")).toBeTruthy();
    expect(queryByText("undefined")).toBeNull();
  });
});
