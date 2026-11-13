import { act, renderHook } from "@testing-library/react-native";
import { SecretSourceMap, SecretSourceType } from "config/types";
import { useHasRecoveryPhrase } from "hooks/useHasRecoveryPhrase";
import { getSecretSources } from "services/auth/secretSources";

// Runs the focus effect on mount, and lets a test leave and come back into
// focus: the cleanup runs, then the effect again.
let mockRefocus: () => void = () => {};
let mockBlur: () => void = () => {};
jest.mock("@react-navigation/native", () => {
  const { useEffect } = jest.requireActual("react");
  return {
    useFocusEffect: (effect: () => (() => void) | undefined) => {
      useEffect(() => {
        let cleanup = effect();
        mockBlur = () => cleanup?.();
        mockRefocus = () => {
          cleanup?.();
          cleanup = effect();
        };
        return () => cleanup?.();
      }, [effect]);
    },
  };
});

jest.mock("config/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

jest.mock("services/auth/secretSources", () => ({
  getSecretSources: jest.fn(),
}));

const sources = (...types: SecretSourceType[]): SecretSourceMap =>
  Object.fromEntries(
    types.map((type, index) => [
      `source-${index}`,
      { id: `source-${index}`, type, label: `Source ${index}`, createdAt: 1 },
    ]),
  );

const mockRead = getSecretSources as jest.Mock;

/** Lets a pending sources read settle. */
const settle = () => act(async () => {});

describe("useHasRecoveryPhrase", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("is true until the sources have been read", () => {
    mockRead.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useHasRecoveryPhrase());

    expect(result.current).toBe(true);
  });

  it("is false for a wallet holding only secret keys", async () => {
    mockRead.mockResolvedValue(sources(SecretSourceType.SECRET_KEY));

    const { result } = renderHook(() => useHasRecoveryPhrase());
    await settle();

    expect(result.current).toBe(false);
  });

  it("is true once the wallet holds a phrase", async () => {
    mockRead.mockResolvedValue(
      sources(SecretSourceType.SECRET_KEY, SecretSourceType.PHRASE),
    );

    const { result } = renderHook(() => useHasRecoveryPhrase());
    await settle();

    expect(result.current).toBe(true);
  });

  // A phrase may have been added since the key-only read, so a failed read
  // must not leave the row hidden.
  it("goes back to true when a later read fails", async () => {
    mockRead.mockResolvedValueOnce(sources(SecretSourceType.SECRET_KEY));
    const { result } = renderHook(() => useHasRecoveryPhrase());
    await settle();
    expect(result.current).toBe(false);

    mockRead.mockRejectedValueOnce(new Error("read failed"));
    act(() => {
      mockRefocus();
    });
    await settle();

    expect(result.current).toBe(true);
  });

  it("ignores a read that settles after the screen lost focus", async () => {
    let finishRead: (map: SecretSourceMap) => void = () => {};
    mockRead.mockReturnValue(
      new Promise<SecretSourceMap>((resolve) => {
        finishRead = resolve;
      }),
    );
    const { result } = renderHook(() => useHasRecoveryPhrase());

    act(() => {
      mockBlur();
    });
    finishRead(sources(SecretSourceType.SECRET_KEY));
    await settle();

    expect(result.current).toBe(true);
  });
});
