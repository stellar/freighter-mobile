/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { CoreTypes } from "@walletconnect/types";
import {
  WalletKitEvent,
  WalletKitEventTypes,
  useWalletKitStore,
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
 */
export function extractDappMetadata(
  event: WalletKitEvent | null,
  activeSessions: Record<
    string,
    { peer?: { metadata?: CoreTypes.Metadata }; topic?: string }
  > = {},
): CoreTypes.Metadata | null {
  if (!event) {
    return null;
  }

  if (event.type === WalletKitEventTypes.NONE) {
    return emptyMetadata;
  }

  if (event.type === WalletKitEventTypes.SESSION_PROPOSAL) {
    return "params" in event
      ? (event.params?.proposer?.metadata ?? emptyMetadata)
      : emptyMetadata;
  }

  if (event.type === WalletKitEventTypes.SESSION_REQUEST) {
    // Try to find by event.topic as key
    if ("topic" in event && event.topic) {
      const matchedSessionByKey = activeSessions[event.topic];
      if (
        matchedSessionByKey &&
        matchedSessionByKey.peer &&
        matchedSessionByKey.peer.metadata
      ) {
        return matchedSessionByKey.peer.metadata;
      }

      // Try to find by session.topic
      const matchedSessionByTopic = Object.values(activeSessions).find(
        (session) => session.topic === event.topic,
      );

      if (
        matchedSessionByTopic &&
        matchedSessionByTopic.peer &&
        matchedSessionByTopic.peer.metadata
      ) {
        return matchedSessionByTopic.peer.metadata;
      }
    }

    return emptyMetadata;
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

  return useMemo(
    () => extractDappMetadata(event, activeSessions),
    [event, activeSessions],
  );
};
