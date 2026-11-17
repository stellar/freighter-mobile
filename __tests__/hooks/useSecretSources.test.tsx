import { renderHook, waitFor } from "@testing-library/react-native";
import { logger } from "config/logger";
import { SecretSource, SecretSourceType } from "config/types";
import useSecretSources from "hooks/useSecretSources";
import { act } from "react";
import { getSecretSources } from "services/auth/secretSources";

jest.mock("services/auth/secretSources", () => ({
  getSecretSources: jest.fn(),
}));

jest.mock("config/logger", () => ({
  logger: { error: jest.fn() },
}));

const mockGetSecretSources = getSecretSources as jest.Mock;

const phrase = {
  id: "source-a",
  type: SecretSourceType.PHRASE,
  label: "Seed Phrase 1",
} as unknown as SecretSource;

describe("useSecretSources", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("is null until the first read, then lists the sources", async () => {
    mockGetSecretSources.mockResolvedValue({ [phrase.id]: phrase });
    const { result } = renderHook(() => useSecretSources("TestScreen"));

    expect(result.current.sources).toBeNull();
    expect(mockGetSecretSources).not.toHaveBeenCalled();

    act(() => result.current.reload());

    await waitFor(() => expect(result.current.sources).toEqual([phrase]));
  });

  it("falls back to [] and logs under the context when the first read fails", async () => {
    const error = new Error("storage failed");
    mockGetSecretSources.mockRejectedValue(error);
    const { result } = renderHook(() => useSecretSources("TestScreen"));

    act(() => result.current.reload());

    await waitFor(() => expect(result.current.sources).toEqual([]));
    expect(logger.error).toHaveBeenCalledWith(
      "TestScreen",
      "Failed to read secret sources",
      error,
    );
  });

  it("keeps the last good list when a later read fails", async () => {
    mockGetSecretSources.mockResolvedValueOnce({ [phrase.id]: phrase });
    const { result } = renderHook(() => useSecretSources("TestScreen"));

    act(() => result.current.reload());
    await waitFor(() => expect(result.current.sources).toEqual([phrase]));

    mockGetSecretSources.mockRejectedValueOnce(new Error("storage failed"));
    act(() => result.current.reload());

    await waitFor(() => expect(logger.error).toHaveBeenCalledTimes(1));
    expect(result.current.sources).toEqual([phrase]);
  });
});
