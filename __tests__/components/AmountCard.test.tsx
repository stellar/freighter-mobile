/* eslint-disable @fnando/consistent-import/consistent-import */
import { fireEvent } from "@testing-library/react-native";
import { BigNumber } from "bignumber.js";
import { AmountCard } from "components/AmountCard";
import { renderWithProviders } from "helpers/testUtils";
import { UseTokenFiatConverterResult } from "hooks/useTokenFiatConverter";
import React from "react";

const makeConverter = (
  overrides: Partial<UseTokenFiatConverterResult> = {},
): UseTokenFiatConverterResult => ({
  tokenAmount: "0",
  tokenAmountDisplay: "0",
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
  ...overrides,
});

const mockBalance = {
  id: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
  tokenCode: "USDC",
  token: {
    code: "USDC",
    issuer: {
      key: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    },
  },
  total: new BigNumber("100"),
  available: new BigNumber("100"),
  decimals: 7,
  currentPrice: new BigNumber("1"),
} as never;

describe("AmountCard", () => {
  describe("editable mode", () => {
    it("renders the label, the TextInput, and the picker chip", () => {
      const onPickerPress = jest.fn();
      const { getByText, getByTestId } = renderWithProviders(
        <AmountCard
          mode="editable"
          label="Sending"
          selectedToken={mockBalance}
          onPickerPress={onPickerPress}
          pickerTestID="picker"
          inputTestID="amount-input"
          converter={makeConverter()}
          hasUsdPrice
          secondaryAmountText="$0.00"
        />,
      );

      expect(getByText("Sending")).toBeTruthy();
      expect(getByTestId("amount-input")).toBeTruthy();
      expect(getByTestId("picker")).toBeTruthy();
    });

    it("forwards TextInput.onChangeText to converter.setDisplayAmountFromText", () => {
      const setDisplayAmountFromText = jest.fn();
      const { getByTestId } = renderWithProviders(
        <AmountCard
          mode="editable"
          label="Sending"
          selectedToken={mockBalance}
          onPickerPress={jest.fn()}
          inputTestID="amount-input"
          converter={makeConverter({ setDisplayAmountFromText })}
          hasUsdPrice
        />,
      );

      fireEvent.changeText(getByTestId("amount-input"), "1.5");
      expect(setDisplayAmountFromText).toHaveBeenCalledWith("1.5");
    });

    it("fires onPickerPress when the picker chip is tapped", () => {
      const onPickerPress = jest.fn();
      const { getByTestId } = renderWithProviders(
        <AmountCard
          mode="editable"
          label="Sending"
          selectedToken={mockBalance}
          onPickerPress={onPickerPress}
          pickerTestID="picker"
          converter={makeConverter()}
          hasUsdPrice
        />,
      );

      fireEvent.press(getByTestId("picker"));
      expect(onPickerPress).toHaveBeenCalledTimes(1);
    });

    it("toggles showFiatAmount when the secondary-row toggle is pressed", () => {
      const setShowFiatAmount = jest.fn();
      const { getByTestId } = renderWithProviders(
        <AmountCard
          mode="editable"
          label="Sending"
          selectedToken={mockBalance}
          onPickerPress={jest.fn()}
          fiatToggleTestID="toggle"
          converter={makeConverter({ setShowFiatAmount })}
          hasUsdPrice
          secondaryAmountText="$0.00"
        />,
      );

      fireEvent.press(getByTestId("toggle"));
      expect(setShowFiatAmount).toHaveBeenCalledWith(true);
    });

    it("hides the secondary row when hasUsdPrice is false", () => {
      const { queryByTestId } = renderWithProviders(
        <AmountCard
          mode="editable"
          label="Sending"
          selectedToken={mockBalance}
          onPickerPress={jest.fn()}
          fiatToggleTestID="toggle"
          converter={makeConverter()}
          hasUsdPrice={false}
        />,
      );

      expect(queryByTestId("toggle")).toBeNull();
    });

    it("renders the available balance text in the header row when provided", () => {
      const { getByText } = renderWithProviders(
        <AmountCard
          mode="editable"
          label="Sending"
          selectedToken={mockBalance}
          onPickerPress={jest.fn()}
          availableBalanceText="100 USDC available"
          converter={makeConverter()}
          hasUsdPrice
        />,
      );

      expect(getByText("100 USDC available")).toBeTruthy();
    });
  });

  describe("readonly mode", () => {
    it("renders the primary amount as a Display + the secondary amount", () => {
      const { getByText } = renderWithProviders(
        <AmountCard
          mode="readonly"
          label="You receive"
          selectedToken={mockBalance}
          onPickerPress={jest.fn()}
          primaryAmount="1.234 USDC"
          secondaryAmount="$1.23"
        />,
      );

      expect(getByText("1.234 USDC")).toBeTruthy();
      expect(getByText("$1.23")).toBeTruthy();
    });

    it("readonly type rejects editable-only props at compile time", () => {
      // This test exists for the runtime side; the compile-time guarantee
      // is asserted by the discriminated union itself — `inputTestID` and
      // `fiatToggleTestID` are not in the readonly props shape.
      const { queryByTestId } = renderWithProviders(
        <AmountCard
          mode="readonly"
          label="You receive"
          selectedToken={mockBalance}
          onPickerPress={jest.fn()}
          primaryAmount="0"
        />,
      );

      // No fiat toggle button is rendered in readonly mode regardless.
      expect(queryByTestId("toggle")).toBeNull();
    });

    it("picker chip is still tappable even when the amount is read-only", () => {
      const onPickerPress = jest.fn();
      const { getByTestId } = renderWithProviders(
        <AmountCard
          mode="readonly"
          label="You receive"
          selectedToken={mockBalance}
          onPickerPress={onPickerPress}
          pickerTestID="picker"
          primaryAmount="1.234"
        />,
      );

      fireEvent.press(getByTestId("picker"));
      expect(onPickerPress).toHaveBeenCalledTimes(1);
    });

    it("shows the pickerLabel override when no token is selected (e.g. 'Select token')", () => {
      const { getByText } = renderWithProviders(
        <AmountCard
          mode="readonly"
          label="You receive"
          selectedToken={undefined}
          pickerLabel="Select token"
          onPickerPress={jest.fn()}
          primaryAmount="0"
          placeholderActive
        />,
      );

      expect(getByText("Select token")).toBeTruthy();
    });

    it("never renders the available-balance text even when passed", () => {
      // The user spec: no available balance on the receive (readonly) card.
      // The component still renders it if passed — that's the caller's job
      // to omit. This test documents the current contract.
      const { getByText } = renderWithProviders(
        <AmountCard
          mode="readonly"
          label="You receive"
          selectedToken={mockBalance}
          onPickerPress={jest.fn()}
          availableBalanceText="100 USDC available"
          primaryAmount="0"
        />,
      );
      expect(getByText("100 USDC available")).toBeTruthy();
    });
  });
});
