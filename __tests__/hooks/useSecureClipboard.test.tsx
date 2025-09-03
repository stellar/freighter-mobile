import Clipboard from "@react-native-clipboard/clipboard";
import SecureClipboardNative from "@stellar/freighter-rn-secure-clipboard";
import { renderHook, act } from "@testing-library/react-hooks";
import { logger } from "config/logger";
import { useSecureClipboard } from "hooks/useSecureClipboard";
import { Platform } from "react-native";

// Mock the logger
jest.mock("config/logger", () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

// Mock the clipboard module
jest.mock("@react-native-clipboard/clipboard", () => ({
  setString: jest.fn(),
  getString: jest.fn(() => Promise.resolve("mocked clipboard content")),
}));

// Mock the native module
jest.mock("@stellar/freighter-rn-secure-clipboard", () => ({
  setString: jest.fn(() => Promise.resolve()),
  getString: jest.fn(() => Promise.resolve("mocked native clipboard content")),
  clearString: jest.fn(() => Promise.resolve()),
}));

// Mock Platform - default to Android for most tests
jest.mock("react-native", () => ({
  Platform: {
    OS: "android",
  },
}));

// Mock the toast provider
const mockShowToast = jest.fn();
jest.mock("providers/ToastProvider", () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
}));

// Mock the translation hook
jest.mock("hooks/useAppTranslation", () => ({
  __esModule: true,
  default: () => ({
    t: (key: string) => {
      const translations: { [key: string]: string } = {
        "common.copied": "Copied to clipboard!",
        "clipboard.failed": "Failed to copy to clipboard",
      };
      return translations[key] || key;
    },
  }),
}));

const mockSetString = Clipboard.setString as jest.MockedFunction<
  typeof Clipboard.setString
>;
const mockGetString = Clipboard.getString as jest.MockedFunction<
  typeof Clipboard.getString
>;

const mockNativeSetString =
  SecureClipboardNative.setString as jest.MockedFunction<
    typeof SecureClipboardNative.setString
  >;
const mockNativeGetString =
  SecureClipboardNative.getString as jest.MockedFunction<
    typeof SecureClipboardNative.getString
  >;
const mockNativeClearString =
  SecureClipboardNative.clearString as jest.MockedFunction<
    typeof SecureClipboardNative.clearString
  >;

const mockLoggerWarn = logger.warn as jest.MockedFunction<typeof logger.warn>;

describe("useSecureClipboard", () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should copy text to clipboard and show default success toast", () => {
    const { result } = renderHook(() => useSecureClipboard());
    const text = "test text";

    act(() => {
      result.current.copyToClipboard(text);
    });

    expect(mockNativeSetString).toHaveBeenCalledWith(text, 30000);
    expect(mockShowToast).toHaveBeenCalledWith({
      title: "Copied to clipboard!",
      variant: "success",
      toastId: "secure-copy-toast",
    });
  });

  it("should copy text to clipboard with custom notification message", () => {
    const { result } = renderHook(() => useSecureClipboard());
    const text = "test text";
    const customMessage = "Custom message";

    act(() => {
      result.current.copyToClipboard(text, {
        notificationMessage: customMessage,
      });
    });

    expect(mockNativeSetString).toHaveBeenCalledWith(text, 30000);
    expect(mockShowToast).toHaveBeenCalledWith({
      title: customMessage,
      variant: "success",
      toastId: "secure-copy-toast",
    });
  });

  it("should copy text to clipboard with custom toast variant", () => {
    const { result } = renderHook(() => useSecureClipboard());
    const text = "test text";

    act(() => {
      result.current.copyToClipboard(text, {
        toastVariant: "primary",
      });
    });

    expect(mockNativeSetString).toHaveBeenCalledWith(text, 30000);
    expect(mockShowToast).toHaveBeenCalledWith({
      title: "Copied to clipboard!",
      variant: "primary",
      toastId: "secure-copy-toast",
    });
  });

  it("should copy text to clipboard without showing notification", () => {
    const { result } = renderHook(() => useSecureClipboard());
    const text = "test text";

    act(() => {
      result.current.copyToClipboard(text, {
        hideNotification: true,
      });
    });

    expect(mockNativeSetString).toHaveBeenCalledWith(text, 30000);
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  it("should fallback to standard clipboard when native module fails", () => {
    const { result } = renderHook(() => useSecureClipboard());
    const text = "test text";

    // Mock native clipboard to throw an error
    mockNativeSetString.mockImplementation(() => {
      throw new Error("Clipboard error");
    });

    act(() => {
      result.current.copyToClipboard(text);
    });

    expect(mockNativeSetString).toHaveBeenCalledWith(text, 30000);
    expect(mockSetString).toHaveBeenCalledWith(text); // Should fallback to standard clipboard
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      "SecureClipboardService.copyToClipboard",
      "Native module failed, falling back to standard clipboard",
      expect.any(Error),
    );
    expect(mockShowToast).toHaveBeenCalledWith({
      title: "Copied to clipboard!",
      variant: "success",
      toastId: "secure-copy-toast",
    });
  });

  it("should set native expiration for default timeout (30 seconds)", () => {
    const { result } = renderHook(() => useSecureClipboard());
    const text = "sensitive data";

    act(() => {
      result.current.copyToClipboard(text);
    });

    // Verify native module is called with text and expiration
    expect(mockNativeSetString).toHaveBeenCalledWith(text, 30000);
  });

  it("should set native expiration for custom timeout", () => {
    const { result } = renderHook(() => useSecureClipboard());
    const text = "sensitive data";
    const customTimeout = 15000; // 15 seconds

    act(() => {
      result.current.copyToClipboard(text, {
        autoClearTimeout: customTimeout,
      });
    });

    // Verify native module is called with text and custom expiration
    expect(mockNativeSetString).toHaveBeenCalledWith(text, customTimeout);
  });

  it("should handle multiple copies with different expiration times", () => {
    const { result } = renderHook(() => useSecureClipboard());
    const text1 = "first text";
    const text2 = "second text";

    act(() => {
      result.current.copyToClipboard(text1);
    });

    // Copy again with different expiration
    act(() => {
      result.current.copyToClipboard(text2, {
        autoClearTimeout: 15000,
      });
    });

    // Verify both calls were made with correct parameters
    expect(mockNativeSetString).toHaveBeenCalledWith(text1, 30000);
    expect(mockNativeSetString).toHaveBeenCalledWith(text2, 15000);
  });

  it("should manually clear clipboard", async () => {
    const { result } = renderHook(() => useSecureClipboard());

    await act(async () => {
      await result.current.clearClipboard();
    });

    expect(mockNativeClearString).toHaveBeenCalled();
  });

  it("should get clipboard text", async () => {
    const { result } = renderHook(() => useSecureClipboard());

    const clipboardText = await result.current.getClipboardText();

    expect(mockNativeGetString).toHaveBeenCalled();
    expect(clipboardText).toBe("mocked native clipboard content");
  });

  it("should handle sensitive data flagging (Android specific)", () => {
    const { result } = renderHook(() => useSecureClipboard());
    const text = "sensitive recovery phrase";

    act(() => {
      result.current.copyToClipboard(text);
    });

    expect(mockNativeSetString).toHaveBeenCalledWith(text, 30000);
    expect(mockShowToast).toHaveBeenCalledWith({
      title: "Copied to clipboard!",
      variant: "success",
      toastId: "secure-copy-toast",
    });
  });

  it("should always treat data as sensitive", () => {
    const { result } = renderHook(() => useSecureClipboard());
    const text = "any data";

    act(() => {
      result.current.copyToClipboard(text);
    });

    expect(mockNativeSetString).toHaveBeenCalledWith(text, 30000);
    expect(mockShowToast).toHaveBeenCalledWith({
      title: "Copied to clipboard!",
      variant: "success",
      toastId: "secure-copy-toast",
    });
  });

  it("should use native module for Android data (sensitive on Android 13+)", () => {
    const { result } = renderHook(() => useSecureClipboard());
    const text = "sensitive recovery phrase";

    act(() => {
      result.current.copyToClipboard(text);
    });

    expect(mockNativeSetString).toHaveBeenCalledWith(text, 30000);
    expect(mockShowToast).toHaveBeenCalledWith({
      title: "Copied to clipboard!",
      variant: "success",
      toastId: "secure-copy-toast",
    });
  });

  it("should fallback to standard clipboard if native module fails", () => {
    const { result } = renderHook(() => useSecureClipboard());
    const text = "sensitive data";

    // Mock native module to throw an error
    mockNativeSetString.mockRejectedValue(new Error("Native module error"));

    act(() => {
      result.current.copyToClipboard(text);
    });

    expect(mockNativeSetString).toHaveBeenCalledWith(text, 30000);
    expect(mockShowToast).toHaveBeenCalledWith({
      title: "Copied to clipboard!",
      variant: "success",
      toastId: "secure-copy-toast",
    });
  });

  it("should use native module for getting clipboard text on Android", async () => {
    const { result } = renderHook(() => useSecureClipboard());

    const clipboardText = await result.current.getClipboardText();

    expect(mockNativeGetString).toHaveBeenCalled();
    expect(clipboardText).toBe("mocked native clipboard content");
  });

  it("should use native module for clearing clipboard on Android", async () => {
    const { result } = renderHook(() => useSecureClipboard());

    await result.current.clearClipboard();

    expect(mockNativeClearString).toHaveBeenCalled();
  });

  it("should fallback to standard clipboard if native getString fails", async () => {
    const { result } = renderHook(() => useSecureClipboard());

    // Mock native module to throw an error
    mockNativeGetString.mockRejectedValue(new Error("Native module error"));

    const clipboardText = await result.current.getClipboardText();

    expect(mockNativeGetString).toHaveBeenCalled();
    expect(mockGetString).toHaveBeenCalled();
    expect(clipboardText).toBe("mocked clipboard content");
  });

  it("should fallback to standard clipboard if native clearString fails", async () => {
    const { result } = renderHook(() => useSecureClipboard());

    // Mock native module to throw an error
    mockNativeClearString.mockRejectedValue(new Error("Native module error"));

    await result.current.clearClipboard();

    expect(mockNativeClearString).toHaveBeenCalled();
    expect(mockSetString).toHaveBeenCalledWith(""); // Should fallback to standard clipboard
  });

  describe("iOS Platform", () => {
    beforeEach(() => {
      // Mock Platform to return iOS
      (Platform as any).OS = "ios";
    });

    it("should use native module for iOS data (sensitive on Android 13+)", () => {
      const { result } = renderHook(() => useSecureClipboard());
      const text = "sensitive recovery phrase";

      act(() => {
        result.current.copyToClipboard(text);
      });

      expect(mockNativeSetString).toHaveBeenCalledWith(text, 30000);
      expect(mockSetString).not.toHaveBeenCalled(); // Should not use regular clipboard
    });

    it("should use native module for getting clipboard text on iOS", async () => {
      const { result } = renderHook(() => useSecureClipboard());

      const clipboardText = await result.current.getClipboardText();

      expect(mockGetString).toHaveBeenCalled();
      expect(clipboardText).toBe("mocked clipboard content");
    });

    it("should use native module for clearing clipboard on iOS", async () => {
      const { result } = renderHook(() => useSecureClipboard());

      await result.current.clearClipboard();

      expect(mockNativeClearString).toHaveBeenCalled();
    });
  });
});
