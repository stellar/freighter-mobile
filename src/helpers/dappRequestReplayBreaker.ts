import { STORAGE_KEYS } from "config/constants";
import { logger } from "config/logger";
import { walletKit } from "helpers/walletKitUtil";
import { dataStorage } from "services/storage/storageFactory";

/**
 * The dApp request whose sheet is on screen, as saved before the sheet shows.
 * If the app dies while showing it (a crash, a kill for memory, or a freeze
 * the user ends), the marker is still there at the next start.
 */
export interface DappRequestOnScreen {
  id: number;
  topic: string;
  dappName: string;
}

const readMarker = async (): Promise<DappRequestOnScreen | null> => {
  const stored = await dataStorage.getItem(STORAGE_KEYS.DAPP_REQUEST_ON_SCREEN);
  if (!stored) {
    return null;
  }

  try {
    const marker = JSON.parse(stored) as Partial<DappRequestOnScreen> | null;
    if (
      !marker ||
      typeof marker.id !== "number" ||
      typeof marker.topic !== "string"
    ) {
      return null;
    }

    return {
      id: marker.id,
      topic: marker.topic,
      dappName: typeof marker.dappName === "string" ? marker.dappName : "",
    };
  } catch {
    return null;
  }
};

/** Saves the request about to be shown. Await it before showing the sheet. */
export const markDappRequestOnScreen = (
  request: DappRequestOnScreen,
): Promise<void> =>
  dataStorage.setItem(
    STORAGE_KEYS.DAPP_REQUEST_ON_SCREEN,
    JSON.stringify(request),
  );

/**
 * Removes the marker once request `id` is answered or dismissed. A marker
 * saved since for another request is kept.
 */
export const clearDappRequestOnScreen = async (id: number): Promise<void> => {
  const marker = await readMarker();
  if (marker && marker.id !== id) {
    return;
  }

  await dataStorage.remove(STORAGE_KEYS.DAPP_REQUEST_ON_SCREEN);
};

/**
 * Run at start, before any request is handled. If a request was still on
 * screen when the app last closed, rejects every pending request from that
 * dApp's session (with `message`), so none of them is shown again, and
 * removes the marker first, so a failure here can't repeat on every start.
 *
 * @returns The dApp's name and the ids rejected, or null when nothing was
 * left on screen or nothing from that dApp was still pending.
 */
export const rejectRequestsLeftOnScreen = async (
  message: string,
): Promise<{ dappName: string; rejectedIds: number[] } | null> => {
  const marker = await readMarker();
  await dataStorage.remove(STORAGE_KEYS.DAPP_REQUEST_ON_SCREEN);
  if (!marker) {
    return null;
  }

  const pendingRequests = walletKit
    .getPendingSessionRequests()
    .filter((request) => request.topic === marker.topic);
  if (pendingRequests.length === 0) {
    return null;
  }

  await Promise.all(
    pendingRequests.map(({ id, topic }) =>
      walletKit
        .respondSessionRequest({
          topic,
          response: { id, jsonrpc: "2.0", error: { code: 5000, message } },
        })
        .catch((error: unknown) => {
          logger.warn(
            "dappRequestReplayBreaker",
            "Failed to reject a request left on screen",
            error,
          );
        }),
    ),
  );

  return {
    dappName: marker.dappName,
    rejectedIds: pendingRequests.map(({ id }) => id),
  };
};
