import { CoreTypes, SessionTypes } from "@walletconnect/types";
import type { ConnectedDapp } from "components/screens/HomeScreen/ConnectedAppsBottomSheet";
import { DiscoverProtocol } from "config/types";
import { findMatchedProtocol, getDisplayHost } from "helpers/protocols";

/**
 * The longest values kept from a dApp's metadata. Real dApps stay well under
 * every one of them.
 */
export const DAPP_METADATA_LIMITS = {
  NAME: 100,
  DESCRIPTION: 500,
  URL: 2048,
  ICON_URL: 2048,
  ICONS: 5,
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Returns a dApp's metadata with the types and lengths the wallet's UI
 * expects.
 *
 * The dApp writes its own metadata, so any field can arrive with another type
 * or any length. This is the single place where it becomes safe to display:
 * read dApp metadata through it rather than from the session or proposal.
 *
 * - `url` is kept only if it is a string of at most `URL` characters. A longer
 *   one is dropped rather than truncated, because a cut URL is a different
 *   URL.
 * - `name` is cut to `NAME` characters. A missing, blank or non-string name
 *   becomes the host of `url`, or an empty string, cut the same way.
 * - `description` is cut to `DESCRIPTION` characters.
 * - `icons` keeps its string entries of at most `ICON_URL` characters, up to
 *   `ICONS` of them.
 *
 * @param metadata - The metadata exactly as the dApp sent it
 * @returns Metadata holding only `name`, `description`, `url` and `icons`
 */
export const sanitizeDappMetadata = (metadata: unknown): CoreTypes.Metadata => {
  if (!isRecord(metadata)) {
    return { name: "", description: "", url: "", icons: [] };
  }

  const { name, description, url, icons } = metadata;

  const cleanUrl =
    typeof url === "string" && url.length <= DAPP_METADATA_LIMITS.URL
      ? url
      : "";

  const cappedName =
    typeof name === "string" ? name.slice(0, DAPP_METADATA_LIMITS.NAME) : "";

  return {
    // A host can be far longer than a name, so the fallback is cut as well.
    name:
      cappedName.trim() !== ""
        ? cappedName
        : (getDisplayHost(cleanUrl) ?? "").slice(0, DAPP_METADATA_LIMITS.NAME),
    description:
      typeof description === "string"
        ? description.slice(0, DAPP_METADATA_LIMITS.DESCRIPTION)
        : "",
    url: cleanUrl,
    icons: Array.isArray(icons)
      ? icons
          .filter(
            (icon): icon is string =>
              typeof icon === "string" &&
              icon.length <= DAPP_METADATA_LIMITS.ICON_URL,
          )
          .slice(0, DAPP_METADATA_LIMITS.ICONS)
      : [],
  };
};

/**
 * Builds the Connected Apps row for a stored session from its normalized
 * metadata. A dApp whose url matches a listed protocol shows that protocol's
 * name and icon.
 *
 * @param session - A stored WalletConnect session
 * @param protocols - The listed protocols
 * @returns The row's topic, name and icon
 */
export const toConnectedDapp = (
  session: SessionTypes.Struct,
  protocols: DiscoverProtocol[],
): ConnectedDapp => {
  const metadata = sanitizeDappMetadata(session.peer?.metadata);
  const matchedProtocol = findMatchedProtocol({
    protocols,
    searchUrl: metadata.url,
  });

  return {
    topic: session.topic,
    name: matchedProtocol?.name ?? metadata.name,
    favicon: matchedProtocol?.iconUrl ?? metadata.icons[0],
  };
};
