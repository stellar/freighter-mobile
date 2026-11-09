import AsyncStorage from "@react-native-async-storage/async-storage";
import { updateSentryContext } from "config/sentryConfig";
import { analytics } from "services/analytics";
import { STORAGE_KEYS } from "services/analytics/constants";
import {
  reconcileAnalyticsUserId,
  resetAnalyticsUserIdReconciliation,
} from "services/analytics/reconcileUserId";
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

const confirmedId = (id: string) => ({
  analyticsUserId: id,
  isConfirmed: true,
});
const provisionalId = (id: string) => ({
  analyticsUserId: id,
  isConfirmed: false,
});

describe("reconcileAnalyticsUserId", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetAnalyticsUserIdReconciliation();
  });

  it("persists the auth id, identifies the user, and pushes it to Sentry when unlocked", async () => {
    mockGetAuthUserId.mockResolvedValue(confirmedId(AUTH_ID));

    await reconcileAnalyticsUserId();

    expect(mockSetItem).toHaveBeenCalledWith(
      STORAGE_KEYS.METRICS_USER_ID,
      AUTH_ID,
    );
    expect(mockIdentifyUser).toHaveBeenCalledTimes(1);
    expect(mockUpdateSentryContext).toHaveBeenCalledTimes(1);
  });

  it("is a no-op when locked (auth id null): no persist, no identify, no Sentry push", async () => {
    mockGetAuthUserId.mockResolvedValue({
      analyticsUserId: null,
      isConfirmed: false,
    });

    await reconcileAnalyticsUserId();

    expect(mockSetItem).not.toHaveBeenCalled();
    expect(mockIdentifyUser).not.toHaveBeenCalled();
    expect(mockUpdateSentryContext).not.toHaveBeenCalled();
  });

  it("still identifies + pushes to Sentry when persistence fails (session-only fallback)", async () => {
    mockGetAuthUserId.mockResolvedValue(confirmedId(AUTH_ID));
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

  it("skips the lookup once the server has confirmed the id", async () => {
    mockGetAuthUserId.mockResolvedValue(confirmedId(AUTH_ID));

    await reconcileAnalyticsUserId();
    await reconcileAnalyticsUserId();

    expect(mockGetAuthUserId).toHaveBeenCalledTimes(1);
  });

  it("re-reconciles after the guard is reset on lock", async () => {
    mockGetAuthUserId.mockResolvedValue(confirmedId(AUTH_ID));

    await reconcileAnalyticsUserId();
    resetAnalyticsUserIdReconciliation();
    await reconcileAnalyticsUserId();

    expect(mockGetAuthUserId).toHaveBeenCalledTimes(2);
  });

  it("adopts a provisional id but keeps asking until the server confirms one", async () => {
    // A secret-key-only wallet before its first link: the pinned key's
    // source id replaces the random bootstrap id.
    mockGetAuthUserId.mockResolvedValue(provisionalId("1".repeat(64)));

    await reconcileAnalyticsUserId();
    await reconcileAnalyticsUserId();

    expect(mockGetAuthUserId).toHaveBeenCalledTimes(2);
    expect(mockSetItem).toHaveBeenLastCalledWith(
      STORAGE_KEYS.METRICS_USER_ID,
      "1".repeat(64),
    );

    // The first link resolved the key to an existing user: overwrite with
    // that user's id.
    mockGetAuthUserId.mockResolvedValue(confirmedId("2".repeat(64)));
    await reconcileAnalyticsUserId();
    await reconcileAnalyticsUserId();

    expect(mockGetAuthUserId).toHaveBeenCalledTimes(3);
    expect(mockSetItem).toHaveBeenLastCalledWith(
      STORAGE_KEYS.METRICS_USER_ID,
      "2".repeat(64),
    );
  });

  it("ignores a provisional answer that arrives after another call confirmed", async () => {
    let resolveStale: (value: unknown) => void = () => {};
    mockGetAuthUserId
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveStale = resolve;
        }),
      )
      .mockResolvedValueOnce(confirmedId("5".repeat(64)));

    const stale = reconcileAnalyticsUserId();
    await reconcileAnalyticsUserId();
    resolveStale(provisionalId("4".repeat(64)));
    await stale;

    expect(mockSetItem).toHaveBeenCalledTimes(1);
    expect(mockSetItem).toHaveBeenLastCalledWith(
      STORAGE_KEYS.METRICS_USER_ID,
      "5".repeat(64),
    );
  });

  it("drops a lookup that started before a reset, so the next session still reconciles", async () => {
    let resolveStale: (value: unknown) => void = () => {};
    mockGetAuthUserId
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveStale = resolve;
        }),
      )
      .mockResolvedValueOnce(confirmedId("7".repeat(64)));

    // A wipe resets the guard while the old wallet's GET /user is in flight,
    // and that answer lands before the wipe clears the cached id.
    const stale = reconcileAnalyticsUserId();
    resetAnalyticsUserIdReconciliation();
    resolveStale(confirmedId("6".repeat(64)));
    await stale;

    expect(mockSetItem).not.toHaveBeenCalled();
    expect(mockIdentifyUser).not.toHaveBeenCalled();

    // The imported wallet's unlock asks again and adopts its own id.
    await reconcileAnalyticsUserId();
    expect(mockGetAuthUserId).toHaveBeenCalledTimes(2);
    expect(mockSetItem).toHaveBeenLastCalledWith(
      STORAGE_KEYS.METRICS_USER_ID,
      "7".repeat(64),
    );
  });

  it("adopts the cached id while locked without settling the session", async () => {
    mockGetAuthUserId.mockResolvedValue(confirmedId("3".repeat(64)));

    await reconcileAnalyticsUserId({ settle: false });
    expect(mockSetItem).toHaveBeenLastCalledWith(
      STORAGE_KEYS.METRICS_USER_ID,
      "3".repeat(64),
    );

    // The next (unlocked) call still asks: a wallet replaced from the lock
    // screen would have a different id.
    await reconcileAnalyticsUserId();
    expect(mockGetAuthUserId).toHaveBeenCalledTimes(2);
  });
});
