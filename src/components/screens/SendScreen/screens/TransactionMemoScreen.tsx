import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import { Textarea } from "components/sds/Textarea";
import { SEND_PAYMENT_ROUTES, SendPaymentStackParamList } from "config/routes";
import useAppTranslation from "hooks/useAppTranslation";
import React, { useState } from "react";
import { View } from "react-native";

type TransactionMemoScreenProps = NativeStackScreenProps<
  SendPaymentStackParamList,
  typeof SEND_PAYMENT_ROUTES.TRANSACTION_MEMO_SCREEN
>;

const TransactionMemoScreen: React.FC<TransactionMemoScreenProps> = ({
  navigation,
}) => {
  const { t } = useAppTranslation();
  const [memo, setMemo] = useState("");

  const handleSave = () => {
    // TODO: Implement save functionality
    navigation.goBack();
  };

  return (
    <BaseLayout insets={{ top: false }} useKeyboardAvoidingView>
      <View className="flex-1 justify-between">
        <Textarea
          fieldSize="lg"
          placeholder={t("transactionMemoScreen.placeholder")}
          value={memo}
          onChangeText={setMemo}
          note={t("transactionMemoScreen.optional")}
        />
        <View className="mt-4 mb-4">
          <Button tertiary lg onPress={handleSave}>
            {t("common.save")}
          </Button>
        </View>
      </View>
    </BaseLayout>
  );
};

export default TransactionMemoScreen;
