import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import { Input } from "components/sds/Input";
import { NetworkCongestionIndicator } from "components/sds/NetworkCongestionIndicator";
import { Text } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE, MIN_TRANSACTION_FEE } from "config/constants";
import { NetworkCongestion } from "config/types";
import useAppTranslation from "hooks/useAppTranslation";
import { useNetworkFees } from "hooks/useNetworkFees";
import { useValidateTransactionFee } from "hooks/useValidateTransactionFee";
import React, { useEffect, useState } from "react";
import { View } from "react-native";

interface FeeSettingsProps {
  currentFee: string;
  onSave: (fee: string) => void;
  onGoBack: () => void;
}

/**
 * FeeSettings Component
 *
 * A reusable fee configuration screen that can be used for both
 * transaction and swap fee settings.
 *
 * @param {FeeSettingsProps} props - Component props
 * @returns {JSX.Element} The rendered component
 */
const FeeSettings: React.FC<FeeSettingsProps> = ({
  currentFee,
  onSave,
  onGoBack,
}) => {
  const { t } = useAppTranslation();
  const { recommendedFee, networkCongestion } = useNetworkFees();
  const [localFee, setLocalFee] = useState(currentFee);

  const { error } = useValidateTransactionFee(localFee);

  const getLocalizedCongestionLevel = (
    congestion: NetworkCongestion,
  ): string => {
    switch (congestion) {
      case NetworkCongestion.LOW:
        return t("low");
      case NetworkCongestion.MEDIUM:
        return t("medium");
      case NetworkCongestion.HIGH:
        return t("high");
      default:
        return t("low");
    }
  };

  useEffect(() => {
    setLocalFee(currentFee);
  }, [currentFee]);

  const handleSave = () => {
    if (error) return;

    onSave(localFee);
    onGoBack();
  };

  const handleSetRecommended = () => {
    setLocalFee(recommendedFee || MIN_TRANSACTION_FEE);
  };

  return (
    <BaseLayout insets={{ top: false }} useKeyboardAvoidingView>
      <View className="flex-1 justify-between">
        <View>
          <View className="flex-row items-center gap-2">
            <Input
              fieldSize="lg"
              value={localFee}
              onChangeText={setLocalFee}
              keyboardType="numeric"
              placeholder={MIN_TRANSACTION_FEE}
              error={error}
              rightElement={
                <Text md secondary>
                  {NATIVE_TOKEN_CODE}
                </Text>
              }
            />
          </View>
          <View className="flex-row items-center gap-2 mt-2">
            <NetworkCongestionIndicator level={networkCongestion} size={16} />
            <Text sm secondary>
              {t("transactionFeeScreen.congestion", {
                networkCongestion:
                  getLocalizedCongestionLevel(networkCongestion),
              })}
            </Text>
          </View>
        </View>
        <View className="gap-4 mb-4">
          <Button secondary lg onPress={handleSetRecommended}>
            {t("transactionFeeScreen.setRecommended")}
          </Button>
          <Button
            tertiary
            lg
            onPress={handleSave}
            disabled={!!error || !localFee}
          >
            {t("common.save")}
          </Button>
        </View>
      </View>
    </BaseLayout>
  );
};

export default FeeSettings;
