import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { fireEvent } from "@testing-library/react-native";
import { XlmReserveBottomSheet } from "components/screens/SwapScreen/components/XlmReserveBottomSheet";
import { AnalyticsEvent } from "config/analyticsConfig";
import { TokenTypeWithCustomToken } from "config/types";
import { useSwapStore } from "ducks/swap";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { analytics } from "services/analytics";

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
    // Reset store before each test so prior setState calls don't leak.
    useSwapStore.setState({
      sourceTokenId:
        "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    } as any);
  });

  it("renders the redesigned content: title, info card, primary CTA, and copy-address minimal CTA", () => {
    const { getByText, getByTestId } = renderWithProviders(
      <XlmReserveBottomSheet publicKey={TEST_PUBLIC_KEY} tokenCode="AQUA" />,
    );
    expect(getByText(/You need XLM to create a trustline/i)).toBeTruthy();
    expect(getByText(/0\.5 XLM required/i)).toBeTruthy();
    expect(getByText(/Swap for 0\.5 XLM/i)).toBeTruthy();
    expect(getByText(/Copy my wallet address/i)).toBeTruthy();
    // Inline "Why do I need XLM?" link
    expect(getByTestId("xlm-reserve-why-link")).toBeTruthy();
    // Top-right circular X close
    expect(getByTestId("xlm-reserve-close")).toBeTruthy();
  });

  it("interpolates the destination tokenCode into the body and info-card body", () => {
    const { getByText } = renderWithProviders(
      <XlmReserveBottomSheet publicKey={TEST_PUBLIC_KEY} tokenCode="AQUA" />,
    );
    // Body prefix: "To receive AQUA, your wallet needs a trustline on Stellar."
    expect(getByText(/To receive AQUA/i)).toBeTruthy();
    // Info card body: "Stellar requires this reserve to add AQUA. You can get
    // it back once your AQUA balance is zero."
    expect(getByText(/to add AQUA/i)).toBeTruthy();
  });

  it("'Swap for 0.5 XLM' dispatches XLM descriptor and dismisses", () => {
    const setDestSpy = jest.fn();
    useSwapStore.setState({ setDestinationToken: setDestSpy } as any);

    const dismissMock = jest.fn();
    const ref = React.createRef<BottomSheetModal>();
    Object.defineProperty(ref, "current", {
      value: { dismiss: dismissMock },
      writable: true,
    });

    const { getByText } = renderWithProviders(
      <XlmReserveBottomSheet
        publicKey={TEST_PUBLIC_KEY}
        tokenCode="AQUA"
        bottomSheetModalRef={ref}
      />,
    );
    fireEvent.press(getByText(/Swap for 0\.5 XLM/i));
    expect(setDestSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tokenCode: "XLM",
        id: "XLM",
        isNew: false,
        tokenType: TokenTypeWithCustomToken.NATIVE,
      }),
    );
    expect(dismissMock).toHaveBeenCalled();
  });

  it("'Copy my wallet address' calls copyToClipboard with the publicKey", () => {
    const { getByText } = renderWithProviders(
      <XlmReserveBottomSheet publicKey={TEST_PUBLIC_KEY} />,
    );
    fireEvent.press(getByText(/Copy my wallet address/i));
    expect(mockCopyToClipboard).toHaveBeenCalledWith(
      TEST_PUBLIC_KEY,
      expect.any(Object),
    );
  });

  it("inline 'Why do I need XLM?' link opens the help article in the in-app browser", () => {
    const { getByTestId } = renderWithProviders(
      <XlmReserveBottomSheet publicKey={TEST_PUBLIC_KEY} />,
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
      />,
    );
    fireEvent.press(getByTestId("xlm-reserve-close"));
    expect(dismissMock).toHaveBeenCalled();
  });

  it("hides 'Swap for 0.5 XLM' when the source token is already XLM", () => {
    useSwapStore.setState({ sourceTokenId: "native" } as any);
    const { queryByText, getByText } = renderWithProviders(
      <XlmReserveBottomSheet publicKey={TEST_PUBLIC_KEY} />,
    );
    expect(queryByText(/Swap for 0\.5 XLM/i)).toBeNull();
    // Copy-address remains as the only remaining CTA.
    expect(getByText(/Copy my wallet address/i)).toBeTruthy();
  });

  it("does NOT fire SWAP_XLM_RESERVE_INSUFFICIENT_SHOWN on mount (tracking lives at call site)", () => {
    jest.spyOn(analytics, "track").mockClear();
    renderWithProviders(<XlmReserveBottomSheet publicKey={TEST_PUBLIC_KEY} />);
    expect(analytics.track).not.toHaveBeenCalledWith(
      AnalyticsEvent.SWAP_XLM_RESERVE_INSUFFICIENT_SHOWN,
    );
  });
});
