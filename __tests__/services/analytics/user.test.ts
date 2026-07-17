import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "services/analytics/constants";
import { getUserId } from "services/analytics/user";
import { getAuthUserId } from "services/auth/getAuthUserId";

// jest.setup.js globally stubs services/analytics/user (getUserId always
// resolves "test-user-id") for the rest of the suite. Unmock it here so this
// file exercises the real implementation.
jest.unmock("services/analytics/user");

// Mock AsyncStorage directly (same pattern used across the mobile test suite).
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

// user.ts imports the real @amplitude/analytics-react-native package (jest.setup.js's
// blanket mock of services/analytics/user is unmocked above), which otherwise
// pulls in its own native AsyncStorage requirement at import time.
jest.mock("@amplitude/analytics-react-native", () => ({
  setUserId: jest.fn(),
}));

// Mock only the immediate dependency: getAuthUserId does its own thorough
// keypair-resolution testing in getAuthUserId.test.ts.
jest.mock("services/auth/getAuthUserId", () => ({
  getAuthUserId: jest.fn(),
}));

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;
const mockGetAuthUserId = getAuthUserId as jest.Mock;

describe("getUserId", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the auth-derived id and overwrites a previously stored random id", async () => {
    mockGetAuthUserId.mockResolvedValue("auth-derived-hex-id");
    mockGetItem.mockResolvedValue("old-random-id");

    const userId = await getUserId();

    expect(userId).toBe("auth-derived-hex-id");
    expect(mockSetItem).toHaveBeenCalledWith(
      STORAGE_KEYS.METRICS_USER_ID,
      "auth-derived-hex-id",
    );
  });

  it("returns the auth-derived id and persists it when nothing was stored yet", async () => {
    mockGetAuthUserId.mockResolvedValue("auth-derived-hex-id");
    mockGetItem.mockResolvedValue(null);

    const userId = await getUserId();

    expect(userId).toBe("auth-derived-hex-id");
    expect(mockSetItem).toHaveBeenCalledWith(
      STORAGE_KEYS.METRICS_USER_ID,
      "auth-derived-hex-id",
    );
  });

  it("falls back to the existing stored id when getAuthUserId resolves null (locked session)", async () => {
    mockGetAuthUserId.mockResolvedValue(null);
    mockGetItem.mockResolvedValue("existing-random-id");

    const userId = await getUserId();

    expect(userId).toBe("existing-random-id");
    // The pre-existing random path is untouched: no re-persist of an
    // already-stored id.
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it("generates and persists a new random id when getAuthUserId resolves null and nothing is stored", async () => {
    mockGetAuthUserId.mockResolvedValue(null);
    mockGetItem.mockResolvedValue(null);

    const userId = await getUserId();

    expect(userId).toEqual(expect.any(String));
    expect(userId.length).toBeGreaterThan(0);
    expect(mockSetItem).toHaveBeenCalledWith(
      STORAGE_KEYS.METRICS_USER_ID,
      userId,
    );
  });
});
