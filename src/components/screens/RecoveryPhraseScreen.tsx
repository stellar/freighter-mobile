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
import React, { useCallback, useEffect, useState } from "react";
import { InteractionManager } from "react-native";
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
}) => {
  const { password } = route.params;
  const [recoveryPhrase] = useState(
    generateMnemonic({
      entropyBits: 128,
    }),
  );
  const { signUp, error, isLoading } = useAuthenticationStore();
  const [localLoading, setLocalLoading] = useState(false);
  const { t } = useAppTranslation();

  // Handle the transition between local loading and global loading states
  useEffect(() => {
    if (isLoading) {
      setLocalLoading(false);
    }
  }, [isLoading]);

  const handleContinue = () => {
    // Set local loading state immediately to show feedback
    setLocalLoading(true);

    // Use InteractionManager to ensure UI animations complete first
    InteractionManager.runAfterInteractions(() => {
      // Add a small delay to allow loading indicators to appear
      setTimeout(() => {
        signUp({
          password,
          mnemonicPhrase: recoveryPhrase,
        });
      }, 50);
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
      isLoading={isLoading || localLoading}
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
