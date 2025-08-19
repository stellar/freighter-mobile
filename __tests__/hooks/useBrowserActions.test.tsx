import { renderHook } from "@testing-library/react-hooks";
import { logger } from "config/logger";
import { useBrowserTabsStore } from "ducks/browserTabs";
import { isHomepageUrl } from "helpers/browser";
import useAppTranslation from "hooks/useAppTranslation";
import { useBrowserActions } from "hooks/useBrowserActions";
import { Share, Linking, Platform } from "react-native";

// Mock dependencies
jest.mock("config/logger");
jest.mock("ducks/browserTabs");
jest.mock("helpers/browser", () => ({
  isHomepageUrl: jest.fn(),
  normalizeUrl: jest.fn((input: string) => ({
    url: `https://${input}`,
    isSearch: false,
  })),
}));
jest.mock("helpers/device", () => ({
  isIOS: false,
}));
jest.mock("hooks/useAppTranslation");
jest.mock("react-native", () => ({
  Share: {
    share: jest.fn(),
  },
  Linking: {
    openURL: jest.fn(),
  },
  Platform: {
    select: jest.fn(),
  },
}));

const mockLogger = logger as jest.Mocked<typeof logger>;
const mockUseBrowserTabsStore = useBrowserTabsStore as jest.MockedFunction<
  typeof useBrowserTabsStore
>;
const mockIsHomepageUrl = isHomepageUrl as jest.MockedFunction<
  typeof isHomepageUrl
>;

const mockUseAppTranslation = useAppTranslation as jest.MockedFunction<
  typeof useAppTranslation
>;
const mockShare = Share as jest.Mocked<typeof Share>;
const mockLinking = Linking as jest.Mocked<typeof Linking>;

describe("useBrowserActions", () => {
  const mockWebViewRef = {
    current: {
      goBack: jest.fn(),
      goForward: jest.fn(),
      reload: jest.fn(),
    },
  } as any;

  const mockTab = {
    id: "tab-123",
    url: "https://example.com",
    title: "Example Page",
    canGoBack: true,
    canGoForward: false,
    lastAccessed: 1234567890,
  };

  const mockStore = {
    activeTabId: "tab-123",
    goToPage: jest.fn(),
    closeTab: jest.fn(),
    closeAllTabs: jest.fn(),
    getActiveTab: jest.fn().mockReturnValue(mockTab),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseBrowserTabsStore.mockReturnValue(mockStore as any);
    mockUseAppTranslation.mockReturnValue({
      t: jest.fn((key: string) => key),
    } as any);
    mockIsHomepageUrl.mockReturnValue(false);

    (Platform.select as any).mockImplementation(
      (obj: any) => obj.android || obj.ios || obj.default,
    );
  });

  describe("handleUrlSubmit", () => {
    it("should call goToPage with normalized URL", () => {
      const { result } = renderHook(() => useBrowserActions(mockWebViewRef));

      result.current.handleUrlSubmit("example.com");

      expect(mockStore.goToPage).toHaveBeenCalledWith(
        "tab-123",
        "https://example.com",
      );
    });

    it("should not call goToPage when no active tab", () => {
      mockUseBrowserTabsStore.mockReturnValue({
        ...mockStore,
        activeTabId: null,
      } as any);

      const { result } = renderHook(() => useBrowserActions(mockWebViewRef));

      result.current.handleUrlSubmit("example.com");

      expect(mockStore.goToPage).not.toHaveBeenCalled();
    });
  });

  describe("handleGoBack", () => {
    it("should call goBack when canGoBack is true", () => {
      const { result } = renderHook(() => useBrowserActions(mockWebViewRef));

      result.current.handleGoBack();

      expect(mockWebViewRef.current?.goBack).toHaveBeenCalled();
    });

    it("should not call goBack when canGoBack is false", () => {
      mockUseBrowserTabsStore.mockReturnValue({
        ...mockStore,
        getActiveTab: jest
          .fn()
          .mockReturnValue({ ...mockTab, canGoBack: false }),
      } as any);

      const { result } = renderHook(() => useBrowserActions(mockWebViewRef));

      result.current.handleGoBack();

      expect(mockWebViewRef.current?.goBack).not.toHaveBeenCalled();
    });
  });

  describe("handleGoForward", () => {
    it("should call goForward when canGoForward is true", () => {
      mockUseBrowserTabsStore.mockReturnValue({
        ...mockStore,
        getActiveTab: jest
          .fn()
          .mockReturnValue({ ...mockTab, canGoForward: true }),
      } as any);

      const { result } = renderHook(() => useBrowserActions(mockWebViewRef));

      result.current.handleGoForward();

      expect(mockWebViewRef.current?.goForward).toHaveBeenCalled();
    });

    it("should not call goForward when canGoForward is false", () => {
      const { result } = renderHook(() => useBrowserActions(mockWebViewRef));

      result.current.handleGoForward();

      expect(mockWebViewRef.current?.goForward).not.toHaveBeenCalled();
    });
  });

  describe("handleReload", () => {
    it("should call reload", () => {
      const { result } = renderHook(() => useBrowserActions(mockWebViewRef));

      result.current.handleReload();

      expect(mockWebViewRef.current?.reload).toHaveBeenCalled();
    });
  });

  describe("handleCloseActiveTab", () => {
    it("should call closeTab with active tab ID", () => {
      const { result } = renderHook(() => useBrowserActions(mockWebViewRef));

      result.current.handleCloseActiveTab();

      expect(mockStore.closeTab).toHaveBeenCalledWith("tab-123");
    });

    it("should not call closeTab when no active tab", () => {
      mockUseBrowserTabsStore.mockReturnValue({
        ...mockStore,
        activeTabId: null,
      } as any);

      const { result } = renderHook(() => useBrowserActions(mockWebViewRef));

      result.current.handleCloseActiveTab();

      expect(mockStore.closeTab).not.toHaveBeenCalled();
    });
  });

  describe("handleCloseAllTabs", () => {
    it("should call closeAllTabs", () => {
      const { result } = renderHook(() => useBrowserActions(mockWebViewRef));

      result.current.handleCloseAllTabs();

      expect(mockStore.closeAllTabs).toHaveBeenCalled();
    });
  });

  describe("handleShare", () => {
    it("should call Share.share with tab info", async () => {
      mockShare.share.mockResolvedValue({ action: "sharedAction" });

      const { result } = renderHook(() => useBrowserActions(mockWebViewRef));

      await result.current.handleShare();

      expect(mockShare.share).toHaveBeenCalledWith({
        message: "Example Page\nhttps://example.com",
        url: "https://example.com",
      });
    });

    it("should handle share errors", async () => {
      const error = new Error("Share error");
      mockShare.share.mockRejectedValue(error);

      const { result } = renderHook(() => useBrowserActions(mockWebViewRef));

      await result.current.handleShare();

      expect(mockLogger.error).toHaveBeenCalledWith(
        "useBrowserActions",
        "Failed to share:",
        error,
      );
    });
  });

  describe("handleOpenInBrowser", () => {
    it("should call Linking.openURL with tab URL", async () => {
      mockLinking.openURL.mockResolvedValue(true);

      const { result } = renderHook(() => useBrowserActions(mockWebViewRef));

      await result.current.handleOpenInBrowser();

      expect(mockLinking.openURL).toHaveBeenCalledWith("https://example.com");
    });

    it("should handle openURL errors", async () => {
      const error = new Error("OpenURL error");
      mockLinking.openURL.mockRejectedValue(error);

      const { result } = renderHook(() => useBrowserActions(mockWebViewRef));

      await result.current.handleOpenInBrowser();

      expect(mockLogger.error).toHaveBeenCalledWith(
        "useBrowserActions",
        "Failed to open in browser:",
        error,
      );
    });
  });

  describe("contextMenuActions", () => {
    it("should return homepage actions when on homepage", () => {
      mockIsHomepageUrl.mockReturnValue(true);

      const { result } = renderHook(() => useBrowserActions(mockWebViewRef));

      const actions = result.current.contextMenuActions;
      expect(actions).toHaveLength(2);
      // The order might be different due to iOS/Android platform differences
      expect(actions.map((a) => a.title)).toContain("discovery.closeAllTabs");
      expect(actions.map((a) => a.title)).toContain("discovery.closeThisTab");
    });

    it("should return all actions when not on homepage", () => {
      mockIsHomepageUrl.mockReturnValue(false);

      const { result } = renderHook(() => useBrowserActions(mockWebViewRef));

      const actions = result.current.contextMenuActions;
      expect(actions).toHaveLength(5);
      // The order might be different due to iOS/Android platform differences
      expect(actions.map((a) => a.title)).toContain("discovery.reload");
      expect(actions.map((a) => a.title)).toContain("discovery.share");
      expect(actions.map((a) => a.title)).toContain("discovery.openInBrowser");
      expect(actions.map((a) => a.title)).toContain("discovery.closeAllTabs");
      expect(actions.map((a) => a.title)).toContain("discovery.closeThisTab");
    });

    it("should mark destructive actions correctly", () => {
      mockIsHomepageUrl.mockReturnValue(false);

      const { result } = renderHook(() => useBrowserActions(mockWebViewRef));

      const actions = result.current.contextMenuActions;
      const closeAllAction = actions.find(
        (a) => a.title === "discovery.closeAllTabs",
      );

      expect(closeAllAction?.destructive).toBe(true);
    });
  });
});
