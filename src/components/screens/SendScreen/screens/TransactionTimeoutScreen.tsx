import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import { Input } from "components/sds/Input";
import { Text } from "components/sds/Typography";
import { DEFAULT_TRANSACTION_TIMEOUT } from "config/constants";
import { SEND_PAYMENT_ROUTES, SendPaymentStackParamList } from "config/routes";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import useAppTranslation from "hooks/useAppTranslation";
import { useValidateTransactionTimeout } from "hooks/useValidateTransactionTimeout";
import React, { useEffect, useState } from "react";
import { View } from "react-native";

type TransactionTimeoutScreenProps = NativeStackScreenProps<
  SendPaymentStackParamList,
  typeof SEND_PAYMENT_ROUTES.TRANSACTION_TIMEOUT_SCREEN
>;

const TransactionTimeoutScreen: React.FC<TransactionTimeoutScreenProps> = ({
  navigation,
}) => {
  const { t } = useAppTranslation();
  const { transactionTimeout, saveTransactionTimeout } =
    useTransactionSettingsStore();
  const [localTimeout, setLocalTimeout] = useState(
    transactionTimeout.toString(),
  );
  const { error } = useValidateTransactionTimeout(localTimeout);

  useEffect(() => {
    setLocalTimeout(transactionTimeout.toString());
  }, [transactionTimeout]);

  const handleSave = () => {
    if (error) return;

    const timeoutValue = Number(localTimeout);
    saveTransactionTimeout(timeoutValue);
    navigation.goBack();
  };

  const handleSetRecommended = () => {
    setLocalTimeout(DEFAULT_TRANSACTION_TIMEOUT.toString());
  };

  return (
    <BaseLayout insets={{ top: false }} useKeyboardAvoidingView>
      <View className="flex-1 justify-between">
        <View className="flex-col gap-2">
          <Input
            fieldSize="lg"
            value={localTimeout}
            onChangeText={setLocalTimeout}
            keyboardType="numeric"
            placeholder={t("transactionTimeoutScreen.inputPlaceholder")}
            rightElement={
              <Text md secondary>
                {t("transactionTimeoutScreen.seconds")}
              </Text>
            }
            error={error}
          />
        </View>
        <View className="gap-4 mb-4">
          <Button secondary lg onPress={handleSetRecommended}>
            {t("transactionTimeoutScreen.setRecommended")}
          </Button>
          <Button
            tertiary
            lg
            onPress={handleSave}
            disabled={!!error || !localTimeout}
          >
            {t("common.save")}
          </Button>
        </View>
      </View>
    </BaseLayout>
  );
};

export default TransactionTimeoutScreen;
