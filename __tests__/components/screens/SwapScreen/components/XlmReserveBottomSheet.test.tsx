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

describe("XlmReserveBottomSheet", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders all four affordances", () => {
    const { getByText } = renderWithProviders(
      <XlmReserveBottomSheet publicKey={TEST_PUBLIC_KEY} />,
    );
    expect(getByText(/Swap to XLM/i)).toBeTruthy();
    expect(getByText(/Copy wallet address/i)).toBeTruthy();
    expect(getByText(/Why do I need XLM\?/i)).toBeTruthy();
    expect(getByText(/Cancel/i)).toBeTruthy();
  });

  it("'Swap to XLM' dispatches XLM descriptor and dismisses", () => {
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
        bottomSheetModalRef={ref}
      />,
    );
    fireEvent.press(getByText(/Swap to XLM/i));
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

  it("'Copy wallet address' calls copyToClipboard with the publicKey", () => {
    const { getByText } = renderWithProviders(
      <XlmReserveBottomSheet publicKey={TEST_PUBLIC_KEY} />,
    );
    fireEvent.press(getByText(/Copy wallet address/i));
    expect(mockCopyToClipboard).toHaveBeenCalledWith(
      TEST_PUBLIC_KEY,
      expect.any(Object),
    );
  });

  it("'Why do I need XLM?' opens the help article URL in the in-app browser", () => {
    const { getByText } = renderWithProviders(
      <XlmReserveBottomSheet publicKey={TEST_PUBLIC_KEY} />,
    );
    fireEvent.press(getByText(/Why do I need XLM\?/i));
    expect(mockOpenInAppBrowser).toHaveBeenCalledWith(
      "https://help.freighter.app/article/xjlva9dxov-how-much-xlm-do-i-need-in-my-wallet",
    );
  });

  it("hides 'Swap to XLM' when the source token is already XLM (prevents source==destination dead-end)", () => {
    // Force sourceTokenId to native so the guard fires.
    useSwapStore.setState({ sourceTokenId: "native" } as any);
    const { queryByText, getByText } = renderWithProviders(
      <XlmReserveBottomSheet publicKey={TEST_PUBLIC_KEY} />,
    );
    expect(queryByText(/Swap to XLM/i)).toBeNull();
    // The other affordances still show — "Copy wallet address" gets promoted
    // to primary so the user has a clear next action.
    expect(getByText(/Copy wallet address/i)).toBeTruthy();
    expect(getByText(/Cancel/i)).toBeTruthy();
  });

  it("does NOT fire SWAP_XLM_RESERVE_INSUFFICIENT_SHOWN on mount (tracking moved to call site)", () => {
    // The analytics event was moved from this component's useEffect to the
    // present() call site in SwapAmountScreen so it fires only when the user
    // actually sees the sheet, not on initial screen mount.
    jest.spyOn(analytics, "track").mockClear();
    renderWithProviders(<XlmReserveBottomSheet publicKey={TEST_PUBLIC_KEY} />);
    expect(analytics.track).not.toHaveBeenCalledWith(
      AnalyticsEvent.SWAP_XLM_RESERVE_INSUFFICIENT_SHOWN,
    );
  });
});
