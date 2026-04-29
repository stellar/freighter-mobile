import Modal from "components/Modal";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { ScrollView, View } from "react-native";

interface ForgotPasswordWarningModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const ForgotPasswordWarningModal: React.FC<ForgotPasswordWarningModalProps> = ({
  visible,
  onCancel,
  onConfirm,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  return (
    <Modal
      visible={visible}
      onClose={onCancel}
      contentClassName="w-full bg-background-tertiary rounded-[24px] p-6 gap-6"
      testID="forgot-password-warning-modal"
    >
      <View
        className="size-12 rounded-full items-center justify-center border"
        style={{
          backgroundColor: themeColors.red[3],
          borderColor: themeColors.red[6],
        }}
      >
        <Icon.InfoCircle size={24} themeColor="red" />
      </View>

      <ScrollView className="flex-shrink">
        <View className="gap-2">
          <Text xl medium primary>
            {t("lockScreen.forgotPasswordWarningTitle")}
          </Text>

          <View className="gap-6">
            <Text md regular secondary>
              {t("lockScreen.forgotPasswordWarningMessage1")}
            </Text>
            <Text md regular secondary>
              {t("lockScreen.forgotPasswordWarningMessage2")}
            </Text>
            <Text md medium primary>
              {t("lockScreen.forgotPasswordWarningMessage3")}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View className="gap-4">
        <Button
          tertiary
          xl
          onPress={onCancel}
          testID="forgot-password-warning-cancel-button"
        >
          {t("common.cancel")}
        </Button>
        <Button
          destructive
          xl
          onPress={onConfirm}
          testID="forgot-password-warning-continue-button"
        >
          {t("lockScreen.forgotPasswordWarningResetButton")}
        </Button>
      </View>
    </Modal>
  );
};

export default ForgotPasswordWarningModal;
