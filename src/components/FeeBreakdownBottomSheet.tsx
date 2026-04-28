import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { formatTokenForDisplay } from "helpers/formatAmount";
import { computeTotalFeeXlm } from "helpers/soroban";
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
 * When Soroban simulation fails and fee fields are unavailable, shows dashes
 * for the affected fee values instead of displaying misleading amounts.
 * Includes a contextual description (different text for Soroban vs classic).
 */
const FeeBreakdownBottomSheet: React.FC<FeeBreakdownBottomSheetProps> = ({
  onClose,
  isSorobanContext,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const {
    sorobanResourceFeeXlm,
    sorobanInclusionFeeXlm,
    isBuilding,
    error: builderError,
  } = useTransactionBuilderStore();
  const { transactionFee } = useTransactionSettingsStore();

  const totalFeeXlm = computeTotalFeeXlm(
    sorobanInclusionFeeXlm,
    sorobanResourceFeeXlm,
    transactionFee,
  );

  // When simulation has failed the stored fee fields are null — show a dash
  // instead of the misleading base fee for Soroban rows.
  const hasBuildError = isSorobanContext && !!builderError && !isBuilding;

  const getResourceFeeDisplay = () => {
    if (hasBuildError || !sorobanResourceFeeXlm) return "-";
    return formatTokenForDisplay(sorobanResourceFeeXlm, NATIVE_TOKEN_CODE);
  };

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
        {isSorobanContext && (
          <View className="flex-row justify-between items-center px-[16px] py-[12px] border-b border-gray-6">
            <Text md secondary>
              {t("transactionAmountScreen.details.inclusionFee")}
            </Text>
            {isBuilding ? (
              <ActivityIndicator
                size="small"
                color={themeColors.text.secondary}
              />
            ) : (
              <Text md primary>
                {hasBuildError
                  ? "—"
                  : formatTokenForDisplay(
                      // Pre-simulation: show the user-selected base fee; post-simulation: show the simulated inclusion fee
                      sorobanInclusionFeeXlm ?? transactionFee,
                      NATIVE_TOKEN_CODE,
                    )}
              </Text>
            )}
          </View>
        )}
        {isSorobanContext && (
          <View className="flex-row justify-between items-center px-[16px] py-[12px] border-b border-gray-6">
            <Text md secondary>
              {t("transactionAmountScreen.details.resourceFee")}
            </Text>
            {isBuilding ? (
              <ActivityIndicator
                size="small"
                color={themeColors.text.secondary}
              />
            ) : (
              <Text md primary>
                {getResourceFeeDisplay()}
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
              {hasBuildError
                ? "—"
                : formatTokenForDisplay(totalFeeXlm, NATIVE_TOKEN_CODE)}
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
