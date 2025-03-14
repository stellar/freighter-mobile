import Clipboard from "@react-native-clipboard/clipboard";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { OnboardLayout } from "components/layout/OnboardLayout";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { AUTH_STACK_ROUTES, AuthStackParamList } from "config/routes";
import { PALETTE, THEME } from "config/theme";
import { px, pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import styled from "styled-components/native";

type RecoveryPhraseScreenProps = {
  navigation: NativeStackNavigationProp<
    AuthStackParamList,
    typeof AUTH_STACK_ROUTES.RECOVERY_PHRASE_SCREEN
  >;
};

const RecoveryPhraseContainer = styled.View`
  padding: ${px(24)};
  justify-content: center;
  align-items: flex-start;
  border-radius: ${px(16)};
  background-color: ${THEME.colors.background.tertiary};
`;

const RecoveryPhraseText = styled(Text)`
  text-align: center;
`;

export const RecoveryPhraseScreen: React.FC<RecoveryPhraseScreenProps> = ({
  navigation,
}) => {
  // TODO: Replace this with the actual recovery phrase
  const fakeRecoveryPhrase =
    "gloom student label strategy tattoo promote brand mushroom problem divert carbon erode";
  const { t } = useAppTranslation();

  const handleContinue = () => {
    // TODO: Add logic to navigate to tabs after logging-in
    navigation.navigate(AUTH_STACK_ROUTES.RECOVERY_PHRASE_SCREEN);
  };

  const handleCopy = () => {
    // TODO: Replace this with the actual recovery phrase
    if (!fakeRecoveryPhrase) {
      return;
    }

    Clipboard.setString(fakeRecoveryPhrase);
  };

  return (
    <OnboardLayout
      icon={<Icon.ShieldTick circle />}
      title={t("recoveryPhraseScreen.title")}
      defaultActionButtonText={t(
        "recoveryPhraseScreen.defaultActionButtonText",
      )}
      onPressDefaultActionButton={handleContinue}
      footerNoteText={t("recoveryPhraseScreen.footerNoteText")}
    >
      <Text secondary md>
        {t("recoveryPhraseScreen.warning")}
      </Text>
      <RecoveryPhraseContainer>
        <RecoveryPhraseText primary md>
          {fakeRecoveryPhrase}
        </RecoveryPhraseText>
      </RecoveryPhraseContainer>
      <Button
        secondary
        lg
        isFullWidth
        onPress={handleCopy}
        icon={
          <Icon.Copy01 size={pxValue(16)} color={PALETTE.dark.gray["09"]} />
        }
      >
        {t("recoveryPhraseScreen.copyButtonText")}
      </Button>
    </OnboardLayout>
  );
};
