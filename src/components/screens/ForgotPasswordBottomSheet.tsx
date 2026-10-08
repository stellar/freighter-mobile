import InformationBottomSheet from "components/InformationBottomSheet";
import { ButtonVariants } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { View } from "react-native";

interface ForgotPasswordBottomSheetProps {
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Bottom sheet content warning that a forgotten password can't be recovered,
 * so the only way back in is to reset the wallet and re-import it with the
 * recovery phrase. Presented from the lock screen's Forgot password button.
 *
 * Design: https://www.figma.com/design/lcdj2ucnJ2BfvRvsLboBNC/Varial?node-id=3077-156848
 * Built on the shared InformationBottomSheet, so its text and close button
 * follow the other information sheets rather than the design. Its red badge
 * is the one the warning had as a modal, like the app's other warning sheets.
 */
const ForgotPasswordBottomSheet: React.FC<ForgotPasswordBottomSheetProps> = ({
  onClose,
  onConfirm,
}) => {
  const { t } = useAppTranslation();

  return (
    <View testID="forgot-password-warning-modal">
      <InformationBottomSheet
        onClose={onClose}
        closeTestID="forgot-password-warning-cancel-button"
        onConfirm={onConfirm}
        confirmLabel={t("lockScreen.forgotPasswordWarningResetButton")}
        confirmVariant={ButtonVariants.DESTRUCTIVE}
        confirmTestID="forgot-password-warning-continue-button"
        headerElement={
          <View className="size-12 rounded-full items-center justify-center bg-red-3 border border-red-6">
            <Icon.InfoCircle size={24} themeColor="red" />
          </View>
        }
        title={t("lockScreen.forgotPasswordWarningTitle")}
        texts={[
          {
            key: "unrecoverable",
            value: t("lockScreen.forgotPasswordWarningMessage1"),
          },
          {
            key: "reset",
            value: t("lockScreen.forgotPasswordWarningMessage2"),
          },
          {
            key: "recoveryPhrase",
            value: (
              <Text md semiBold secondary>
                {t("lockScreen.forgotPasswordWarningMessage3")}
              </Text>
            ),
          },
        ]}
      />
    </View>
  );
};

export default ForgotPasswordBottomSheet;
