import AsyncStorage from "@react-native-async-storage/async-storage";
import { updateSentryContext } from "config/sentryConfig";
import { analytics } from "services/analytics";
import { STORAGE_KEYS } from "services/analytics/constants";
import { reconcileAnalyticsUserId } from "services/analytics/reconcileUserId";
import { getAuthUserId } from "services/auth/getAuthUserId";

// Mock AsyncStorage directly (same pattern used across the mobile test suite).
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

// config/sentryConfig is NOT globally mocked (it pulls in native Sentry +
// device-info), so stub the one function reconcile calls.
jest.mock("config/sentryConfig", () => ({
  updateSentryContext: jest.fn(),
}));

// getAuthUserId does its own keypair-resolution testing in
// getAuthUserId.test.ts; mock only the immediate dependency here.
jest.mock("services/auth/getAuthUserId", () => ({
  getAuthUserId: jest.fn(),
}));

// `analytics` (the barrel) is globally mocked in jest.setup.js, so
// analytics.identifyUser is already a jest.fn.
const mockSetItem = AsyncStorage.setItem as jest.Mock;
const mockUpdateSentryContext = updateSentryContext as jest.Mock;
const mockGetAuthUserId = getAuthUserId as jest.Mock;
const mockIdentifyUser = analytics.identifyUser as jest.Mock;

const AUTH_ID = "a".repeat(64);

describe("reconcileAnalyticsUserId", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("persists the auth id, identifies the user, and pushes it to Sentry when unlocked", async () => {
    mockGetAuthUserId.mockResolvedValue(AUTH_ID);

    await reconcileAnalyticsUserId();

    expect(mockSetItem).toHaveBeenCalledWith(
      STORAGE_KEYS.METRICS_USER_ID,
      AUTH_ID,
    );
    expect(mockIdentifyUser).toHaveBeenCalledTimes(1);
    expect(mockUpdateSentryContext).toHaveBeenCalledTimes(1);
  });

  it("is a no-op when locked (auth id null): no persist, no identify, no Sentry push", async () => {
    mockGetAuthUserId.mockResolvedValue(null);

    await reconcileAnalyticsUserId();

    expect(mockSetItem).not.toHaveBeenCalled();
    expect(mockIdentifyUser).not.toHaveBeenCalled();
    expect(mockUpdateSentryContext).not.toHaveBeenCalled();
  });

  it("still identifies + pushes to Sentry when persistence fails (session-only fallback)", async () => {
    mockGetAuthUserId.mockResolvedValue(AUTH_ID);
    mockSetItem.mockRejectedValue(new Error("AsyncStorage write failed"));

    await expect(reconcileAnalyticsUserId()).resolves.toBeUndefined();

    expect(mockIdentifyUser).toHaveBeenCalledTimes(1);
    expect(mockUpdateSentryContext).toHaveBeenCalledTimes(1);
  });

  it("never throws into the fire-and-forget caller when getAuthUserId rejects", async () => {
    mockGetAuthUserId.mockRejectedValue(new Error("keypair derivation failed"));

    await expect(reconcileAnalyticsUserId()).resolves.toBeUndefined();

    expect(mockSetItem).not.toHaveBeenCalled();
    expect(mockIdentifyUser).not.toHaveBeenCalled();
    expect(mockUpdateSentryContext).not.toHaveBeenCalled();
  });
});
