import { act, renderHook, waitFor } from "@testing-library/react-native";
import {
  dismissEthenaLaunchBanner,
  isEthenaLaunchBannerDismissed,
} from "helpers/ethenaLaunchPromo";
import { useEthenaLaunchBanner } from "hooks/useEthenaLaunchBanner";
import { analytics } from "services/analytics";

jest.mock("helpers/ethenaLaunchPromo", () => ({
  isEthenaLaunchBannerDismissed: jest.fn(),
  dismissEthenaLaunchBanner: jest.fn(() => Promise.resolve()),
}));

jest.mock("services/analytics", () => ({
  analytics: { track: jest.fn() },
}));

const mockIsDismissed = isEthenaLaunchBannerDismissed as jest.Mock;
const mockDismiss = dismissEthenaLaunchBanner as jest.Mock;
const mockTrack = analytics.track as jest.Mock;

/** Lets the hook's pending storage read settle. */
const flush = () =>
  act(async () => {
    await Promise.resolve();
  });

describe("useEthenaLaunchBanner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("stays hidden while the dismissal flag loads", () => {
    mockIsDismissed.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useEthenaLaunchBanner());

    expect(result.current.isVisible).toBe(false);
  });

  it("shows when the banner hasn't been dismissed", async () => {
    mockIsDismissed.mockResolvedValue(false);

    const { result } = renderHook(() => useEthenaLaunchBanner());

    await waitFor(() => expect(result.current.isVisible).toBe(true));
  });

  it("stays hidden once dismissed", async () => {
    mockIsDismissed.mockResolvedValue(true);

    const { result } = renderHook(() => useEthenaLaunchBanner());
    await flush();

    expect(result.current.isVisible).toBe(false);
  });

  it("stays hidden when the flag can't be read", async () => {
    mockIsDismissed.mockRejectedValue(new Error("disk"));

    const { result } = renderHook(() => useEthenaLaunchBanner());
    await flush();

    expect(result.current.isVisible).toBe(false);
  });

  it("hides at once, persists and tracks a dismissal", async () => {
    mockIsDismissed.mockResolvedValue(false);
    const { result } = renderHook(() => useEthenaLaunchBanner());
    await waitFor(() => expect(result.current.isVisible).toBe(true));

    act(() => result.current.dismiss());

    expect(result.current.isVisible).toBe(false);
    expect(mockDismiss).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith("ethena_launch.banner_dismissed");
  });
});
