import { BottomSheetModal } from "@gorhom/bottom-sheet";
import blendIcon from "assets/logos/blend-icon.png";
import { TokenIcon } from "components/TokenIcon";
import {
  formatCompactUsd,
  formatRate,
  getPoolDescriptionKey,
} from "components/screens/EarnScreen/helpers";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { BlendCatalogPool, BlendCatalogReserve } from "config/blendTypes";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { Token } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { getNativeContractDetails } from "helpers/soroban";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { Image, TouchableOpacity, View } from "react-native";

export interface PoolDetailsBottomSheetProps {
  pool: BlendCatalogPool | null;
  bottomSheetModalRef?: React.RefObject<BottomSheetModal | null>;
}

interface PoolDetailRow {
  key: string;
  label: string;
  /** Either a plain string value, or a custom renderer (the "Accepted
   *  tokens" row's icon stack). Exactly one is provided. */
  value?: string;
  renderValue?: () => React.ReactNode;
  /** Explicit value color, e.g. the green "Current Net APY" figure. */
  valueColor?: string;
  testID?: string;
}

/** The design's own icon-stack width (`9448:19027`, 4 icons at a 12px pitch)
 *  -- more reserves than this collapse into a "+N" trailer rather than
 *  spilling the row onto a second line. */
const MAX_VISIBLE_RESERVE_ICONS = 4;

/**
 * Builds the `Token` shape `TokenIcon` expects from a Blend catalog reserve.
 *
 * Mirrors `EarnTokenRow`'s zero-balance fallback (there is no held balance to
 * read a real token shape from here either): native XLM is decided by
 * comparing the reserve's own contract address to the network's derived
 * native SAC -- never by code, since any issuer can mint a classic asset
 * coded "XLM".
 */
const reserveToToken = (
  reserve: BlendCatalogReserve,
  nativeContractId: string,
): Token =>
  reserve.assetId === nativeContractId
    ? { type: "native" as const, code: NATIVE_TOKEN_CODE as "XLM" }
    : {
        code: reserve.symbol || `${reserve.assetId.slice(0, 4)}…`,
        issuer: { key: reserve.assetId },
      };

/**
 * Renders one `PoolDetailRow[]` inside a rounded card, with a hairline
 * divider between rows (never after the last one) -- shared by both stat
 * cards (design node `9448:19005` / `9448:19023`).
 */
const PoolDetailsCard: React.FC<{ rows: PoolDetailRow[] }> = ({ rows }) => (
  <View className="rounded-[16px] bg-background-tertiary px-4">
    {rows.map((row, index) => (
      <View key={row.key}>
        <View className="flex-row items-center justify-between py-3">
          <Text md medium secondary>
            {row.label}
          </Text>
          {row.renderValue ? (
            row.renderValue()
          ) : (
            <Text md medium primary color={row.valueColor} testID={row.testID}>
              {row.value}
            </Text>
          )}
        </View>
        {index < rows.length - 1 && (
          <View className="h-px bg-border-primary w-full" />
        )}
      </View>
    ))}
  </View>
);

/**
 * Content for the Earn pool-details sheet. Previously presented from
 * `EarnTokenPickerScreen`'s header info button, which was never in the
 * design and has been removed there. Now triggered from the amount screen's
 * `PoolCard` chevron (design node `9448:29157`/`9448:18518`) -- the design's
 * only route into this sheet -- mirroring the extension's
 * `EarnAmount/PoolCard.tsx` `onOpenDetails`.
 *
 * Modeled on `XlmReserveBottomSheet`: pure content (the caller wraps it in
 * `components/BottomSheet` and owns the modal ref); `bottomSheetModalRef` is
 * used here for both the close button and the bottom "Close" CTA.
 *
 * Structure follows the render (`9448:18518`) rather than the raw 360×600
 * popup geometry verbatim, per the design owner's ratios-of-canvas rule:
 * header (pool artwork + name/"by Blend" + close) -> "Description" eyebrow +
 * prose -> "Pool Details" eyebrow -> two stat cards -> full-width "Close"
 * CTA.
 */
export const PoolDetailsBottomSheet: React.FC<PoolDetailsBottomSheetProps> = ({
  pool,
  bottomSheetModalRef,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { network } = useAuthenticationStore();

  const handleClose = () => {
    bottomSheetModalRef?.current?.dismiss();
  };

  // Guards a race where the sheet is presented before (or after) the pool
  // has resolved — e.g. a stale ref call while useEarnTokens is still
  // loading. The wrapping BottomSheet keeps working; there's simply nothing
  // to render here.
  if (!pool) {
    return null;
  }

  // getPoolDescriptionKey's return is deliberately widened to `string | null`
  // (Task 7) so the pool-id map can grow without narrowing callers — but that
  // means it can't type-check against i18next's literal key union the way a
  // hardcoded key can. The cast below is scoped to exactly this one dynamic
  // lookup; every other `t(...)` call in this file uses a literal key and is
  // fully type-checked.
  const descriptionKey = getPoolDescriptionKey(pool.id);
  const description = descriptionKey ? t(descriptionKey as never) : null;

  const nativeContractId = getNativeContractDetails(network).contract;
  const visibleReserves = pool.reserves.slice(0, MAX_VISIBLE_RESERVE_ICONS);
  const overflowReserveCount = pool.reserves.length - visibleReserves.length;

  const statRows: PoolDetailRow[] = [
    {
      key: "lendingInterest",
      label: t("earnPoolDetails.lendingInterest"),
      value: formatRate(pool.interestApy),
      testID: "pool-details-lendingInterest",
    },
    {
      key: "currentNetApy",
      label: t("earnPoolDetails.currentNetApy"),
      value: formatRate(pool.netApy),
      // Exact hex match for this row's Figma fill (`Colors/Green/10`,
      // `#3cb179`) -- confirmed against the node's own variable, not the
      // `#4cc38a` figure recorded in the drift doc's visual notes for this
      // sheet (that shade belongs to a *different* green variable used on
      // the Review sheet's own "Current APY" row, not this one). SDS
      // `Badge`'s "success" variant resolves to lime and is wrong for this
      // green, per the parallel correction on `EarnTokenRow`'s APY pill —
      // this is plain text, not a pill, so it goes through `Text`'s `color`
      // prop directly rather than `Badge`.
      valueColor: themeColors.green[10],
      testID: "pool-details-currentNetApy",
    },
  ];

  const detailRows: PoolDetailRow[] = [
    {
      key: "acceptedTokens",
      label: t("earnPoolDetails.acceptedTokens"),
      renderValue: () =>
        pool.reserves.length === 0 ? (
          // Empty reserve list: nothing resolved yet (e.g. a pool row built
          // before `useEarnTokens` populates it). Same "unavailable" signal
          // as every other null figure on this sheet, not a bare blank.
          <Text md medium primary testID="pool-details-acceptedTokens">
            --
          </Text>
        ) : (
          <View
            className="flex-row items-center"
            testID="pool-details-acceptedTokens"
          >
            <View className="flex-row items-center">
              {visibleReserves.map((reserve, index) => (
                <View
                  key={reserve.assetId}
                  className={
                    index === 0 ? "rounded-full" : "rounded-full -ml-[4px]"
                  }
                >
                  <TokenIcon
                    token={reserveToToken(reserve, nativeContractId)}
                    size="sm"
                  />
                </View>
              ))}
            </View>
            {overflowReserveCount > 0 && (
              <View className="ml-[4px]">
                <Text
                  xs
                  medium
                  secondary
                  testID="pool-details-acceptedTokens-overflow"
                >
                  {`+${overflowReserveCount}`}
                </Text>
              </View>
            )}
          </View>
        ),
    },
    {
      key: "supplied",
      label: t("earnPoolDetails.supplied"),
      value: formatCompactUsd(pool.suppliedUsd),
      testID: "pool-details-supplied",
    },
    {
      key: "borrowed",
      label: t("earnPoolDetails.borrowed"),
      value: formatCompactUsd(pool.borrowedUsd),
      testID: "pool-details-borrowed",
    },
    {
      // The backend does not serve `backstop_usd` for any pool today (see
      // `BlendCatalogPool.backstopUsd`'s own comment and `mapCatalogPool`),
      // so this reads "--" in practice for every live pool right now. The
      // row itself still renders — matching the design's structure and this
      // app's "null means unavailable, never silently omitted" rule — and
      // will start showing a real figure automatically the day the backend
      // adds the field, with no further changes here.
      key: "backstop",
      label: t("earnPoolDetails.backstop"),
      value: formatCompactUsd(pool.backstopUsd),
      testID: "pool-details-backstop",
    },
  ];

  return (
    <View className="gap-[24px]">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center flex-1 mr-4">
          {/* The real Blend mark, shared with `PoolCard` and the token
              picker's badge. This was a lilac `InfoCircle` placeholder while
              no artwork existed, sized 28 to match `PoolCard`'s identical
              stand-in; now that the asset exists each surface takes its own
              designed size, so this follows this sheet's own header-icon
              geometry (`9448:18861`) at 32 rather than the amount screen's
              40. */}
          <Image
            source={blendIcon}
            className="size-8 rounded"
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
          <View className="ml-4 flex-1">
            {pool.name && (
              <Text md medium primary numberOfLines={1}>
                {pool.name}
              </Text>
            )}
            <Text sm regular secondary numberOfLines={1}>
              {t("earnPoolDetails.byBlend")}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleClose} testID="pool-details-close">
          <Icon.X
            color={themeColors.foreground.secondary}
            size={22}
            circle
            circleBorder={themeColors.background.tertiary}
            circleBackground={themeColors.background.tertiary}
          />
        </TouchableOpacity>
      </View>

      {description && (
        <View className="gap-[6px]">
          <Text xs secondary>
            {t("earnPoolDetails.description")}
          </Text>
          <Text sm regular secondary testID="pool-details-description">
            {description}
          </Text>
        </View>
      )}

      <View className="gap-[12px]">
        <Text xs secondary>
          {t("earnPoolDetails.poolDetails")}
        </Text>
        <PoolDetailsCard rows={statRows} />
        <PoolDetailsCard rows={detailRows} />
      </View>

      <Button
        secondary
        xl
        isFullWidth
        onPress={handleClose}
        testID="pool-details-close-cta"
      >
        {t("common.close")}
      </Button>
    </View>
  );
};

export default PoolDetailsBottomSheet;
