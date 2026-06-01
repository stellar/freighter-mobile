import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { fireEvent, waitFor } from "@testing-library/react-native";
import { XlmReserveBottomSheet } from "components/screens/SwapScreen/components/XlmReserveBottomSheet";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

const mockCopyToClipboard = jest.fn();
const mockOpenInAppBrowser = jest.fn();

jest.mock("hooks/useClipboard", () => ({
  useClipboard: () => ({
    copyToClipboard: mockCopyToClipboard,
  }),
}));

jest.mock("hooks/useInAppBrowser", () => ({
  useInAppBrowser: () => ({
    open: mockOpenInAppBrowser,
  }),
}));

const TEST_PUBLIC_KEY =
  "GAZAJVMMEWVIQRP6RXQYTVAITE7SC2CBHALQTVW2N4DYBYPWZUH5VJGG";

describe("XlmReserveBottomSheet (Figma 11821-35684)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the redesigned content: title, info card, swap CTA when offered, copy-address CTA", () => {
    const { getByText, getByTestId } = renderWithProviders(
      <XlmReserveBottomSheet
        publicKey={TEST_PUBLIC_KEY}
        tokenCode="AQUA"
        canOfferSwapToXlm
        onSwapForXlm={jest.fn()}
      />,
    );
    expect(getByText(/You need XLM to create a trustline/i)).toBeTruthy();
    expect(getByText(/0\.5 XLM required/i)).toBeTruthy();
    expect(getByTestId("xlm-reserve-swap-button")).toBeTruthy();
    expect(getByText(/Copy my wallet address/i)).toBeTruthy();
    expect(getByTestId("xlm-reserve-why-link")).toBeTruthy();
    expect(getByTestId("xlm-reserve-close")).toBeTruthy();
  });

  it("interpolates the destination tokenCode into the body and info-card body", () => {
    const { getByText } = renderWithProviders(
      <XlmReserveBottomSheet
        publicKey={TEST_PUBLIC_KEY}
        tokenCode="AQUA"
        canOfferSwapToXlm
        onSwapForXlm={jest.fn()}
      />,
    );
    expect(getByText(/To receive AQUA/i)).toBeTruthy();
    expect(getByText(/to add AQUA/i)).toBeTruthy();
  });

  it("'Swap for 0.5 XLM' invokes the onSwapForXlm callback (parent owns the orchestration)", async () => {
    const onSwapForXlm = jest.fn().mockResolvedValue(undefined);
    const { getByTestId } = renderWithProviders(
      <XlmReserveBottomSheet
        publicKey={TEST_PUBLIC_KEY}
        tokenCode="AQUA"
        canOfferSwapToXlm
        onSwapForXlm={onSwapForXlm}
      />,
    );
    fireEvent.press(getByTestId("xlm-reserve-swap-button"));
    await waitFor(() => expect(onSwapForXlm).toHaveBeenCalledTimes(1));
  });

  it("'Copy my wallet address' calls copyToClipboard with the publicKey", () => {
    const { getByText } = renderWithProviders(
      <XlmReserveBottomSheet
        publicKey={TEST_PUBLIC_KEY}
        canOfferSwapToXlm
        onSwapForXlm={jest.fn()}
      />,
    );
    fireEvent.press(getByText(/Copy my wallet address/i));
    expect(mockCopyToClipboard).toHaveBeenCalledWith(
      TEST_PUBLIC_KEY,
      expect.any(Object),
    );
  });

  it("inline 'Why do I need XLM?' link opens the help article in the in-app browser", () => {
    const { getByTestId } = renderWithProviders(
      <XlmReserveBottomSheet
        publicKey={TEST_PUBLIC_KEY}
        canOfferSwapToXlm
        onSwapForXlm={jest.fn()}
      />,
    );
    fireEvent.press(getByTestId("xlm-reserve-why-link"));
    expect(mockOpenInAppBrowser).toHaveBeenCalledWith(
      "https://help.freighter.app/article/xjlva9dxov-how-much-xlm-do-i-need-in-my-wallet",
    );
  });

  it("top-right X close button dismisses the sheet", () => {
    const dismissMock = jest.fn();
    const ref = React.createRef<BottomSheetModal>();
    Object.defineProperty(ref, "current", {
      value: { dismiss: dismissMock },
      writable: true,
    });

    const { getByTestId } = renderWithProviders(
      <XlmReserveBottomSheet
        publicKey={TEST_PUBLIC_KEY}
        bottomSheetModalRef={ref}
        canOfferSwapToXlm
        onSwapForXlm={jest.fn()}
      />,
    );
    fireEvent.press(getByTestId("xlm-reserve-close"));
    expect(dismissMock).toHaveBeenCalled();
  });

  it("hides the swap-for-XLM button when canOfferSwapToXlm is false (no non-XLM classic balances)", () => {
    const { queryByTestId, getByText } = renderWithProviders(
      <XlmReserveBottomSheet
        publicKey={TEST_PUBLIC_KEY}
        canOfferSwapToXlm={false}
      />,
    );
    expect(queryByTestId("xlm-reserve-swap-button")).toBeNull();
    // Copy-address remains as the only remaining CTA.
    expect(getByText(/Copy my wallet address/i)).toBeTruthy();
  });

  it("debounces double-taps on the swap button (in-flight callback not re-invoked)", async () => {
    let resolveSwap: () => void = () => undefined;
    const onSwapForXlm = jest.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSwap = resolve;
        }),
    );
    const { getByTestId } = renderWithProviders(
      <XlmReserveBottomSheet
        publicKey={TEST_PUBLIC_KEY}
        canOfferSwapToXlm
        onSwapForXlm={onSwapForXlm}
      />,
    );

    fireEvent.press(getByTestId("xlm-reserve-swap-button"));
    fireEvent.press(getByTestId("xlm-reserve-swap-button"));
    fireEvent.press(getByTestId("xlm-reserve-swap-button"));

    expect(onSwapForXlm).toHaveBeenCalledTimes(1);
    resolveSwap();
    await waitFor(() => undefined);
  });
});
