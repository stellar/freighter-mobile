import { render } from "@testing-library/react-native";
import { ContractSpecNote } from "components/screens/SignTransactionDetails/components/KeyVal";
import i18n from "i18n";
import en from "i18n/locales/en/translations.json";
import React from "react";

jest.mock("hooks/useColors", () => ({
  __esModule: true,
  default: () => ({ themeColors: { text: { secondary: "#999" } } }),
}));

describe("ContractSpecNote", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  // The other signing suites render translation keys verbatim, so a key that
  // resolves to nothing passes them and only shows up as raw text on device.
  it("renders the translated note, not its key", () => {
    const { getByText } = render(<ContractSpecNote />);

    expect(
      getByText(en.signTransactionDetails.operations.contractSpecNote),
    ).toBeTruthy();
  });
});
