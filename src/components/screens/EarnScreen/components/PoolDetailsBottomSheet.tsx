import { BottomSheetModal } from "@gorhom/bottom-sheet";
import {
  formatCompactUsd,
  formatRate,
  getPoolDescriptionKey,
} from "components/screens/EarnScreen/helpers";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { BlendCatalogPool } from "config/blendTypes";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity, View } from "react-native";

export interface PoolDetailsBottomSheetProps {
  pool: BlendCatalogPool | null;
  bottomSheetModalRef?: React.RefObject<BottomSheetModal | null>;
}

interface PoolDetailRow {
  key: string;
  label: string;
  value: string;
}

/**
 * Content for the Earn pool-details sheet, presented from
 * `EarnTokenPickerScreen`'s header info button.
 *
 * Modeled on `XlmReserveBottomSheet`: pure content (the caller wraps it in
 * `components/BottomSheet` and owns the modal ref); `bottomSheetModalRef` is
 * used here only to dismiss via the close button.
 *
 * A Backstop figure is deliberately never rendered: the backend does not
 * serve `backstop_usd` for any pool yet (confirmed against the live
 * catalog), so there is nothing honest to show for it — not even "--",
 * which would misrepresent an omitted field as a checked-and-empty one.
 */
export const PoolDetailsBottomSheet: React.FC<PoolDetailsBottomSheetProps> = ({
  pool,
  bottomSheetModalRef,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

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

  // Null and undefined both mean "unavailable" to the UI (see
  // BlendCatalogPool's own `backstopUsd` comment) — but the row itself is
  // never rendered at all, so that distinction doesn't even reach here.
  //
  // getPoolDescriptionKey's return is deliberately widened to `string | null`
  // (Task 7) so the pool-id map can grow without narrowing callers — but that
  // means it can't type-check against i18next's literal key union the way a
  // hardcoded key can. The cast below is scoped to exactly this one dynamic
  // lookup; every other `t(...)` call in this file uses a literal key and is
  // fully type-checked.
  const descriptionKey = getPoolDescriptionKey(pool.id);
  const description = descriptionKey ? t(descriptionKey as never) : null;

  const rows: PoolDetailRow[] = [
    {
      key: "lendingInterest",
      label: t("earnPoolDetails.lendingInterest"),
      value: formatRate(pool.interestApy),
    },
    {
      key: "currentNetApy",
      label: t("earnPoolDetails.currentNetApy"),
      value: formatRate(pool.netApy),
    },
    {
      key: "totalSupplied",
      label: t("earnPoolDetails.totalSupplied"),
      value: formatCompactUsd(pool.suppliedUsd),
    },
    {
      key: "totalBorrowed",
      label: t("earnPoolDetails.totalBorrowed"),
      value: formatCompactUsd(pool.borrowedUsd),
    },
  ];

  return (
    <View className="gap-[24px]">
      <View className="flex-row items-center justify-between">
        <Icon.InfoCircle themeColor="lilac" withBackground square size={28} />
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

      <View className="gap-[8px]">
        {pool.name && (
          <Text xl medium>
            {pool.name}
          </Text>
        )}
        {description && (
          <Text sm regular secondary testID="pool-details-description">
            {description}
          </Text>
        )}
      </View>

      <View className="rounded-[16px] bg-background-tertiary px-4">
        {rows.map((row, index) => (
          <View key={row.key}>
            <View className="flex-row items-center justify-between py-3">
              <Text md medium secondary>
                {row.label}
              </Text>
              <Text md medium primary testID={`pool-details-${row.key}`}>
                {row.value}
              </Text>
            </View>
            {index < rows.length - 1 && (
              <View className="h-px bg-border-primary w-full" />
            )}
          </View>
        ))}
      </View>
    </View>
  );
};

export default PoolDetailsBottomSheet;
