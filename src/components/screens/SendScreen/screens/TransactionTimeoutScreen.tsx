import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import { Input } from "components/sds/Input";
import { Text } from "components/sds/Typography";
import { SEND_PAYMENT_ROUTES, SendPaymentStackParamList } from "config/routes";
import useAppTranslation from "hooks/useAppTranslation";
import React, { useState } from "react";
import { View } from "react-native";

type TransactionTimeoutScreenProps = NativeStackScreenProps<
  SendPaymentStackParamList,
  typeof SEND_PAYMENT_ROUTES.TRANSACTION_TIMEOUT_SCREEN
>;

// Recommended transaction timeout in seconds
const RECOMMENDED_TIMEOUT = "180";

const TransactionTimeoutScreen: React.FC<TransactionTimeoutScreenProps> = ({
  navigation,
}) => {
  const { t } = useAppTranslation();
  const [timeout, setTimeout] = useState(RECOMMENDED_TIMEOUT);

  const handleSave = () => {
    // TODO: Implement save functionality
    navigation.goBack();
  };

  const handleSetRecommended = () => {
    setTimeout(RECOMMENDED_TIMEOUT);
  };

  return (
    <BaseLayout insets={{ top: false }} useKeyboardAvoidingView>
      <View className="flex-1 justify-between">
        <View className="flex-row items-center gap-2">
          <Input
            fieldSize="md"
            value={timeout}
            onChangeText={setTimeout}
            keyboardType="numeric"
            placeholder={RECOMMENDED_TIMEOUT}
            rightElement={
              <Text md secondary>
                {t("transactionTimeoutScreen.seconds")}
              </Text>
            }
          />
        </View>
        <View className="gap-4 mb-4">
          <Button secondary lg onPress={handleSetRecommended}>
            {t("transactionTimeoutScreen.setRecommended")}
          </Button>
          <Button tertiary lg onPress={handleSave}>
            {t("common.save")}
          </Button>
        </View>
      </View>
    </BaseLayout>
  );
};

export default TransactionTimeoutScreen;
