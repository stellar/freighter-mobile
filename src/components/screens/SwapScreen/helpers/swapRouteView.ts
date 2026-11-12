import { StrKey } from "@stellar/stellar-sdk";
import { logos } from "assets/logos";
import BigNumber from "bignumber.js";
import { DestinationTokenDescriptor } from "components/screens/SwapScreen/helpers/types";
import { NATIVE_TOKEN_CODE } from "config/constants";
import {
  DiscoverProtocol,
  SwapRoute,
  Token,
  TokenTypeWithCustomToken,
} from "config/types";
import { isNativeAssetId, isNativeContract } from "helpers/assetIdentity";
import { truncateAddress } from "helpers/stellar";
import type { HeldBalanceItem } from "hooks/useBalancesList";
import type { ImageSourcePropType } from "react-native";
import { TokenListReponseItem } from "services/verified-token-lists/types";

/** A path row shows this many venue icons, then "+N". */
export const MAX_PATH_VENUE_ICONS = 3;

export interface SwapRouteToken {
  assetId: string;
  code: string;
  token: Token;
  iconUrl?: string;
}

export interface SwapRouteVenue {
  name: string;
  /** Undefined for a venue /protocols doesn't list: it gets a generic icon. */
  iconUrl?: string;
  /** A bundled logo; takes precedence over iconUrl. */
  iconSource?: ImageSourcePropType;
}

export interface SwapRoutePathView {
  /** "32%" ("100%" on a single path); null for a zero or invalid share. */
  share: string | null;
  /** One per hop, in order. */
  hopVenues: SwapRouteVenue[];
  /** Null when the hops carry no pool (classic): Horizon doesn't name one. */
  poolCount: number | null;
  /** hopVenues.length + 1 tokens: hopVenues[i] trades tokens[i] for tokens[i + 1]. */
  tokens: SwapRouteToken[];
}

export interface SwapRouteView {
  from: SwapRouteToken;
  to: SwapRouteToken;
  paths: SwapRoutePathView[];
  /** The distinct venues across all paths, in first-seen order. */
  providers: SwapRouteVenue[];
}

export const formatRouteShare = (share: string): string | null => {
  const fraction = new BigNumber(share);
  if (!fraction.isFinite() || fraction.lte(0)) return null;
  const percent = fraction.times(100);
  if (percent.lt(1)) return "<1%";
  return `${percent.integerValue(BigNumber.ROUND_HALF_UP).toFixed()}%`;
};

const STELLAR_DEX_VENUE = "stellar-dex";

const venueKey = (name: string) => name.trim().toLowerCase();

interface ResolveContext {
  balanceItems: HeldBalanceItem[];
  destination?: DestinationTokenDescriptor | null;
  tokenLists: TokenListReponseItem[];
  networkPassphrase?: string;
}

const resolveToken = (
  assetId: string,
  { balanceItems, destination, tokenLists, networkPassphrase }: ResolveContext,
): SwapRouteToken => {
  if (
    isNativeAssetId(assetId) ||
    (!!networkPassphrase && isNativeContract(assetId, networkPassphrase))
  ) {
    return {
      assetId,
      code: NATIVE_TOKEN_CODE,
      token: { type: "native", code: "XLM" },
    };
  }

  if (StrKey.isValidContract(assetId)) {
    const held = balanceItems.find(
      (b) => "contractId" in b && b.contractId === assetId,
    );
    const isDestination = destination?.issuer === assetId;
    const listed = tokenLists.find((t) => t.contract === assetId);
    const code =
      held?.tokenCode ??
      (isDestination ? destination.tokenCode : undefined) ??
      (listed?.code || undefined) ??
      truncateAddress(assetId);
    return {
      assetId,
      code,
      token: {
        type: TokenTypeWithCustomToken.CUSTOM_TOKEN,
        code,
        issuer: { key: assetId },
      },
      iconUrl:
        (isDestination ? destination.iconUrl : undefined) ?? listed?.icon,
    };
  }

  const [code, issuer = ""] = assetId.split(":");
  return {
    assetId,
    code,
    token: {
      type:
        code.length > 4
          ? TokenTypeWithCustomToken.CREDIT_ALPHANUM12
          : TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
      code,
      issuer: { key: issuer },
    },
    iconUrl:
      (destination?.id === assetId ? destination.iconUrl : undefined) ??
      tokenLists.find((t) => t.code === code && t.issuer === issuer)?.icon,
  };
};

/**
 * Display model for the Route sheet, from the route the swap uses. Null when
 * there is nothing to show, which hides the Route row.
 */
export const buildSwapRouteView = ({
  route,
  protocols,
  balanceItems,
  destination,
  tokenLists = [],
  networkPassphrase,
}: {
  route: SwapRoute | null | undefined;
  protocols: DiscoverProtocol[];
  balanceItems: HeldBalanceItem[];
  destination?: DestinationTokenDescriptor | null;
  /** Verified token lists: names and icons for unheld contract tokens. */
  tokenLists?: TokenListReponseItem[];
  /** Maps XLM's own contract to XLM. */
  networkPassphrase?: string;
}): SwapRouteView | null => {
  const paths = (route?.paths ?? []).filter((p) => p.hops.length > 0);
  if (paths.length === 0) return null;

  // First entry wins on a duplicate key, as on the extension.
  const protocolByVenue = new Map(
    [...protocols].reverse().map((p) => [venueKey(p.name), p]),
  );
  const toVenue = (name: string): SwapRouteVenue => {
    // Not in /protocols: listing it there would show it in Discovery.
    if (venueKey(name) === STELLAR_DEX_VENUE) {
      return { name: "Stellar DEX", iconSource: logos.stellar };
    }
    // The protocol list holds the display name, whatever casing routing sends.
    const listed = protocolByVenue.get(venueKey(name));
    return listed
      ? { name: listed.name, iconUrl: listed.iconUrl }
      : { name, iconUrl: undefined };
  };
  const context = { balanceItems, destination, tokenLists, networkPassphrase };

  const pathViews = paths.map((path) => ({
    share: formatRouteShare(path.share),
    hopVenues: path.hops.map((hop) => toVenue(hop.venue)),
    poolCount: path.hops.filter((hop) => hop.pool).length || null,
    tokens: [
      resolveToken(path.hops[0].from, context),
      ...path.hops.map((hop) => resolveToken(hop.to, context)),
    ],
  }));

  const providers = new Map<string, SwapRouteVenue>();
  pathViews.forEach((p) =>
    p.hopVenues.forEach((venue) => {
      if (!providers.has(venueKey(venue.name))) {
        providers.set(venueKey(venue.name), venue);
      }
    }),
  );

  const firstPath = pathViews[0];
  return {
    from: firstPath.tokens[0],
    to: firstPath.tokens[firstPath.tokens.length - 1],
    paths: pathViews,
    providers: [...providers.values()],
  };
};
