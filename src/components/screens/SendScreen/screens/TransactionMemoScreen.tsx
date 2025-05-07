import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import { Textarea } from "components/sds/Textarea";
import { SEND_PAYMENT_ROUTES, SendPaymentStackParamList } from "config/routes";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import useAppTranslation from "hooks/useAppTranslation";
import { useValidateMemo } from "hooks/useValidateMemo";
import React, { useState, useEffect } from "react";
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
  const [localMemo, setLocalMemo] = useState(memo);
  const { error } = useValidateMemo(localMemo);

  useEffect(() => {
    setLocalMemo(memo);
  }, [memo]);

  const handleSave = () => {
    if (error) return;

    saveMemo(localMemo);
    navigation.goBack();
  };

  return (
    <BaseLayout insets={{ top: false }} useKeyboardAvoidingView>
      <View className="flex-1 justify-between">
        <View className="flex-col gap-2">
          <Textarea
            fieldSize="lg"
            placeholder={t("transactionMemoScreen.placeholder")}
            value={localMemo}
            onChangeText={setLocalMemo}
            note={t("transactionMemoScreen.optional")}
            error={error}
          />
        </View>
        <View className="mt-4 mb-4 gap-4">
          <Button tertiary lg onPress={handleSave} disabled={!!error}>
            {t("common.save")}
          </Button>
        </View>
      </View>
    </BaseLayout>
  );
};

export default TransactionMemoScreen;
