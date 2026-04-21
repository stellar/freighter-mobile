import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { Modal as RNModal, ScrollView, View } from "react-native";

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
    <RNModal
      visible={visible}
      animationType="fade"
      presentationStyle="overFullScreen"
      onRequestClose={onCancel}
    >
      <View
        className="flex-1 justify-center items-center px-6 bg-background-primary"
        testID="forgot-password-warning-modal"
      >
        <View className="w-full bg-background-tertiary rounded-[24px] p-6 gap-6">
          <View
            className="size-12 rounded-full items-center justify-center border"
            style={{
              backgroundColor: themeColors.red[3],
              borderColor: themeColors.red[6],
            }}
          >
            <Icon.AlertCircle size={24} themeColor="red" />
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

          <View className="gap-3">
            <Button
              destructive
              xl
              onPress={onConfirm}
              testID="forgot-password-warning-continue-button"
            >
              {t("lockScreen.forgotPasswordWarningContinueButton")}
            </Button>
            <Button
              secondary
              xl
              onPress={onCancel}
              testID="forgot-password-warning-cancel-button"
            >
              {t("common.cancel")}
            </Button>
          </View>
        </View>
      </View>
    </RNModal>
  );
};

export default ForgotPasswordWarningModal;
