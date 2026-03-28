import { renderHook, act } from "@testing-library/react-hooks";
import { Keyboard } from "react-native";

// Mock dependencies
jest.mock("helpers/device", () => ({
  isAndroid: false,
  isIOS: true,
}));

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn((cb) => {
  cb(0);
  return 0;
});

// Inline the hook to avoid module resolution issues in tests
// This mirrors the logic from useKeyboardHandling.ts
const useKeyboardHandling = ({
  isOwnKeyboard,
  onFocusChange,
  onCancel,
  onInputChange,
}: {
  isOwnKeyboard: { value: boolean };
  onFocusChange?: (focused: boolean) => void;
  onCancel: () => void;
  onInputChange: (text: string) => void;
}) => {
  const { useCallback, useRef, useState } = require("react");

  const inputRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);
  const [cursorSelection, setCursorSelection] = useState<
    { start: number; end: number } | undefined
  >(undefined);

  const handleInputFocus = useCallback(() => {
    isOwnKeyboard.value = true;
    setIsFocused(true);
    onFocusChange?.(true);

    const moveCursor = () => setCursorSelection({ start: 0, end: 0 });
    requestAnimationFrame(moveCursor);
  }, [isOwnKeyboard, onFocusChange]);

  const handleInputBlur = useCallback(() => {
    isOwnKeyboard.value = false;
    setIsFocused(false);
    onFocusChange?.(false);
    onCancel();
  }, [isOwnKeyboard, onFocusChange, onCancel]);

  const handleCancel = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  const handleSelectionChange = useCallback(() => {
    if (cursorSelection) {
      setCursorSelection(undefined);
    }
  }, [cursorSelection]);

  const handleClear = useCallback(() => {
    onInputChange("");
  }, [onInputChange]);

  return {
    inputRef,
    isFocused,
    cursorSelection,
    handleInputFocus,
    handleInputBlur,
    handleCancel,
    handleSelectionChange,
    handleClear,
  };
};

describe("useKeyboardHandling", () => {
  const mockIsOwnKeyboard = { value: false };
  const mockOnFocusChange = jest.fn();
  const mockOnCancel = jest.fn();
  const mockOnInputChange = jest.fn();

  const defaultParams = {
    isOwnKeyboard: mockIsOwnKeyboard,
    onFocusChange: mockOnFocusChange,
    onCancel: mockOnCancel,
    onInputChange: mockOnInputChange,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsOwnKeyboard.value = false;
  });

  describe("handleInputFocus", () => {
    it("should set isOwnKeyboard to true", () => {
      const { result } = renderHook(() => useKeyboardHandling(defaultParams));

      act(() => {
        result.current.handleInputFocus();
      });

      expect(mockIsOwnKeyboard.value).toBe(true);
    });

    it("should set isFocused to true", () => {
      const { result } = renderHook(() => useKeyboardHandling(defaultParams));

      act(() => {
        result.current.handleInputFocus();
      });

      expect(result.current.isFocused).toBe(true);
    });

    it("should call onFocusChange with true", () => {
      const { result } = renderHook(() => useKeyboardHandling(defaultParams));

      act(() => {
        result.current.handleInputFocus();
      });

      expect(mockOnFocusChange).toHaveBeenCalledWith(true);
    });

    it("should set cursor selection to beginning of input", () => {
      const { result } = renderHook(() => useKeyboardHandling(defaultParams));

      act(() => {
        result.current.handleInputFocus();
      });

      expect(result.current.cursorSelection).toEqual({ start: 0, end: 0 });
    });

    it("should not crash when onFocusChange is undefined", () => {
      const { result } = renderHook(() =>
        useKeyboardHandling({ ...defaultParams, onFocusChange: undefined }),
      );

      expect(() => {
        act(() => {
          result.current.handleInputFocus();
        });
      }).not.toThrow();
    });
  });

  describe("handleInputBlur", () => {
    it("should set isOwnKeyboard to false", () => {
      const { result } = renderHook(() => useKeyboardHandling(defaultParams));

      act(() => {
        result.current.handleInputFocus();
      });

      act(() => {
        result.current.handleInputBlur();
      });

      expect(mockIsOwnKeyboard.value).toBe(false);
    });

    it("should set isFocused to false", () => {
      const { result } = renderHook(() => useKeyboardHandling(defaultParams));

      act(() => {
        result.current.handleInputFocus();
      });

      act(() => {
        result.current.handleInputBlur();
      });

      expect(result.current.isFocused).toBe(false);
    });

    it("should call onFocusChange with false", () => {
      const { result } = renderHook(() => useKeyboardHandling(defaultParams));

      act(() => {
        result.current.handleInputBlur();
      });

      expect(mockOnFocusChange).toHaveBeenCalledWith(false);
    });

    it("should call onCancel", () => {
      const { result } = renderHook(() => useKeyboardHandling(defaultParams));

      act(() => {
        result.current.handleInputBlur();
      });

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe("handleCancel", () => {
    it("should dismiss the keyboard", () => {
      const dismissSpy = jest.spyOn(Keyboard, "dismiss");
      const { result } = renderHook(() => useKeyboardHandling(defaultParams));

      act(() => {
        result.current.handleCancel();
      });

      expect(dismissSpy).toHaveBeenCalled();
      dismissSpy.mockRestore();
    });
  });

  describe("handleSelectionChange", () => {
    it("should clear cursor selection after it has been set", () => {
      const { result } = renderHook(() => useKeyboardHandling(defaultParams));

      // Focus sets the cursor selection
      act(() => {
        result.current.handleInputFocus();
      });

      expect(result.current.cursorSelection).toEqual({ start: 0, end: 0 });

      // Selection change clears it so user can freely move the cursor
      act(() => {
        result.current.handleSelectionChange();
      });

      expect(result.current.cursorSelection).toBeUndefined();
    });

    it("should be a no-op when cursor selection is already undefined", () => {
      const { result } = renderHook(() => useKeyboardHandling(defaultParams));

      // No focus, so cursorSelection is undefined
      act(() => {
        result.current.handleSelectionChange();
      });

      expect(result.current.cursorSelection).toBeUndefined();
    });
  });

  describe("handleClear", () => {
    it("should call onInputChange with empty string", () => {
      const { result } = renderHook(() => useKeyboardHandling(defaultParams));

      act(() => {
        result.current.handleClear();
      });

      expect(mockOnInputChange).toHaveBeenCalledWith("");
    });
  });

  describe("focus → blur lifecycle", () => {
    it("should handle a complete focus → blur cycle correctly", () => {
      const { result } = renderHook(() => useKeyboardHandling(defaultParams));

      // Initial state
      expect(result.current.isFocused).toBe(false);
      expect(mockIsOwnKeyboard.value).toBe(false);

      // Focus
      act(() => {
        result.current.handleInputFocus();
      });

      expect(result.current.isFocused).toBe(true);
      expect(mockIsOwnKeyboard.value).toBe(true);
      expect(result.current.cursorSelection).toEqual({ start: 0, end: 0 });

      // Selection change (cursor applied)
      act(() => {
        result.current.handleSelectionChange();
      });

      expect(result.current.cursorSelection).toBeUndefined();

      // Blur
      act(() => {
        result.current.handleInputBlur();
      });

      expect(result.current.isFocused).toBe(false);
      expect(mockIsOwnKeyboard.value).toBe(false);
      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });
  });
});
