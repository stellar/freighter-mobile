import { BottomSheetModal } from "@gorhom/bottom-sheet";
import blendIcon from "assets/logos/blend-icon.png";
import { BottomSheetCloseButton } from "components/BottomSheetHeader";
import { TokenIcon } from "components/TokenIcon";
import {
  EarnDetailsCard,
  EarnDetailsRow,
} from "components/screens/EarnScreen/components/EarnDetailsCard";
import {
  formatCompactUsd,
  formatRate,
} from "components/screens/EarnScreen/helpers";
import { getPoolDisplayName } from "components/screens/EarnScreen/helpers/poolDisplayName";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { BLEND_LENDING_DOCS_URL } from "config/blend";
import { BlendCatalogPool } from "config/blendTypes";
import { logger } from "config/logger";
import { Balance, Token } from "config/types";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import { useInAppBrowser } from "hooks/useInAppBrowser";
import React, { useCallback } from "react";
import { Image, TouchableOpacity, View } from "react-native";

export interface PoolDetailsBottomSheetProps {
  pool: BlendCatalogPool | null;
  /** The deposit asset's headline APY, shown as "Deposit APY". */
  apy: number | null;
  /** The deposit asset, drawn as a badge on the pool's icon. */
  token?: Balance | Token;
  bottomSheetModalRef?: React.RefObject<BottomSheetModal | null>;
}

/** The pool icon is 40 inside a 48 box; the token badge (24) overlaps its
 * bottom-right corner, as the design draws it. */
const POOL_ICON_BOX = 48;
const POOL_ICON_SIZE = 40;
const TOKEN_BADGE_POSITION = { left: 32, top: 26 };

/** A secondary title above an `EarnDetailsCard`. */
const TitledDetailsCard: React.FC<{
  title: string;
  rows: EarnDetailsRow[];
}> = ({ title, rows }) => (
  <View className="gap-[8px]">
    <Text sm medium secondary>
      {title}
    </Text>
    <EarnDetailsCard rows={rows} />
  </View>
);

/**
 * Content for the Earn pool details sheet, opened from the amount screen's
 * pool card: the pool's identity, a description with a link to Blend's
 * lending docs, the deposit asset's current yield and the pool's liquidity.
 *
 * Pure content: the caller wraps it in `components/BottomSheet` and owns the
 * modal ref, which the header X dismisses.
 */
export const PoolDetailsBottomSheet: React.FC<PoolDetailsBottomSheetProps> = ({
  pool,
  apy,
  token,
  bottomSheetModalRef,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { open: openInAppBrowser } = useInAppBrowser();

  const handleClose = () => {
    bottomSheetModalRef?.current?.dismiss();
  };

  const handleViewPoolDetails = useCallback(() => {
    openInAppBrowser(BLEND_LENDING_DOCS_URL).catch((err) =>
      logger.error("PoolDetailsBottomSheet", "Failed to open Blend docs", err),
    );
  }, [openInAppBrowser]);

  // Guards a race where the sheet is presented before (or after) the pool
  // has resolved. The wrapping BottomSheet keeps working; there's simply
  // nothing to render here.
  if (!pool) {
    return null;
  }

  const yieldRows: EarnDetailsRow[] = [
    {
      key: "depositApy",
      label: t("earnPoolDetails.depositApy"),
      value: formatRate(apy),
      valueColor: apy === null ? undefined : themeColors.green[10],
      isEmphasized: true,
      testID: "pool-details-depositApy",
    },
  ];

  // A null USD figure means the pool oracle has no fresh price, so it reads
  // "--" rather than a misleading zero.
  const liquidityRows: EarnDetailsRow[] = [
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
      key: "backstop",
      label: t("earnPoolDetails.backstop"),
      value: formatCompactUsd(pool.backstopUsd),
      testID: "pool-details-backstop",
    },
  ];

  return (
    <View className="gap-[24px]">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 flex-row items-center gap-[12px]">
          <View style={{ width: POOL_ICON_BOX, height: POOL_ICON_BOX }}>
            <Image
              source={blendIcon}
              className="rounded-full"
              style={{ width: POOL_ICON_SIZE, height: POOL_ICON_SIZE }}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
            {token && (
              <View className="absolute" style={TOKEN_BADGE_POSITION}>
                <TokenIcon token={token} size="md" />
              </View>
            )}
          </View>
          <View className="flex-1">
            {pool.name && (
              <Text xl medium primary numberOfLines={1}>
                {getPoolDisplayName(pool.name, t)}
              </Text>
            )}
            <Text sm medium secondary numberOfLines={1}>
              {t("earnPoolDetails.byBlend")}
            </Text>
          </View>
        </View>
        <BottomSheetCloseButton
          onPress={handleClose}
          testID="pool-details-close"
        />
      </View>

      {/* One description for every pool, as on the extension. Per-pool
          claims only hold for a specific deployment: "no admin" was true of
          the v2 Fixed pool, but the v2.1 pools have a contract admin. */}
      <View className="items-start gap-[8px]">
        <Text sm medium secondary>
          {t("earnPoolDetails.description")}
        </Text>
        <Text md regular primary testID="pool-details-description">
          {t("earnPoolDetails.poolDescription")}
        </Text>
        <TouchableOpacity
          onPress={handleViewPoolDetails}
          activeOpacity={0.7}
          accessibilityRole="link"
          className="flex-row items-center gap-[4px] pb-[8px]"
          testID="pool-details-view-pool-details"
        >
          <Text md semiBold color={themeColors.lilac[9]}>
            {t("earnPoolDetails.viewPoolDetails")}
          </Text>
          <Icon.LinkExternal01 size={16} color={themeColors.lilac[9]} />
        </TouchableOpacity>
      </View>

      <View className="gap-[16px]">
        <TitledDetailsCard
          title={t("earnPoolDetails.currentYield")}
          rows={yieldRows}
        />
        <TitledDetailsCard
          title={t("earnPoolDetails.poolLiquidity")}
          rows={liquidityRows}
        />
      </View>
    </View>
  );
};

export default PoolDetailsBottomSheet;
