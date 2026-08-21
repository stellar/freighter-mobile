import { fireEvent } from "@testing-library/react-native";
import { NotEnoughTokenBottomSheet } from "components/screens/EarnScreen/components/NotEnoughTokenBottomSheet";
import { NotEnoughVariant } from "components/screens/EarnScreen/helpers";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

const usdcToken = {
  code: "USDC",
  issuer: { key: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN" },
};

describe("NotEnoughTokenBottomSheet", () => {
  it("renders nothing when no token is resolved yet", () => {
    const { queryByTestId } = renderWithProviders(
      <NotEnoughTokenBottomSheet
        variant={NotEnoughVariant.TRANSFER_ONLY}
        tokenCode="USDC"
        onBuy={jest.fn()}
        onSwap={jest.fn()}
        onReceive={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(queryByTestId("not-enough-token-bottom-sheet")).toBeNull();
  });

  it("renders the shared title for every variant", () => {
    const { getByText } = renderWithProviders(
      <NotEnoughTokenBottomSheet
        variant={NotEnoughVariant.TRANSFER_ONLY}
        tokenCode="USDC"
        token={usdcToken}
        onBuy={jest.fn()}
        onSwap={jest.fn()}
        onReceive={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(getByText("Not enough USDC")).toBeTruthy();
  });

  it("closes via the close control", () => {
    const onClose = jest.fn();
    const { getByTestId } = renderWithProviders(
      <NotEnoughTokenBottomSheet
        variant={NotEnoughVariant.TRANSFER_ONLY}
        tokenCode="USDC"
        token={usdcToken}
        onBuy={jest.fn()}
        onSwap={jest.fn()}
        onReceive={jest.fn()}
        onClose={onClose}
      />,
    );
    fireEvent.press(getByTestId("not-enough-token-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  describe("BUY_SWAP_OR_TRANSFER (design node 9457:46345)", () => {
    it("renders Buy/Swap side by side and 'Transfer from another account' as a link, each wired to its own handler", () => {
      const onBuy = jest.fn();
      const onSwap = jest.fn();
      const onReceive = jest.fn();
      const { getByTestId, getByText, queryByTestId } = renderWithProviders(
        <NotEnoughTokenBottomSheet
          variant={NotEnoughVariant.BUY_SWAP_OR_TRANSFER}
          tokenCode="USDC"
          token={usdcToken}
          onBuy={onBuy}
          onSwap={onSwap}
          onReceive={onReceive}
          onClose={jest.fn()}
        />,
      );

      expect(getByText("Buy USDC")).toBeTruthy();
      expect(getByText("Swap for USDC")).toBeTruthy();
      expect(getByText("or")).toBeTruthy();
      // Not a button in this variant -- there is no secondary/outlined
      // "Transfer" button, only the centred text link.
      expect(queryByTestId("not-enough-token-receive-button")).toBeNull();

      fireEvent.press(getByTestId("not-enough-token-buy-button"));
      fireEvent.press(getByTestId("not-enough-token-swap-button"));
      fireEvent.press(getByTestId("not-enough-token-receive-link"));

      expect(onBuy).toHaveBeenCalledTimes(1);
      expect(onSwap).toHaveBeenCalledTimes(1);
      expect(onReceive).toHaveBeenCalledTimes(1);
    });
  });

  describe("BUY_OR_TRANSFER (design node 9457:46399)", () => {
    it("renders 'Buy with Coinbase' (not 'Buy USDC') stacked above 'Transfer from another account'", () => {
      const onBuy = jest.fn();
      const onReceive = jest.fn();
      const { getByTestId, getByText, queryByText } = renderWithProviders(
        <NotEnoughTokenBottomSheet
          variant={NotEnoughVariant.BUY_OR_TRANSFER}
          tokenCode="USDC"
          token={usdcToken}
          onBuy={onBuy}
          onSwap={jest.fn()}
          onReceive={onReceive}
          onClose={jest.fn()}
        />,
      );

      expect(getByText("Buy with Coinbase")).toBeTruthy();
      expect(getByText("Transfer from another account")).toBeTruthy();
      expect(queryByText("Buy USDC")).toBeNull();

      fireEvent.press(getByTestId("not-enough-token-buy-button"));
      fireEvent.press(getByTestId("not-enough-token-receive-button"));

      expect(onBuy).toHaveBeenCalledTimes(1);
      expect(onReceive).toHaveBeenCalledTimes(1);
    });
  });

  describe("SWAP_OR_TRANSFER (design node 9457:42846)", () => {
    it("renders 'Swap for {code}' stacked above 'Transfer from another account'", () => {
      const onSwap = jest.fn();
      const onReceive = jest.fn();
      const { getByTestId, getByText } = renderWithProviders(
        <NotEnoughTokenBottomSheet
          variant={NotEnoughVariant.SWAP_OR_TRANSFER}
          tokenCode="EURC"
          token={{ ...usdcToken, code: "EURC" }}
          onBuy={jest.fn()}
          onSwap={onSwap}
          onReceive={onReceive}
          onClose={jest.fn()}
        />,
      );

      expect(getByText("Swap for EURC")).toBeTruthy();
      expect(getByText("Transfer from another account")).toBeTruthy();

      fireEvent.press(getByTestId("not-enough-token-swap-button"));
      fireEvent.press(getByTestId("not-enough-token-receive-button"));

      expect(onSwap).toHaveBeenCalledTimes(1);
      expect(onReceive).toHaveBeenCalledTimes(1);
    });
  });

  describe("TRANSFER_ONLY (design node 9457:46530)", () => {
    it("renders a single 'Transfer from another account' button", () => {
      const onReceive = jest.fn();
      const { getByTestId, getByText, queryByTestId } = renderWithProviders(
        <NotEnoughTokenBottomSheet
          variant={NotEnoughVariant.TRANSFER_ONLY}
          tokenCode="EURC"
          token={{ ...usdcToken, code: "EURC" }}
          onBuy={jest.fn()}
          onSwap={jest.fn()}
          onReceive={onReceive}
          onClose={jest.fn()}
        />,
      );

      expect(getByText("Transfer from another account")).toBeTruthy();
      expect(queryByTestId("not-enough-token-buy-button")).toBeNull();
      expect(queryByTestId("not-enough-token-swap-button")).toBeNull();

      fireEvent.press(getByTestId("not-enough-token-receive-button"));
      expect(onReceive).toHaveBeenCalledTimes(1);
    });
  });
});
