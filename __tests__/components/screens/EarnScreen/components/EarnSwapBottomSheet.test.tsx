/* eslint-disable @fnando/consistent-import/consistent-import */
import { fireEvent } from "@testing-library/react-native";
import { EarnSwapBottomSheet } from "components/screens/EarnScreen/components/EarnSwapBottomSheet";
import { renderWithProviders } from "helpers/testUtils";
import { UseTokenFiatConverterResult } from "hooks/useTokenFiatConverter";
import React from "react";

jest.mock("providers/ToastProvider", () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
  useToast: () => ({ showToast: jest.fn(), dismissToast: jest.fn() }),
}));
jest.mock("hooks/useAppTranslation", () => {
  const stableTranslation = { t: (key: string) => key };
  return {
    __esModule: true,
    default: () => stableTranslation,
  };
});

const converter = {
  tokenAmount: "10",
  tokenAmountDisplay: "10",
  tokenAmountDisplayRaw: null,
  fiatAmount: "0",
  fiatAmountDisplay: "0.00",
  fiatAmountDisplayRaw: null,
  showFiatAmount: false,
  setShowFiatAmount: jest.fn(),
  handleDisplayAmountChange: jest.fn(),
  setTokenAmount: jest.fn(),
  setFiatAmount: jest.fn(),
  updateFiatDisplay: jest.fn(),
  setDisplayAmountFromText: jest.fn(),
  pasteRejectNonce: 0,
} as UseTokenFiatConverterResult;

const renderSheet = (
  props: Partial<React.ComponentProps<typeof EarnSwapBottomSheet>>,
) => {
  const handlers = {
    onSourcePickerPress: jest.fn(),
    onSettingsPress: jest.fn(),
    onClose: jest.fn(),
    onPercentagePress: jest.fn(),
  };
  const view = renderWithProviders(
    <EarnSwapBottomSheet
      sourceLabel="XLM"
      converter={converter}
      hasUsdPrice={false}
      destinationToken={{ code: "EURC", issuer: { key: "GISSUER" } }}
      destinationLabel="EURC"
      destinationAmount="5"
      onReview={jest.fn()}
      ctaLabel="Review swap"
      {...handlers}
      {...props}
    />,
  );
  return { ...view, ...handlers };
};

describe("EarnSwapBottomSheet", () => {
  // Review shows the swap as it is when it opens.
  describe("while Review is being built", () => {
    it("keeps the amount, the source and the settings as they are", () => {
      const { getByTestId, onSourcePickerPress, onSettingsPress } = renderSheet(
        { isBuildingReview: true },
      );

      fireEvent.press(getByTestId("earn-swap-sell-pill"));
      fireEvent.press(getByTestId("earn-swap-settings"));

      expect(getByTestId("earn-swap-amount-input").props.editable).toBe(false);
      expect(onSourcePickerPress).not.toHaveBeenCalled();
      expect(onSettingsPress).not.toHaveBeenCalled();
    });

    it("still closes with X", () => {
      const { getByTestId, onClose } = renderSheet({ isBuildingReview: true });

      fireEvent.press(getByTestId("earn-swap-close"));

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it("lets the amount, the source and the settings change otherwise", () => {
    const { getByTestId, onSourcePickerPress, onSettingsPress } = renderSheet(
      {},
    );

    fireEvent.press(getByTestId("earn-swap-sell-pill"));
    fireEvent.press(getByTestId("earn-swap-settings"));

    expect(getByTestId("earn-swap-amount-input").props.editable).not.toBe(
      false,
    );
    expect(onSourcePickerPress).toHaveBeenCalledTimes(1);
    expect(onSettingsPress).toHaveBeenCalledTimes(1);
  });

  // As on main Swap, under the cards.
  describe("the quote", () => {
    it("shimmers the receive amount while it is on its way", () => {
      const { getByTestId } = renderSheet({ isReceiveLoading: true });

      // The shimmer hides itself from accessibility.
      expect(
        getByTestId("amount-card-amount-loading", {
          includeHiddenElements: true,
        }),
      ).toBeTruthy();
    });

    it("shows its network fee and opens the details", () => {
      const onSeeDetails = jest.fn();
      const { getByTestId } = renderSheet({
        networkFee: "$0.02",
        onSeeDetails,
      });

      fireEvent.press(getByTestId("earn-swap-see-details"));

      expect(getByTestId("earn-swap-see-details")).toHaveTextContent(
        /swapScreen.details.networkFeeLine/,
      );
      expect(onSeeDetails).toHaveBeenCalledTimes(1);
    });

    it("shows no details before there is a quote", () => {
      const { queryByTestId } = renderSheet({
        networkFee: null,
        onSeeDetails: jest.fn(),
      });

      expect(queryByTestId("earn-swap-see-details")).toBeNull();
    });

    it("says when it is unavailable, and explains why", () => {
      const onQuoteUnavailablePress = jest.fn();
      const { getByTestId } = renderSheet({
        showQuoteUnavailable: true,
        onQuoteUnavailablePress,
      });

      fireEvent.press(getByTestId("earn-swap-quote-unavailable"));

      expect(onQuoteUnavailablePress).toHaveBeenCalledTimes(1);
    });

    // Either line opens a sheet over this one.
    it("keeps its lines shut while Review is being built", () => {
      const onSeeDetails = jest.fn();
      const onQuoteUnavailablePress = jest.fn();
      const { getByTestId } = renderSheet({
        isBuildingReview: true,
        networkFee: "$0.02",
        onSeeDetails,
        showQuoteUnavailable: true,
        onQuoteUnavailablePress,
      });

      fireEvent.press(getByTestId("earn-swap-see-details"));
      fireEvent.press(getByTestId("earn-swap-quote-unavailable"));

      expect(onSeeDetails).not.toHaveBeenCalled();
      expect(onQuoteUnavailablePress).not.toHaveBeenCalled();
    });
  });
});
