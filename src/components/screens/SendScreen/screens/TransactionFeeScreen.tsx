import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import { Input } from "components/sds/Input";
import { NetworkCongestionIndicator } from "components/sds/NetworkCongestionIndicator";
import { Text } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE, MIN_TRANSACTION_FEE } from "config/constants";
import { SEND_PAYMENT_ROUTES, SendPaymentStackParamList } from "config/routes";
import { NetworkCongestion } from "config/types";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import useAppTranslation from "hooks/useAppTranslation";
import { useNetworkFees } from "hooks/useNetworkFees";
import { useValidateTransactionFee } from "hooks/useValidateTransactionFee";
import React, { useEffect, useState } from "react";
import { View } from "react-native";

type TransactionFeeScreenProps = NativeStackScreenProps<
  SendPaymentStackParamList,
  typeof SEND_PAYMENT_ROUTES.TRANSACTION_FEE_SCREEN
>;

const TransactionFeeScreen: React.FC<TransactionFeeScreenProps> = ({
  navigation,
}) => {
  const { t } = useAppTranslation();
  const { transactionFee, saveTransactionFee } = useTransactionSettingsStore();
  const { recommendedFee, networkCongestion } = useNetworkFees();
  const [localFee, setLocalFee] = useState(transactionFee);

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
    setLocalFee(transactionFee);
  }, [transactionFee]);

  const handleSave = () => {
    if (error) return;

    saveTransactionFee(localFee);
    navigation.goBack();
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
                  {/* The Fee is always paid in native token */}
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

export default TransactionFeeScreen;
