import { act, renderHook } from "@testing-library/react-hooks";
import { useClipboard } from "hooks/useClipboard";

// Mock the Clipboard module
const mockSetString = jest.fn();
jest.mock("@react-native-clipboard/clipboard", () => ({
  setString: (text: string) => mockSetString(text),
}));

// Mock the useToast hook
const mockShowToast = jest.fn();
jest.mock("providers/ToastProvider", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

// Mock the translation function
jest.mock("hooks/useAppTranslation", () => () => ({
  t: (key: string) => {
    const translations: Record<string, string> = {
      "common.copied": "Copied to clipboard!",
      "clipboard.failed": "Failed to copy to clipboard",
    };
    return translations[key] || key;
  },
}));

describe("useClipboard", () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  it("should copy text to clipboard and show default success toast", () => {
    const { result } = renderHook(() => useClipboard());
    const text = "test text";

    act(() => {
      result.current.copyToClipboard(text);
    });

    expect(mockSetString).toHaveBeenCalledWith(text);
    expect(mockShowToast).toHaveBeenCalledWith({
      title: "Copied to clipboard!",
      variant: "success",
      toastId: "copy-toast",
    });
  });

  it("should copy text to clipboard with custom notification message", () => {
    const { result } = renderHook(() => useClipboard());
    const text = "test text";
    const customMessage = "Custom message";

    act(() => {
      result.current.copyToClipboard(text, {
        notificationMessage: customMessage,
      });
    });

    expect(mockSetString).toHaveBeenCalledWith(text);
    expect(mockShowToast).toHaveBeenCalledWith({
      title: customMessage,
      variant: "success",
      toastId: "copy-toast",
    });
  });

  it("should copy text to clipboard with custom toast variant", () => {
    const { result } = renderHook(() => useClipboard());
    const text = "test text";

    act(() => {
      result.current.copyToClipboard(text, {
        toastVariant: "primary",
      });
    });

    expect(mockSetString).toHaveBeenCalledWith(text);
    expect(mockShowToast).toHaveBeenCalledWith({
      title: "Copied to clipboard!",
      variant: "primary",
      toastId: "copy-toast",
    });
  });

  it("should copy text to clipboard without showing notification", () => {
    const { result } = renderHook(() => useClipboard());
    const text = "test text";

    act(() => {
      result.current.copyToClipboard(text, {
        hideNotification: true,
      });
    });

    expect(mockSetString).toHaveBeenCalledWith(text);
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  it("should show error toast when clipboard operation fails", () => {
    const { result } = renderHook(() => useClipboard());
    const text = "test text";
    const error = new Error("Clipboard error");

    // Mock clipboard error
    mockSetString.mockImplementationOnce(() => {
      throw error;
    });

    act(() => {
      result.current.copyToClipboard(text);
    });

    expect(mockSetString).toHaveBeenCalledWith(text);
    expect(mockShowToast).toHaveBeenCalledWith({
      title: "Failed to copy to clipboard",
      variant: "error",
      toastId: "copy-error-toast",
    });
  });
});
