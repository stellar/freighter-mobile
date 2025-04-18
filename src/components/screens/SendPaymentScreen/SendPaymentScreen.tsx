/* eslint-disable react/no-unstable-nested-components */
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BaseLayout } from "components/layout/BaseLayout";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { SEND_PAYMENT_ROUTES, SendPaymentStackParamList } from "config/routes";
import { THEME } from "config/theme";
import useAppTranslation from "hooks/useAppTranslation";
import React, { useEffect } from "react";
import { TouchableOpacity } from "react-native";

type SendPaymentScreenProps = NativeStackScreenProps<
  SendPaymentStackParamList,
  typeof SEND_PAYMENT_ROUTES.SEND_PAYMENT_SCREEN
>;

const SendPaymentScreen: React.FC<SendPaymentScreenProps> = ({
  navigation,
}) => {
  const { t } = useAppTranslation();

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon.X size={24} color={THEME.colors.base.secondary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, t]);

  return (
    <BaseLayout insets={{ top: false }} useKeyboardAvoidingView>
      <Input
        leftElement={
          <Icon.UserCircle size={16} color={THEME.colors.foreground.primary} />
        }
        placeholder={t("sendPaymentScreen.inputPlaceholder")}
        onChangeText={() => {}}
        endButton={{
          content: "Paste",
          onPress: () => {
            console.log("End button pressed");
          },
          disabled: false,
        }}
      />
    </BaseLayout>
  );
};

export default SendPaymentScreen;
