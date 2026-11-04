import { fireEvent } from "@testing-library/react-native";
import MuxedAddressWarningBottomSheet from "components/MuxedAddressWarningBottomSheet";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

// The real en strings, through renderWithProviders, so each assertion reads
// the copy the user sees.
const MUXED_ACCOUNT_DESCRIPTION =
  "This token does not support muxed address (M-) as a target destination. Proceeding with this transaction could result in the loss of the token during the transfer.";
const MUXED_CONTRACT_DESCRIPTION =
  "This token does not support muxed contract address (W-) as a target destination.";
const TITLE = "Muxed address not supported";
const MEMO_TITLE = "Memo not supported";
const MEMO_DESCRIPTION =
  "This token can't be sent with a memo to this address.";
const COLLECTIBLE_MEMO_DESCRIPTION =
  "This collectible can't be sent with a memo to this address.";
const NUMERIC_MEMO_DESCRIPTION =
  "This token only accepts a numeric memo, from 0 to 18446744073709551615.";

describe("MuxedAddressWarningBottomSheet", () => {
  it("explains an M by default", () => {
    const { getByText, queryByText } = renderWithProviders(
      <MuxedAddressWarningBottomSheet onClose={jest.fn()} />,
    );

    expect(getByText(MUXED_ACCOUNT_DESCRIPTION)).toBeTruthy();
    expect(queryByText(/\(W-\)/)).toBeNull();
  });

  it("explains an M for variant account", () => {
    const { getByText, queryByText } = renderWithProviders(
      <MuxedAddressWarningBottomSheet variant="account" onClose={jest.fn()} />,
    );

    expect(getByText(MUXED_ACCOUNT_DESCRIPTION)).toBeTruthy();
    expect(queryByText(/\(W-\)/)).toBeNull();
  });

  it("explains a W for variant contract", () => {
    const { getByText, queryByText } = renderWithProviders(
      <MuxedAddressWarningBottomSheet variant="contract" onClose={jest.fn()} />,
    );

    expect(getByText(MUXED_CONTRACT_DESCRIPTION)).toBeTruthy();
    expect(queryByText(/\(M-\)/)).toBeNull();
  });

  it.each([undefined, "account", "contract"] as const)(
    "keeps the same title for variant %s",
    (variant) => {
      const { getByText } = renderWithProviders(
        <MuxedAddressWarningBottomSheet
          variant={variant}
          onClose={jest.fn()}
        />,
      );

      expect(getByText(TITLE)).toBeTruthy();
    },
  );

  it.each([
    ["memo", MEMO_DESCRIPTION],
    ["collectibleMemo", COLLECTIBLE_MEMO_DESCRIPTION],
    ["numericMemo", NUMERIC_MEMO_DESCRIPTION],
  ] as const)(
    "explains a memo that can't be sent for variant %s",
    (variant, description) => {
      const { getByText, queryByText } = renderWithProviders(
        <MuxedAddressWarningBottomSheet
          variant={variant}
          onClose={jest.fn()}
        />,
      );

      expect(getByText(MEMO_TITLE)).toBeTruthy();
      expect(getByText(description)).toBeTruthy();
      expect(queryByText(TITLE)).toBeNull();
    },
  );

  it("closes through the header's X", () => {
    const onClose = jest.fn();
    const { getByTestId } = renderWithProviders(
      <MuxedAddressWarningBottomSheet variant="contract" onClose={onClose} />,
    );

    fireEvent.press(getByTestId("muxed-address-warning-close-button"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
