import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import { Textarea } from "components/sds/Textarea";
import { SEND_PAYMENT_ROUTES, SendPaymentStackParamList } from "config/routes";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { View } from "react-native";

type TransactionMemoScreenProps = NativeStackScreenProps<
  SendPaymentStackParamList,
  typeof SEND_PAYMENT_ROUTES.TRANSACTION_MEMO_SCREEN
>;

const TransactionMemoScreen: React.FC<TransactionMemoScreenProps> = ({
  navigation,
}) => {
  const { t } = useAppTranslation();
  const { memo, saveMemo } = useTransactionSettingsStore();

  const handleSave = () => {
    saveMemo(memo);
    navigation.goBack();
  };

  return (
    <BaseLayout insets={{ top: false }} useKeyboardAvoidingView>
      <View className="flex-1 justify-between">
        <Textarea
          fieldSize="lg"
          placeholder={t("transactionMemoScreen.placeholder")}
          value={memo}
          onChangeText={saveMemo}
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
