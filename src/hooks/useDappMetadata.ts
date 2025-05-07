/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  DappMetadata,
  useWalletKitStore,
  WalletKitEvent,
  WalletKitEventTypes,
} from "ducks/walletKit";
import { useMemo } from "react";

const emptyMetadata: DappMetadata = {
  name: "",
  description: "",
  url: "",
  icons: [],
};

export const useDappMetadata = (
  event: WalletKitEvent | null,
): DappMetadata | null => {
  const activeSessions = useWalletKitStore((state) => state.activeSessions);

  // Let's use a key string to avoid re-rendering the list when
  // any random property of the activeSessions objects is updated
  const activeSessionsKey = useMemo(
    () => Object.keys(activeSessions).join(","),
    [activeSessions],
  );

  const dappMetadata = useMemo(() => {
    if (!event) {
      return null;
    }

    if (event.type === WalletKitEventTypes.NONE) {
      return emptyMetadata;
    }

    if (event.type === WalletKitEventTypes.SESSION_PROPOSAL) {
      return "params" in event
        ? event.params?.proposer?.metadata
        : emptyMetadata;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, activeSessionsKey]);

  return dappMetadata;
};
