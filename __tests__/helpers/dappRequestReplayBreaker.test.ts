import { STORAGE_KEYS } from "config/constants";
import { logger } from "config/logger";
import {
  clearDappRequestOnScreen,
  markDappRequestOnScreen,
  rejectRequestsLeftOnScreen,
} from "helpers/dappRequestReplayBreaker";
import { walletKit } from "helpers/walletKitUtil";
import { dataStorage } from "services/storage/storageFactory";

jest.mock("helpers/walletKitUtil", () => ({
  walletKit: {
    getPendingSessionRequests: jest.fn(),
    respondSessionRequest: jest.fn(),
  },
}));

const mockedWalletKit = walletKit as unknown as {
  getPendingSessionRequests: jest.Mock;
  respondSessionRequest: jest.Mock;
};

const ON_SCREEN = { id: 7, topic: "topic-a", dappName: "Example dApp" };

const pending = (id: number, topic: string) => ({
  id,
  topic,
  params: { request: { method: "stellar_signMessage", params: {} } },
});

const storedMarker = () =>
  dataStorage.getItem(STORAGE_KEYS.DAPP_REQUEST_ON_SCREEN);

describe("dappRequestReplayBreaker", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await dataStorage.remove(STORAGE_KEYS.DAPP_REQUEST_ON_SCREEN);
    mockedWalletKit.getPendingSessionRequests.mockReturnValue([]);
    mockedWalletKit.respondSessionRequest.mockResolvedValue(undefined);
  });

  it("saves the request on screen", async () => {
    await markDappRequestOnScreen(ON_SCREEN);

    expect(JSON.parse((await storedMarker()) as string)).toEqual(ON_SCREEN);
  });

  it("keeps the marker when another request is cleared", async () => {
    await markDappRequestOnScreen(ON_SCREEN);

    await clearDappRequestOnScreen(8);

    expect(await storedMarker()).not.toBeNull();
  });

  it("removes the marker when its request is cleared", async () => {
    await markDappRequestOnScreen(ON_SCREEN);

    await clearDappRequestOnScreen(7);

    expect(await storedMarker()).toBeNull();
  });

  it("rejects nothing when no request was left on screen", async () => {
    mockedWalletKit.getPendingSessionRequests.mockReturnValue([
      pending(7, "topic-a"),
    ]);

    expect(await rejectRequestsLeftOnScreen("closed")).toBeNull();
    expect(mockedWalletKit.respondSessionRequest).not.toHaveBeenCalled();
  });

  it("removes a marker it can't read, and rejects nothing", async () => {
    await dataStorage.setItem(STORAGE_KEYS.DAPP_REQUEST_ON_SCREEN, "{not json");
    mockedWalletKit.getPendingSessionRequests.mockReturnValue([
      pending(7, "topic-a"),
    ]);

    expect(await rejectRequestsLeftOnScreen("closed")).toBeNull();
    expect(mockedWalletKit.respondSessionRequest).not.toHaveBeenCalled();
    expect(await storedMarker()).toBeNull();
  });

  it("rejects every pending request of the dApp left on screen, and only those", async () => {
    await markDappRequestOnScreen(ON_SCREEN);
    mockedWalletKit.getPendingSessionRequests.mockReturnValue([
      pending(7, "topic-a"),
      pending(9, "topic-b"),
      pending(11, "topic-a"),
    ]);

    const result = await rejectRequestsLeftOnScreen("closed");

    expect(result).toEqual({ dappName: "Example dApp", rejectedIds: [7, 11] });
    expect(mockedWalletKit.respondSessionRequest).toHaveBeenCalledTimes(2);
    expect(mockedWalletKit.respondSessionRequest).toHaveBeenCalledWith({
      topic: "topic-a",
      response: {
        id: 7,
        jsonrpc: "2.0",
        error: { code: 5000, message: "closed" },
      },
    });
    expect(mockedWalletKit.respondSessionRequest).toHaveBeenCalledWith({
      topic: "topic-a",
      response: {
        id: 11,
        jsonrpc: "2.0",
        error: { code: 5000, message: "closed" },
      },
    });
    expect(await storedMarker()).toBeNull();
  });

  it("removes the marker and rejects nothing when the dApp has no pending requests", async () => {
    await markDappRequestOnScreen(ON_SCREEN);
    mockedWalletKit.getPendingSessionRequests.mockReturnValue([
      pending(9, "topic-b"),
    ]);

    expect(await rejectRequestsLeftOnScreen("closed")).toBeNull();
    expect(mockedWalletKit.respondSessionRequest).not.toHaveBeenCalled();
    expect(await storedMarker()).toBeNull();
  });

  it("still rejects the other requests when one rejection fails, and logs it", async () => {
    await markDappRequestOnScreen(ON_SCREEN);
    mockedWalletKit.getPendingSessionRequests.mockReturnValue([
      pending(7, "topic-a"),
      pending(11, "topic-a"),
    ]);
    mockedWalletKit.respondSessionRequest.mockRejectedValueOnce(
      new Error("relay down"),
    );

    const result = await rejectRequestsLeftOnScreen("closed");

    expect(result).toEqual({ dappName: "Example dApp", rejectedIds: [7, 11] });
    expect(mockedWalletKit.respondSessionRequest).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledWith(
      "dappRequestReplayBreaker",
      "Failed to reject a request left on screen",
      expect.any(Error),
    );
  });
});
