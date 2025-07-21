/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { CoreTypes } from "@walletconnect/types";
import {
  WalletKitEvent,
  WalletKitEventTypes,
  WalletKitSessionRequest,
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
 * Pure utility to extract dApp metadata from a WalletKit event or session request.
 */
export function extractDappMetadata(
  eventOrRequest: WalletKitEvent | WalletKitSessionRequest | null,
): CoreTypes.Metadata {
  if (!eventOrRequest) return emptyMetadata;

  if ("type" in eventOrRequest) {
    const event = eventOrRequest;
    if (event.type === WalletKitEventTypes.NONE) {
      return emptyMetadata;
    }

    if (event.type === WalletKitEventTypes.SESSION_PROPOSAL) {
      return "params" in event
        ? event.params?.proposer?.metadata
        : emptyMetadata;
    }

    if (event.type === WalletKitEventTypes.SESSION_REQUEST) {
      const maybeMetadata = (
        event as unknown as {
          params?: { request?: { params?: { metadata?: unknown } } };
        }
      ).params?.request?.params?.metadata;
      if (maybeMetadata && typeof maybeMetadata === "object") {
        return maybeMetadata as CoreTypes.Metadata;
      }

      const proposerMetadata = (
        event as unknown as { params?: { proposer?: { metadata?: unknown } } }
      ).params?.proposer?.metadata;
      if (proposerMetadata && typeof proposerMetadata === "object") {
        return proposerMetadata as CoreTypes.Metadata;
      }

      return emptyMetadata;
    }

    return emptyMetadata;
  }

  // If it's a WalletKitSessionRequest
  const maybeMetadata = (
    eventOrRequest as unknown as {
      params?: { request?: { params?: { metadata?: unknown } } };
    }
  ).params?.request?.params?.metadata;
  if (maybeMetadata && typeof maybeMetadata === "object") {
    return maybeMetadata as CoreTypes.Metadata;
  }

  const proposerMetadata = (
    eventOrRequest as unknown as {
      params?: { proposer?: { metadata?: unknown } };
    }
  ).params?.proposer?.metadata;
  if (proposerMetadata && typeof proposerMetadata === "object") {
    return proposerMetadata as CoreTypes.Metadata;
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
): CoreTypes.Metadata | null =>
  useMemo(() => extractDappMetadata(event), [event]);
