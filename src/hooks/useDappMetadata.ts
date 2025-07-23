/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { CoreTypes } from "@walletconnect/types";
import {
  useWalletKitStore,
  WalletKitEvent,
  WalletKitEventTypes,
  ActiveSessions,
} from "ducks/walletKit";
import { useMemo } from "react";

/**
 * Default empty metadata object used when no metadata is available
 */
export const emptyMetadata: CoreTypes.Metadata = {
  name: "",
  description: "",
  url: "",
  icons: [],
};

/**
 * Pure utility to extract dApp metadata from a WalletKit event and activeSessions map.
 * This function is identical to the logic used in the useDappMetadata hook.
 *
 * @param {WalletKitEvent | null} event - The WalletKit event to extract metadata from
 * @param {ActiveSessions} activeSessions - The active sessions map
 * @returns {CoreTypes.Metadata | null} The dApp metadata or null if no event is provided
 */
export function getDappMetadataFromEvent(
  event: WalletKitEvent | null,
  activeSessions: ActiveSessions,
): CoreTypes.Metadata | null {
  if (!event) {
    return null;
  }

  if (event.type === WalletKitEventTypes.NONE) {
    return emptyMetadata;
  }

  if (event.type === WalletKitEventTypes.SESSION_PROPOSAL) {
    return "params" in event ? event.params?.proposer?.metadata : emptyMetadata;
  }

  if (event.type === WalletKitEventTypes.SESSION_REQUEST) {
    // It looks like the event.topic value for session request events is related
    // to the session key on activeSessions so let's try to use that first
    const matchedSessionByKey =
      "topic" in event ? activeSessions[event.topic] : null;
    if (matchedSessionByKey) {
      return matchedSessionByKey.peer?.metadata || emptyMetadata;
    }

    // If we don't have a match by session key, let's try to find a match by session topic
    const matchedSessionByTopic = Object.values(activeSessions).find(
      (session) => "topic" in event && event.topic === session.topic,
    );

    return matchedSessionByTopic?.peer?.metadata || emptyMetadata;
  }

  return emptyMetadata;
}

/**
 * Hook for retrieving dApp metadata from WalletKit events.
 * Extracts metadata from session proposals and requests, falling back to empty metadata if none is found.
 *
 * The hook handles different types of events:
 * - Session proposals: Gets metadata from the proposer
 * - Session requests: Gets metadata from the active session
 * - None/other events: Returns empty metadata
 *
 * @param {WalletKitEvent | null} event - The WalletKit event to extract metadata from
 * @returns {CoreTypes.Metadata | null} The dApp metadata or null if no event is provided
 *
 * @example
 * ```tsx
 * const metadata = useDappMetadata(event);
 * if (metadata) {
 *   console.log(metadata.name); // dApp name
 *   console.log(metadata.url);  // dApp URL
 * }
 * ```
 */
export const useDappMetadata = (
  event: WalletKitEvent | null,
): CoreTypes.Metadata | null => {
  const activeSessions = useWalletKitStore((state) => state.activeSessions);

  // Let's use a key string to avoid re-rendering the list when
  // any random property of the activeSessions objects is updated
  const activeSessionsKey = useMemo(
    () => Object.keys(activeSessions).join(","),
    [activeSessions],
  );

  const dappMetadata = useMemo(
    () => getDappMetadataFromEvent(event, activeSessions),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [event, activeSessionsKey],
  );

  return dappMetadata;
};
