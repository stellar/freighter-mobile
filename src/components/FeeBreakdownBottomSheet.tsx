import BigNumber from "bignumber.js";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { formatTokenForDisplay } from "helpers/formatAmount";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";

type FeeBreakdownBottomSheetProps = {
  onClose: () => void;
  /**
   * Whether the current transaction is Soroban-type (C-token, C-address, or
   * collectible), derived from the sending context rather than the builder
   * store. Controls row visibility and description text independently of
   * whether simulation has completed yet.
   */
  isSorobanContext: boolean;
};

/**
 * FeeBreakdownBottomSheet Component
 *
 * The mobile equivalent of the extension's FeesPane.
 * For Soroban transactions: shows Inclusion Fee + Resource Fee + Total Fee rows.
 * For classic transactions: shows only the Total Fee row.
 * Shows ActivityIndicator while a build is in progress.
 * Includes a contextual description (different text for Soroban vs classic).
 */
const FeeBreakdownBottomSheet: React.FC<FeeBreakdownBottomSheetProps> = ({
  onClose,
  isSorobanContext,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const {
    isSoroban,
    sorobanResourceFeeXlm,
    sorobanInclusionFeeXlm,
    isBuilding,
  } = useTransactionBuilderStore();
  const { transactionFee } = useTransactionSettingsStore();

  const totalFeeXlm =
    isSoroban && sorobanInclusionFeeXlm && sorobanResourceFeeXlm
      ? new BigNumber(sorobanInclusionFeeXlm)
          .plus(sorobanResourceFeeXlm)
          .toString()
      : transactionFee;

  return (
    <View className="flex-1">
      {/* Header — lilac icon + close button */}
      <View className="relative flex-row items-center mb-8">
        <View className="bg-lilac-3 p-2 rounded-[8px]">
          <Icon.Route color={themeColors.lilac[9]} size={28} />
        </View>
        <TouchableOpacity onPress={onClose} className="absolute right-0">
          <Icon.X
            color={themeColors.foreground.secondary}
            size={24}
            circle
            circleBackground={themeColors.background.tertiary}
          />
        </TouchableOpacity>
      </View>

      {/* Title */}
      <Text xl medium primary textAlign="left">
        {t("feeBreakdown.title")}
      </Text>

      {/* Fee rows card */}
      <View className="mt-[16px] rounded-[12px] overflow-hidden bg-background-tertiary">
        {isSoroban && (
          <View className="flex-row justify-between items-center px-[16px] py-[12px] border-b border-gray-6">
            <Text md secondary>
              {t("transactionAmountScreen.details.inclusionFee")}
            </Text>
            {isBuilding || !sorobanInclusionFeeXlm ? (
              <ActivityIndicator
                size="small"
                color={themeColors.text.secondary}
              />
            ) : (
              <Text md primary>
                {formatTokenForDisplay(
                  sorobanInclusionFeeXlm,
                  NATIVE_TOKEN_CODE,
                )}
              </Text>
            )}
          </View>
        )}
        {isSoroban && (
          <View className="flex-row justify-between items-center px-[16px] py-[12px] border-b border-gray-6">
            <Text md secondary>
              {t("transactionAmountScreen.details.resourceFee")}
            </Text>
            {isBuilding || !sorobanResourceFeeXlm ? (
              <ActivityIndicator
                size="small"
                color={themeColors.text.secondary}
              />
            ) : (
              <Text md primary>
                {formatTokenForDisplay(
                  sorobanResourceFeeXlm,
                  NATIVE_TOKEN_CODE,
                )}
              </Text>
            )}
          </View>
        )}
        {/* Total Fee — always shown, accented in lilac */}
        <View className="flex-row justify-between items-center px-[16px] py-[12px]">
          <Text md medium color={themeColors.lilac[11]}>
            {t("transactionAmountScreen.details.totalFee")}
          </Text>
          {isBuilding ? (
            <ActivityIndicator
              size="small"
              color={themeColors.text.secondary}
            />
          ) : (
            <Text md medium color={themeColors.lilac[11]}>
              {formatTokenForDisplay(totalFeeXlm, NATIVE_TOKEN_CODE)}
            </Text>
          )}
        </View>
      </View>

      {/* Contextual description */}
      <View className="mt-[24px] pr-8">
        <Text md regular secondary textAlign="left">
          {t(
            isSorobanContext
              ? "feeBreakdown.descriptionSoroban"
              : "feeBreakdown.descriptionClassic",
          )}
        </Text>
      </View>
    </View>
  );
};

export default FeeBreakdownBottomSheet;
