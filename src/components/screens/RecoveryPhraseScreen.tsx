import Clipboard from "@react-native-clipboard/clipboard";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { OnboardLayout } from "components/layout/OnboardLayout";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { AUTH_STACK_ROUTES, AuthStackParamList } from "config/routes";
import { PALETTE, THEME } from "config/theme";
import { useAuthenticationStore } from "ducks/auth";
import { px, pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import React, { useCallback, useState } from "react";
import { generateMnemonic } from "stellar-hd-wallet";
import styled from "styled-components/native";

type RecoveryPhraseScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  typeof AUTH_STACK_ROUTES.RECOVERY_PHRASE_SCREEN
>;

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
  route,
  navigation,
}) => {
  const { password } = route.params;
  const [recoveryPhrase] = useState(
    generateMnemonic({
      entropyBits: 128,
    }),
  );
  const { error, isLoading } = useAuthenticationStore();
  const { t } = useAppTranslation();

  const handleContinue = () => {
    if (!recoveryPhrase) return;

    navigation.navigate(AUTH_STACK_ROUTES.VALIDATE_RECOVERY_PHRASE_SCREEN, {
      password,
      recoveryPhrase,
    });
  };

  const handleCopy = useCallback(() => {
    if (!recoveryPhrase) return;
    Clipboard.setString(recoveryPhrase);
  }, [recoveryPhrase]);

  if (error) {
    return (
      <OnboardLayout
        icon={<Icon.ShieldTick circle />}
        title={t("recoveryPhraseScreen.title")}
      >
        <Text secondary md>
          {error}
        </Text>
      </OnboardLayout>
    );
  }

  return (
    <OnboardLayout
      icon={<Icon.ShieldTick circle />}
      title={t("recoveryPhraseScreen.title")}
      defaultActionButtonText={t(
        "recoveryPhraseScreen.defaultActionButtonText",
      )}
      isLoading={isLoading}
      onPressDefaultActionButton={handleContinue}
      footerNoteText={t("recoveryPhraseScreen.footerNoteText")}
    >
      <Text secondary md>
        {t("recoveryPhraseScreen.warning")}
      </Text>
      <RecoveryPhraseContainer>
        <RecoveryPhraseText primary md>
          {recoveryPhrase}
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
