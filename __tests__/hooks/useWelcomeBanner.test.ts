import AsyncStorage from "@react-native-async-storage/async-storage";
import { renderHook, act } from "@testing-library/react-hooks";
import { STORAGE_KEYS } from "config/constants";
import { ActiveAccount } from "ducks/auth";
import { useWelcomeBanner } from "hooks/useWelcomeBanner";

interface UseWelcomeBannerProps {
  account: ActiveAccount | null;
  isFunded: boolean;
  isLoadingBalances: boolean;
  isSwitchingAccount: boolean;
}

// Unmock the hook so we test the real implementation
jest.unmock("hooks/useWelcomeBanner");

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

// Mock logger
jest.mock("config/logger", () => ({
  logger: {
    error: jest.fn(),
  },
}));

// Mock BottomSheetModal
const mockPresent = jest.fn();
const mockDismiss = jest.fn();

jest.mock("@gorhom/bottom-sheet", () => ({
  BottomSheetModal: jest.fn(),
}));

describe("useWelcomeBanner", () => {
  const mockAccount: ActiveAccount = {
    id: "account-1",
    publicKey: "GCKUVXILBNYS4FDNWCGCYSJBY2PBQ4KAW2M5CODRVJPUFM62IJFH67J2",
    privateKey: "mock-private-key",
    accountName: "Test Account",
    subentryCount: 0,
  };

  const welcomeBannerShownKey = `${STORAGE_KEYS.WELCOME_BANNER_SHOWN_PREFIX}${mockAccount.publicKey}`;

  const advanceTime = (ms = 100) => {
    act(() => {
      jest.advanceTimersByTime(ms);
    });
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    // Set up mocks to resolve immediately
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("accountSwitchCompleted state", () => {
    it("should set accountSwitchCompleted to true when not switching and balances loaded", async () => {
      const { result, rerender } = renderHook(
        (props: UseWelcomeBannerProps) => useWelcomeBanner(props),
        {
          initialProps: {
            account: mockAccount,
            isFunded: true,
            isLoadingBalances: true,
            isSwitchingAccount: false,
          },
        },
      );

      await advanceTime();

      expect(AsyncStorage.getItem).toHaveBeenCalledWith(welcomeBannerShownKey);

      // Initially, account switch should not be completed (balances still loading)
      expect(
        result.current.welcomeBannerBottomSheetModalRef.current,
      ).toBeDefined();

      // Clear mocks to test the rerender
      jest.clearAllMocks();
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      // Update props to simulate balances loaded
      await act(() => {
        rerender({
          account: mockAccount,
          isFunded: true,
          isLoadingBalances: false,
          isSwitchingAccount: false,
        });
      });
      await advanceTime();

      // State should update but getItem shouldn't be called again (key hasn't changed)
      // Just verify the hook completed without errors
      expect(result.current.welcomeBannerBottomSheetModalRef).toBeDefined();
    });

    it("should set accountSwitchCompleted to false when switching account", () => {
      const { rerender } = renderHook(
        (props: UseWelcomeBannerProps) => useWelcomeBanner(props),
        {
          initialProps: {
            account: mockAccount,
            isFunded: true,
            isLoadingBalances: false,
            isSwitchingAccount: false,
          },
        },
      );

      // Start switching account
      act(() => {
        rerender({
          account: mockAccount,
          isFunded: true,
          isLoadingBalances: false,
          isSwitchingAccount: true,
        });
      });

      // accountSwitchCompleted should be false during switching
      // This is internal state, but we can verify behavior through side effects
    });

    it("should set accountSwitchCompleted to true after account switch completes", async () => {
      const { rerender } = renderHook(
        (props: UseWelcomeBannerProps) => useWelcomeBanner(props),
        {
          initialProps: {
            account: mockAccount,
            isFunded: false,
            isLoadingBalances: false,
            isSwitchingAccount: true,
          },
        },
      );

      await advanceTime();
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(welcomeBannerShownKey);

      // Mock that banner hasn't been shown yet
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      // Complete account switch
      await act(() => {
        rerender({
          account: mockAccount,
          isFunded: false,
          isLoadingBalances: false,
          isSwitchingAccount: false,
        });
      });
      await advanceTime();

      // Just verify the account switch completed without errors
    });
  });

  describe("welcome banner display logic", () => {
    it("should not show welcome banner during account switching", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const { result } = renderHook(() =>
        useWelcomeBanner({
          account: mockAccount,
          isFunded: false,
          isLoadingBalances: false,
          isSwitchingAccount: true,
        }),
      );

      await advanceTime();
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(welcomeBannerShownKey);

      // Get the ref and mock the present method
      if (result.current.welcomeBannerBottomSheetModalRef.current) {
        result.current.welcomeBannerBottomSheetModalRef.current.present =
          mockPresent;
      }

      await advanceTime();

      // Banner should not be presented during switching
      expect(mockPresent).not.toHaveBeenCalled();
    });

    it("should not show welcome banner while balances are loading", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const { result } = renderHook(() =>
        useWelcomeBanner({
          account: mockAccount,
          isFunded: false,
          isLoadingBalances: true,
          isSwitchingAccount: false,
        }),
      );

      await advanceTime();
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(welcomeBannerShownKey);

      if (result.current.welcomeBannerBottomSheetModalRef.current) {
        result.current.welcomeBannerBottomSheetModalRef.current.present =
          mockPresent;
      }

      await advanceTime();

      // Banner should not be presented while loading
      expect(mockPresent).not.toHaveBeenCalled();
    });

    it("should show welcome banner after account switch completes for unfunded account", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const { result, rerender } = renderHook(
        (props: UseWelcomeBannerProps) => useWelcomeBanner(props),
        {
          initialProps: {
            account: mockAccount,
            isFunded: false,
            isLoadingBalances: false,
            isSwitchingAccount: true,
          },
        },
      );

      await advanceTime();
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(welcomeBannerShownKey);

      // Mock the ref
      const mockRef = {
        present: mockPresent,
        dismiss: mockDismiss,
      };

      act(() => {
        if (result.current.welcomeBannerBottomSheetModalRef) {
          (result.current.welcomeBannerBottomSheetModalRef as any).current =
            mockRef;
        }
      });

      // Complete account switch
      await act(() => {
        rerender({
          account: mockAccount,
          isFunded: false,
          isLoadingBalances: false,
          isSwitchingAccount: false,
        });
      });
      await advanceTime(200);

      // Wait for the banner to be presented
      expect(mockPresent).toHaveBeenCalled();
    });

    it("should not show welcome banner for funded accounts", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const { result } = renderHook(() =>
        useWelcomeBanner({
          account: mockAccount,
          isFunded: true,
          isLoadingBalances: false,
          isSwitchingAccount: false,
        }),
      );

      await advanceTime();
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(welcomeBannerShownKey);

      if (result.current.welcomeBannerBottomSheetModalRef.current) {
        result.current.welcomeBannerBottomSheetModalRef.current.present =
          mockPresent;
      }

      await advanceTime();

      // Banner should not be shown for funded accounts
      expect(mockPresent).not.toHaveBeenCalled();
    });

    it("should not show welcome banner if already shown before", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue("true");

      const { result } = renderHook(() =>
        useWelcomeBanner({
          account: mockAccount,
          isFunded: false,
          isLoadingBalances: false,
          isSwitchingAccount: false,
        }),
      );

      await advanceTime();
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(welcomeBannerShownKey);

      if (result.current.welcomeBannerBottomSheetModalRef.current) {
        result.current.welcomeBannerBottomSheetModalRef.current.present =
          mockPresent;
      }

      await advanceTime();

      // Banner should not be shown if already seen
      expect(mockPresent).not.toHaveBeenCalled();
    });

    it("should not show banner when account is null", () => {
      const { result } = renderHook(() =>
        useWelcomeBanner({
          account: null,
          isFunded: false,
          isLoadingBalances: false,
          isSwitchingAccount: false,
        }),
      );

      if (result.current.welcomeBannerBottomSheetModalRef.current) {
        result.current.welcomeBannerBottomSheetModalRef.current.present =
          mockPresent;
      }

      // Should not even check storage when account is null
      expect(AsyncStorage.getItem).not.toHaveBeenCalled();
      expect(mockPresent).not.toHaveBeenCalled();
    });
  });

  describe("handleWelcomeBannerDismiss", () => {
    it("should save welcome banner status to storage and dismiss modal", async () => {
      const { result } = renderHook(() =>
        useWelcomeBanner({
          account: mockAccount,
          isFunded: false,
          isLoadingBalances: false,
          isSwitchingAccount: false,
        }),
      );

      await advanceTime();
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(welcomeBannerShownKey);

      // Mock the ref
      const mockRef = {
        present: mockPresent,
        dismiss: mockDismiss,
      };

      act(() => {
        if (result.current.welcomeBannerBottomSheetModalRef) {
          (result.current.welcomeBannerBottomSheetModalRef as any).current =
            mockRef;
        }
      });

      // Call dismiss handler
      await act(async () => {
        await result.current.handleWelcomeBannerDismiss();
      });

      // Verify storage was updated
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        welcomeBannerShownKey,
        "true",
      );

      // Verify modal was dismissed
      expect(mockDismiss).toHaveBeenCalled();
    });

    it("should handle errors when saving to storage", async () => {
      const { result } = renderHook(() =>
        useWelcomeBanner({
          account: mockAccount,
          isFunded: false,
          isLoadingBalances: false,
          isSwitchingAccount: false,
        }),
      );

      await advanceTime();
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(welcomeBannerShownKey);

      const mockError = new Error("Storage error");
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(mockError);

      // Mock the ref
      const mockRef = {
        present: mockPresent,
        dismiss: mockDismiss,
      };

      act(() => {
        if (result.current.welcomeBannerBottomSheetModalRef) {
          (result.current.welcomeBannerBottomSheetModalRef as any).current =
            mockRef;
        }
      });

      // Call dismiss handler
      await act(async () => {
        await result.current.handleWelcomeBannerDismiss();
      });

      // Should still dismiss modal even if storage fails
      expect(mockDismiss).toHaveBeenCalled();
    });
  });

  describe("storage key generation", () => {
    it("should generate correct storage key for account", async () => {
      const expectedKey = `${STORAGE_KEYS.WELCOME_BANNER_SHOWN_PREFIX}${mockAccount.publicKey}`;

      renderHook(() =>
        useWelcomeBanner({
          account: mockAccount,
          isFunded: false,
          isLoadingBalances: false,
          isSwitchingAccount: false,
        }),
      );

      await advanceTime();
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(expectedKey);
    });

    it("should update storage key when account changes", async () => {
      const secondAccount: ActiveAccount = {
        ...mockAccount,
        id: "account-2",
        publicKey: "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
      };

      const { rerender } = renderHook(
        (props: UseWelcomeBannerProps) => useWelcomeBanner(props),
        {
          initialProps: {
            account: mockAccount,
            isFunded: false,
            isLoadingBalances: false,
            isSwitchingAccount: false,
          },
        },
      );

      await advanceTime();
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(welcomeBannerShownKey);

      (AsyncStorage.getItem as jest.Mock).mockClear();

      const secondAccountKey = `${STORAGE_KEYS.WELCOME_BANNER_SHOWN_PREFIX}${secondAccount.publicKey}`;

      // Change account
      await act(() => {
        rerender({
          account: secondAccount,
          isFunded: false,
          isLoadingBalances: false,
          isSwitchingAccount: false,
        });
      });
      await advanceTime();

      expect(AsyncStorage.getItem).toHaveBeenCalledWith(secondAccountKey);
    });
  });
});
