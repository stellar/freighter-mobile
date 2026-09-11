import type { DappRequest } from "config/dappRequest";
import { ActiveAccount } from "ducks/auth";
import { useProtocolsStore } from "ducks/protocols";
import { findMatchedProtocol, getDisplayHost } from "helpers/protocols";
import { useMemo } from "react";

/**
 * Resolves display metadata (name, favicon, domain) for the requesting dApp.
 * Returns null if required data is not yet available — callers should render null in that case.
 */
export const useDappHeader = (
  requestEvent: DappRequest | null,
  account: ActiveAccount | null,
) => {
  const { protocols } = useProtocolsStore();
  const dappMetadata = requestEvent?.metadata;
  const requestOrigin = requestEvent?.origin;

  const matchedProtocol = useMemo(
    () =>
      findMatchedProtocol({
        protocols,
        searchUrl: requestOrigin || "",
      }),
    [protocols, requestOrigin],
  );

  if (!dappMetadata || !account) return null;

  return {
    dAppDomain: getDisplayHost(requestOrigin || dappMetadata.url || ""),
    dAppName: matchedProtocol?.name ?? dappMetadata.name,
    dAppFavicon: matchedProtocol?.iconUrl ?? dappMetadata.icons[0],
  };
};
