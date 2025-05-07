import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import { Input } from "components/sds/Input";
import { NetworkCongestionIndicator } from "components/sds/NetworkCongestionIndicator";
import { Text } from "components/sds/Typography";
import {
  NATIVE_TOKEN_CODE,
  TRANSACTION_RECOMMENDED_FEE,
} from "config/constants";
import { SEND_PAYMENT_ROUTES, SendPaymentStackParamList } from "config/routes";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import useAppTranslation from "hooks/useAppTranslation";
import React, { useEffect, useState } from "react";
import { View } from "react-native";

type CongestionLevel = "low" | "medium" | "high";

type TransactionFeeScreenProps = NativeStackScreenProps<
  SendPaymentStackParamList,
  typeof SEND_PAYMENT_ROUTES.TRANSACTION_FEE_SCREEN
>;

const TransactionFeeScreen: React.FC<TransactionFeeScreenProps> = ({
  navigation,
  route,
}) => {
  const { t } = useAppTranslation();
  const { transactionFee, saveTransactionFee } = useTransactionSettingsStore();
  const [localFee, setLocalFee] = useState(transactionFee);
  const { tokenCode = NATIVE_TOKEN_CODE } = route.params || {};
  const [congestionLevel] = useState<CongestionLevel>("low");

  // Update local fee when transactionFee changes
  useEffect(() => {
    setLocalFee(transactionFee);
  }, [transactionFee]);

  const handleSave = () => {
    saveTransactionFee(localFee);
    navigation.goBack();
  };

  const handleSetRecommended = () => {
    setLocalFee(TRANSACTION_RECOMMENDED_FEE);
  };

  return (
    <BaseLayout insets={{ top: false }} useKeyboardAvoidingView>
      <View className="flex-1 justify-between">
        <View>
          <View className="flex-row items-center gap-2">
            <Input
              fieldSize="md"
              value={localFee}
              onChangeText={setLocalFee}
              keyboardType="numeric"
              placeholder={TRANSACTION_RECOMMENDED_FEE}
              rightElement={
                <Text md secondary>
                  {tokenCode}
                </Text>
              }
            />
          </View>
          <View className="flex-row items-center gap-2 mt-2">
            <NetworkCongestionIndicator level={congestionLevel} size={16} />
            <Text sm secondary>
              {t(`transactionFeeScreen.congestion.${congestionLevel}`)}
            </Text>
          </View>
        </View>
        <View className="gap-4 mb-4">
          <Button secondary lg onPress={handleSetRecommended}>
            {t("transactionFeeScreen.setRecommended")}
          </Button>
          <Button tertiary lg onPress={handleSave}>
            {t("common.save")}
          </Button>
        </View>
      </View>
    </BaseLayout>
  );
};

export default TransactionFeeScreen;
