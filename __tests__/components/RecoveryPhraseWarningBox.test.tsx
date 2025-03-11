import RecoveryPhraseWarningBox from "components/RecoveryPhraseWarningBox";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

describe("RecoveryPhraseWarningBox", () => {
  it("renders correctly", () => {
    const { getByText } = renderWithProviders(<RecoveryPhraseWarningBox />);

    // Check that all text items are rendered
    expect(
      getByText(
        "Your recovery phrase gives you full access to your wallets and funds.",
      ),
    ).toBeTruthy();
    expect(
      getByText(
        "If you forget your password, use the recovery phrase to access your wallet",
      ),
    ).toBeTruthy();
    expect(getByText("Don't share this phrase with anyone")).toBeTruthy();
    expect(
      getByText(
        "Stellar Development Foundation will never ever ask for your phrase",
      ),
    ).toBeTruthy();
    expect(getByText("If you lose, we can't recover it")).toBeTruthy();
  });

  it("renders all five warning items", () => {
    const { getAllByTestId } = renderWithProviders(
      <RecoveryPhraseWarningBox />,
    );

    // Find all ItemBox elements by testID pattern
    const itemBoxes = [...Array(5).keys()]
      .map((i) => getAllByTestId(`recovery-phrase-warning-item-${i + 1}`))
      .flat();

    // Verify we have 5 warning items
    expect(itemBoxes.length).toBe(5);
  });
});
