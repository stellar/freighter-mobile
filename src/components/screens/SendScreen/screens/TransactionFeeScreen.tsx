import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import { Input } from "components/sds/Input";
import { NetworkCongestionIndicator } from "components/sds/NetworkCongestionIndicator";
import { Text } from "components/sds/Typography";
import { SEND_PAYMENT_ROUTES, SendPaymentStackParamList } from "config/routes";
import useAppTranslation from "hooks/useAppTranslation";
import React, { useState } from "react";
import { View } from "react-native";

type TransactionFeeScreenProps = NativeStackScreenProps<
  SendPaymentStackParamList,
  typeof SEND_PAYMENT_ROUTES.TRANSACTION_FEE_SCREEN
>;

type CongestionLevel = "low" | "medium" | "high";

// Native token code for XLM - used for transaction fees
const NATIVE_TOKEN_CODE = "XLM";

const TransactionFeeScreen: React.FC<TransactionFeeScreenProps> = ({
  navigation,
  route,
}) => {
  const { t } = useAppTranslation();
  const [fee, setFee] = useState("0.0250005");
  const { tokenCode = NATIVE_TOKEN_CODE } = route.params || {};
  const [congestionLevel] = useState<CongestionLevel>("low");

  const handleSave = () => {
    // TODO: Implement save functionality
    navigation.goBack();
  };

  const handleSetRecommended = () => {
    setFee("0.0250005");
  };

  return (
    <BaseLayout insets={{ top: false }} useKeyboardAvoidingView>
      <View className="flex-1 justify-between">
        <View>
          <View className="flex-row items-center gap-2">
            <Input
              fieldSize="md"
              value={fee}
              onChangeText={setFee}
              keyboardType="numeric"
              placeholder="0.0250005"
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
          <Button variant="secondary" size="lg" onPress={handleSetRecommended}>
            {t("transactionFeeScreen.setRecommended")}
          </Button>
          <Button tertiary lg onPress={handleSave}>
            {t("transactionFeeScreen.save")}
          </Button>
        </View>
      </View>
    </BaseLayout>
  );
};

export default TransactionFeeScreen;
