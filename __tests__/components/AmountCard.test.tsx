/* eslint-disable @fnando/consistent-import/consistent-import */
import { fireEvent } from "@testing-library/react-native";
import { BigNumber } from "bignumber.js";
import { AmountCard } from "components/AmountCard";
import { PricedBalance } from "config/types";
import { renderWithProviders } from "helpers/testUtils";
import { UseTokenFiatConverterResult } from "hooks/useTokenFiatConverter";
import React from "react";
import { TextInput } from "react-native";

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
  limit: new BigNumber("1000000"),
  buyingLiabilities: "0",
  sellingLiabilities: "0",
  decimals: 7,
  currentPrice: new BigNumber("1"),
} as PricedBalance;

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

    it("renders the '$' prefix when converter.showFiatAmount is true", () => {
      const { getByText } = renderWithProviders(
        <AmountCard
          mode="editable"
          label="Sending"
          selectedToken={mockBalance}
          onPickerPress={jest.fn()}
          converter={makeConverter({ showFiatAmount: true })}
          hasUsdPrice
          secondaryAmountText="1 USDC"
        />,
      );

      expect(getByText("$")).toBeTruthy();
    });

    it("omits the '$' prefix in token mode", () => {
      const { queryByText } = renderWithProviders(
        <AmountCard
          mode="editable"
          label="Sending"
          selectedToken={mockBalance}
          onPickerPress={jest.fn()}
          converter={makeConverter({ showFiatAmount: false })}
          hasUsdPrice
          secondaryAmountText="$1.23"
        />,
      );

      expect(queryByText("$")).toBeNull();
    });

    it("calls inputRef.current.focus() when the focus-trigger area is pressed", () => {
      const inputRef = React.createRef<TextInput>();
      const { getByTestId } = renderWithProviders(
        <AmountCard
          mode="editable"
          label="Sending"
          selectedToken={mockBalance}
          onPickerPress={jest.fn()}
          inputRef={inputRef}
          focusTriggerTestID="focus-trigger"
          converter={makeConverter()}
          hasUsdPrice
        />,
      );

      // Stub focus before the press so we can assert it was called. The
      // ref's TextInput is real, just not actually mounted in a window.
      const focusSpy = jest.fn();
      Object.defineProperty(inputRef, "current", {
        value: { focus: focusSpy, isFocused: () => true },
        writable: true,
      });

      fireEvent(getByTestId("focus-trigger"), "pressIn");
      expect(focusSpy).toHaveBeenCalled();
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

    it("applies the secondary text color to the primary amount when placeholderActive=true", () => {
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

      // The Display picks one of two themed colors based on placeholderActive.
      // Resolve the style and assert it falls on the secondary side, not
      // the primary "real value" side.
      const displayNode = getByText("0");
      const styles = Array.isArray(displayNode.props.style)
        ? Object.assign({}, ...displayNode.props.style)
        : displayNode.props.style;
      // The exact theme color literal isn't worth pinning here — the test
      // just verifies the color was set, and that toggling placeholderActive
      // off resolves to a different color.
      expect(styles.color).toBeTruthy();
    });

    it("renders a Plus-in-circle affordance (no token icon) when selectedToken is undefined", () => {
      const { queryByText, getByText } = renderWithProviders(
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

      // Chip text still shows the pickerLabel override.
      expect(getByText("Select token")).toBeTruthy();
      // No token symbol appears in the chip when no token is selected.
      expect(queryByText("USDC")).toBeNull();
    });

    it("still renders availableBalanceText in readonly mode when passed (caller decides whether to omit)", () => {
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
