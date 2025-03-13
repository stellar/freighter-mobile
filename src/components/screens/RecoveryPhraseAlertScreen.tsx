import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import RecoveryPhraseWarningBox from "components/RecoveryPhraseWarningBox";
import { OnboardLayout } from "components/layout/OnboardLayout";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { AUTH_STACK_ROUTES, AuthStackParamList } from "config/routes";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";

type RecoveryPhraseAlertScreenProps = {
  navigation: NativeStackNavigationProp<
    AuthStackParamList,
    typeof AUTH_STACK_ROUTES.RECOVERY_PHRASE_ALERT_SCREEN
  >;
};

export const RecoveryPhraseAlertScreen: React.FC<
  RecoveryPhraseAlertScreenProps
> = ({ navigation }) => {
  const { t } = useAppTranslation();

  const handleContinue = () => {
    navigation.navigate(AUTH_STACK_ROUTES.RECOVERY_PHRASE_SCREEN);
  };

  return (
    <OnboardLayout
      icon={<Icon.ShieldTick circle />}
      title={t("recoveryPhraseAlertScreen.title")}
      defaultActionButtonText={t(
        "recoveryPhraseAlertScreen.defaultActionButtonText",
      )}
      onPressDefaultActionButton={handleContinue}
    >
      <Text secondary md>
        {t("recoveryPhraseAlertScreen.warningBlockOne")}{" "}
        <Text semiBold>{t("recoveryPhraseAlertScreen.warningBlockTwo")}</Text>
      </Text>
      <RecoveryPhraseWarningBox testID="recovery-phrase-warning-box" />
    </OnboardLayout>
  );
};
