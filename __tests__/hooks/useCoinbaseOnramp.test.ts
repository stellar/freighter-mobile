import { act, renderHook } from "@testing-library/react-hooks";
import { logger } from "config/logger";
import { useCoinbaseOnramp } from "hooks/useCoinbaseOnramp";

jest.mock("ducks/auth", () => ({
  getActiveAccountPublicKey: jest.fn(() => Promise.resolve("GPUBLICKEY")),
}));

const mockOpenInAppBrowser = jest.fn();
jest.mock("hooks/useInAppBrowser", () => ({
  useInAppBrowser: () => ({ open: mockOpenInAppBrowser }),
}));

jest.mock("services/analytics", () => ({
  analytics: { track: jest.fn() },
}));

const mockFetchResponse = (data: { token?: string; error?: string }) => {
  global.fetch = jest.fn(() =>
    Promise.resolve({ json: () => Promise.resolve({ data }) }),
  ) as unknown as typeof fetch;
};

/** Renders the hook once the active account's public key has loaded. */
const renderOnramp = async () => {
  const hook = renderHook(() => useCoinbaseOnramp({ token: "USDC" }));
  await act(async () => {});
  return hook;
};

describe("useCoinbaseOnramp", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(logger, "error").mockImplementation(() => {});
  });

  it("opens Coinbase with the session token", async () => {
    mockFetchResponse({ token: "session-token" });
    mockOpenInAppBrowser.mockResolvedValueOnce(undefined);
    const { result } = await renderOnramp();

    await act(() => result.current.openCoinbaseUrl());

    expect(mockOpenInAppBrowser).toHaveBeenCalledWith(
      expect.stringContaining("sessionToken=session-token"),
    );
  });

  // The caller tells the user: nothing has opened.
  it("rejects when the session token can't be fetched", async () => {
    mockFetchResponse({ error: "onramp unavailable" });
    const { result } = await renderOnramp();

    await act(async () => {
      await expect(result.current.openCoinbaseUrl()).rejects.toThrow(
        "onramp unavailable",
      );
    });

    expect(mockOpenInAppBrowser).not.toHaveBeenCalled();
  });

  // useInAppBrowser hands the page to the system browser before it throws,
  // so Coinbase is open: no failure for the caller to report.
  it("resolves when the in-app browser fails, as Coinbase opens in the system browser", async () => {
    mockFetchResponse({ token: "session-token" });
    mockOpenInAppBrowser.mockRejectedValueOnce(new Error("browser failed"));
    const { result } = await renderOnramp();

    await act(async () => {
      await expect(result.current.openCoinbaseUrl()).resolves.toBeUndefined();
    });

    expect(logger.error).toHaveBeenCalled();
  });
});
