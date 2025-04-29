import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import { Textarea } from "components/sds/Textarea";
import { SEND_PAYMENT_ROUTES, SendPaymentStackParamList } from "config/routes";
import useAppTranslation from "hooks/useAppTranslation";
import React, { useState } from "react";
import { View } from "react-native";

type MemoScreenProps = NativeStackScreenProps<
  SendPaymentStackParamList,
  typeof SEND_PAYMENT_ROUTES.MEMO_SCREEN
>;

const MemoScreen: React.FC<MemoScreenProps> = ({ navigation }) => {
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
          placeholder={t("memoScreen.placeholder")}
          value={memo}
          onChangeText={setMemo}
          note={t("memoScreen.optional")}
        />
        <View className="mt-4 mb-4">
          <Button variant="tertiary" size="lg" onPress={handleSave}>
            {t("memoScreen.save")}
          </Button>
        </View>
      </View>
    </BaseLayout>
  );
};

export default MemoScreen; 