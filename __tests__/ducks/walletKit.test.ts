import { NETWORKS } from "config/constants";
import { logger } from "config/logger";
import { ActiveSessions, useWalletKitStore } from "ducks/walletKit";
import { getActiveSessions } from "helpers/walletKitUtil";

// jest.setup.js stubs this duck for every suite; this one tests the real store.
jest.unmock("ducks/walletKit");
// Mocking the util also keeps its import cycle with the duck out of the test.
jest.mock("helpers/walletKitUtil", () => ({
  getActiveSessions: jest.fn(),
  disconnectSession: jest.fn(),
  disconnectAllSessions: jest.fn(),
}));

const PUBLIC_KEY = "GDVEU3DD4KOFECV66VIHWEZOYX4ZKR3WV27L464SIIPOU2IUI3JCZA57";

describe("useWalletKitStore.fetchActiveSessions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("stores the sessions it reads", () => {
    const sessions = { topic: {} } as unknown as ActiveSessions;
    jest.mocked(getActiveSessions).mockReturnValue(sessions);

    useWalletKitStore
      .getState()
      .fetchActiveSessions(PUBLIC_KEY, NETWORKS.TESTNET);

    expect(useWalletKitStore.getState().activeSessions).toBe(sessions);
  });

  it("keeps the current sessions and logs when reading them throws", () => {
    const current = { current: {} } as unknown as ActiveSessions;
    useWalletKitStore.setState({ activeSessions: current });
    const failure = new Error("unreadable sessions");
    jest.mocked(getActiveSessions).mockImplementation(() => {
      throw failure;
    });

    expect(() =>
      useWalletKitStore
        .getState()
        .fetchActiveSessions(PUBLIC_KEY, NETWORKS.TESTNET),
    ).not.toThrow();
    expect(useWalletKitStore.getState().activeSessions).toBe(current);
    expect(logger.error).toHaveBeenCalledWith(
      "fetchActiveSessions",
      "Failed to read active sessions",
      failure,
    );
  });
});
