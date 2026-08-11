/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
import { Horizon } from "@stellar/stellar-sdk";
import { logos } from "assets/logos";
import { CollectibleImage } from "components/CollectibleImage";
import { TokenIcon } from "components/TokenIcon";
import { TransactionType } from "components/screens/HistoryScreen/types";
import Icon from "components/sds/Icon";
import { Token as TokenComponent } from "components/sds/Token";
import { Text } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE, OPERATION_TYPES } from "config/constants";
import { Token, TokenTypeWithCustomToken } from "config/types";
import {
  HistoryEntry,
  ResolvedToken,
  RowIconDescriptor,
  SettingsGlyph,
} from "helpers/history/v2/model";
import { SorobanTokenInterface } from "helpers/soroban";
import { ThemeColors } from "hooks/useColors";
import { t } from "i18next";
import { camelCase } from "lodash";
import React from "react";
import { View } from "react-native";

/**
 * Renders icon component for history items
 */
export const renderIconComponent = ({
  iconComponent,
  themeColors,
}: {
  iconComponent?: React.ReactElement | null;
  themeColors: ThemeColors;
}) => {
  if (iconComponent) {
    return iconComponent;
  }

  return (
    <Icon.User01 circle color={themeColors.foreground.primary} size={26} />
  );
};

/**
 * Renders action icon for history items
 */
export const renderActionIcon = ({
  actionIcon,
  themeColors,
}: {
  actionIcon?: React.ReactElement | null;
  themeColors: ThemeColors;
}) => {
  if (actionIcon) {
    return actionIcon;
  }

  return <Icon.Wallet03 color={themeColors.foreground.primary} size={16} />;
};

/**
 * Creates operation description string
 */
export const createOperationString = (
  type: string,
  operationCount: number,
): string => {
  const operationType = camelCase(type) as keyof typeof OPERATION_TYPES;
  const opTypeStr =
    OPERATION_TYPES[operationType] ||
    t("history.transactionHistory.transaction");

  return `${opTypeStr}${
    operationCount > 1
      ? ` + ${operationCount - 1} ${t("history.transactionHistory.ops")}`
      : ""
  }`;
};

/**
 * Determines if the operation is a create account operation
 */
export const isCreateAccountOperation = (type: string): boolean =>
  type === Horizon.HorizonApi.OperationResponseType.createAccount;

/**
 * Determines if the operation is a change trust operation
 */
export const isChangeTrustOperation = (type: string): boolean =>
  type === Horizon.HorizonApi.OperationResponseType.changeTrust;

/**
 * Determines if the operation is a Soroban invoke host function
 */
export const isSorobanInvokeHostFunction = (typeI: number): boolean =>
  typeI === 24;

/**
 * Determines if the Soroban operation is a token mint
 */
export const isSorobanTokenMint = (fnName: string | undefined): boolean =>
  fnName === SorobanTokenInterface.mint;

/**
 * Determines if the Soroban operation is a token transfer
 */
export const isSorobanTokenTransfer = (fnName: string | undefined): boolean =>
  fnName === SorobanTokenInterface.transfer;

/**
 * Determines whether the memo field should be displayed in the History
 * details UI for a transaction.
 *
 * The memo is shown only for classic Send/Receive operations (Payment and
 * CreateAccount) and is hidden when the destination is a muxed address,
 * since the destination already encodes memo-like data.
 */
export const shouldShowMemo = (
  transactionType: TransactionType,
  isDestinationMuxed: boolean,
): boolean => {
  const isClassicSendReceive =
    transactionType === TransactionType.PAYMENT ||
    transactionType === TransactionType.CREATE_ACCOUNT;

  return isClassicSendReceive && !isDestinationMuxed;
};

// =============================================================================
// v2 descriptor icon renderers
//
// THROWAWAY (see mappers/v2Entry.tsx): turn a v2 RowIconDescriptor /
// secondaryIcon value into the same React nodes the v1 per-type mappers
// (payment.tsx, swap.tsx, changeTrust.tsx, createAccount.tsx, failed.tsx,
// soroban.tsx) already build for the equivalent concept, reusing their exact
// components/props rather than inventing new ones. Phase B deletes this
// section along with the rest of the adapter.
//
// None of these run inside a component's render pass directly — they're
// called from a plain mapper function and the resulting elements are handed
// to HistoryItem, which mounts them normally — so Icon.* here falls back to
// its own default (non-theme-aware) color instead of the explicit
// `themeColors.foreground.primary` the v1 mappers pass, since no ThemeColors
// value is available at this call site. Acceptable for a throwaway adapter;
// Phase B's real row component can thread real theme colors through.
// =============================================================================

/**
 * Exhaustiveness guard for the switches below (and, by import, for
 * stateChangeItems.tsx's card-kind dispatcher): `value`'s type is `never`
 * only when every other case of the switch has already been handled, so
 * this line fails to typecheck the moment a new union member is added
 * without a matching case — the "yarn lint:ts catches a missing arm"
 * behavior the task calls for. Also satisfies eslint's default-case /
 * consistent-return rules, which a bare "no default" switch does not.
 *
 * `label` identifies which dispatcher hit this — this file's own switches
 * (icon renderers) and stateChangeItems.tsx's card dispatcher both use it, so
 * a single generic message would leave the log ambiguous about which one
 * fired. Defaults to this file's original wording so its three existing
 * call sites need no change.
 */
export const assertNever = (value: never, label = "v2 icon renderer"): null => {
  // Dev-time signal only; the type system already prevents reaching here for
  // any real known union value, so this can't fire in production — only if a
  // new union member is added and the caller's switch isn't updated to match
  // (in which case tsc, not this log, is the real guard).
  // eslint-disable-next-line no-console -- see comment above
  console.error(`Unhandled case in ${label}:`, value);
  return null;
};

const resolvedTokenToTokenProp = (token: ResolvedToken): Token => {
  if (token.code === NATIVE_TOKEN_CODE && !token.issuer) {
    return {
      type: TokenTypeWithCustomToken.NATIVE,
      code: NATIVE_TOKEN_CODE,
    } as Token;
  }

  return {
    code: token.code,
    type: TokenTypeWithCustomToken.CUSTOM_TOKEN,
    issuer: { key: token.issuer ?? token.contractId ?? "" },
  };
};

/** Single asset row icon — mirrors payment.tsx / changeTrust.tsx's TokenIcon,
 *  passing the icon URL the v2 token resolver already resolved. */
const renderSingleAssetIcon = (token: ResolvedToken): React.ReactElement => (
  <TokenIcon
    token={resolvedTokenToTokenProp(token)}
    iconUrl={token.icon ?? undefined}
    size="lg"
  />
);

/** Two-token (swap) row icon — mirrors swap.tsx's overlapping Token pair. */
const renderSwapPairIcon = (tokens: [ResolvedToken, ResolvedToken]) => {
  const toSource = (token: ResolvedToken) => ({
    altText: `${token.code} logo`,
    image:
      token.code === NATIVE_TOKEN_CODE && !token.issuer
        ? logos.stellar
        : (token.icon ?? undefined),
    renderContent: () => (
      <Text xs secondary semiBold>
        {token.code.substring(0, 2)}
      </Text>
    ),
  });

  return (
    <TokenComponent
      size="lg"
      variant="swap"
      sourceOne={toSource(tokens[0])}
      sourceTwo={toSource(tokens[1])}
    />
  );
};

/**
 * Three-or-more-token row icon: the first token's icon with a "+N" count
 * badge, N = tokens.length - 1. No v1 mapper renders a stacked-count badge,
 * so this composes existing primitives (View/Text) in the same
 * absolute-positioned-overlay style TokenIconWithBadge uses for its security
 * badge — no new icon asset, just a different overlay content.
 */
const renderStackedAssetIcon = (
  tokens: ResolvedToken[],
): React.ReactElement => (
  <View className="relative">
    {renderSingleAssetIcon(tokens[0])}
    <View className="absolute bottom-0 right-0 min-w-[18px] h-[18px] px-1 rounded-full bg-background-tertiary border border-border-primary items-center justify-center">
      <Text xs secondary semiBold>
        {`+${tokens.length - 1}`}
      </Text>
    </View>
  </View>
);

const renderAssetRowIcon = (
  tokens: ResolvedToken[],
): React.ReactElement | null => {
  if (tokens.length >= 3) {
    return renderStackedAssetIcon(tokens);
  }
  if (tokens.length === 2) {
    return renderSwapPairIcon([tokens[0], tokens[1]]);
  }
  if (tokens.length === 1) {
    return renderSingleAssetIcon(tokens[0]);
  }
  // Not expected per the model's own contract (1 token minimum), but avoids
  // a crash if it ever occurs.
  return null;
};

/** Protocol row icon — reuses soroban.tsx's rounded remote-image wrapper
 *  (there built for collectible images) for the protocol's logo URL. */
const renderProtocolIcon = (src: string): React.ReactElement => (
  <View className="w-[40px] h-[40px] rounded-[8px] bg-background-tertiary overflow-hidden">
    <CollectibleImage imageUri={src} placeholderIconSize={25} />
  </View>
);

/**
 * Maps each config-change glyph to a distinct icon, as the extension's
 * HistoryRowIcon does, so settings changes stay distinguishable.
 *
 * GAP: v1 has no combined "settings" row-icon concept — setOptions,
 * manageData, allowTrust, and the other account-configuration operations all
 * fall through to mappers/default.tsx's generic mapper, which renders no
 * dedicated row icon (`IconComponent: null`). None of the 8 glyphs below has
 * a v1 precedent to reuse, so every case falls back to that same `null`,
 * which renderIconComponent's caller (HistoryItem) then renders as the
 * app-wide unknown-icon fallback (Icon.User01). Phase B should give each
 * glyph its own icon.
 */
const settingsGlyphIcon = (glyph: SettingsGlyph): React.ReactElement | null => {
  switch (glyph) {
    case "signer":
    case "threshold":
    case "data":
    case "domain":
    case "flag":
    case "allowance":
    case "claimable":
    case "generic":
      return null;
    default:
      return assertNever(glyph);
  }
};

/** Turns a v2 RowIconDescriptor into the row's leading icon element. */
export const renderRowIcon = (
  descriptor: RowIconDescriptor,
): React.ReactElement | null => {
  switch (descriptor.type) {
    case "asset":
      return renderAssetRowIcon(descriptor.tokens);
    case "protocol":
      return renderProtocolIcon(descriptor.src);
    case "contract":
      // mirrors soroban.tsx's generic contract-interaction row icon
      return <Icon.FileCode02 size={26} circle />;
    case "settings":
      return settingsGlyphIcon(descriptor.glyph);
    case "failed":
      // mirrors failed.tsx's row icon
      return <Icon.Wallet03 size={26} circle />;
    case "account":
      // create and merge share createAccount.tsx's funding-view icon: v1 has
      // no distinct "merge" treatment (see the Step 4 inventory in the task
      // report — grepping the mappers turns up no account-merge handling at
      // all), so both variants render the same native-XLM TokenIcon.
      return (
        <TokenIcon
          token={
            {
              type: TokenTypeWithCustomToken.NATIVE,
              code: NATIVE_TOKEN_CODE,
            } as Token
          }
          size="lg"
        />
      );
    default:
      return assertNever(descriptor);
  }
};

/** Turns a v2 HistoryEntry's secondaryIcon into the row's trailing icon. */
export const renderSecondaryIcon = (
  icon: HistoryEntry["secondaryIcon"],
): React.ReactElement | null => {
  if (!icon) {
    return null;
  }

  switch (icon) {
    case "sent":
      // mirrors payment.tsx's sent action icon
      return <Icon.ArrowCircleUp size={16} />;
    case "received":
      // mirrors payment.tsx's received action icon
      return <Icon.ArrowCircleDown size={16} />;
    case "swap":
      // mirrors swap.tsx's action icon
      return <Icon.RefreshCw05 size={16} />;
    case "add":
      // mirrors changeTrust.tsx / createAccount.tsx's "added" action icon
      return <Icon.PlusCircle size={16} />;
    case "remove":
      // mirrors changeTrust.tsx's "removed" action icon
      return <Icon.MinusCircle size={16} />;
    case "contract":
      // mirrors soroban.tsx's contract action icon
      return <Icon.FileCode02 size={16} />;
    case "failed":
      // mirrors failed.tsx's action icon exactly, themeColor included
      return <Icon.XCircle size={16} themeColor="red" />;
    case "globe":
    case "settings":
      // GAP: no v1 mapper renders a domain/"globe" action icon or a
      // combined-settings one (same absence as settingsGlyphIcon above) —
      // falls back to null, which renderActionIcon's caller renders as the
      // ambient default (Icon.Wallet03). Phase B should give both their own
      // icon.
      return null;
    default:
      return assertNever(icon);
  }
};
