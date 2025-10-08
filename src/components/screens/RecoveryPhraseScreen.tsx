import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { OnboardLayout } from "components/layout/OnboardLayout";
import RecoveryPhraseSkipBottomSheet from "components/screens/RecoveryPhraseSkipBottomSheet";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import { BiometricsSource } from "config/constants";
import {
  AUTH_STACK_ROUTES,
  AuthStackParamList,
  RootStackParamList,
} from "config/routes";
import { PALETTE, THEME } from "config/theme";
import { useAuthenticationStore } from "ducks/auth";
import { useLoginDataStore } from "ducks/loginData";
import { px } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import { useBiometrics } from "hooks/useBiometrics";
import useColors from "hooks/useColors";
import { useSecureClipboard } from "hooks/useSecureClipboard";
import React, { useCallback, useEffect, useState } from "react";
import { analytics } from "services/analytics";
import StellarHDWallet from "stellar-hd-wallet";
import styled from "styled-components/native";

type RecoveryPhraseScreenProps = NativeStackScreenProps<
  AuthStackParamList & RootStackParamList,
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

const StyledFooterButtonContainer = styled.View`
  gap: ${px(12)};
`;

const Footer: React.FC<{
  isLoading: boolean;
  onPressContinue: () => void;
  onPressSkip: () => void;
}> = ({ isLoading, onPressContinue, onPressSkip }) => {
  const { t } = useAppTranslation();

  return (
    <StyledFooterButtonContainer>
      <Button
        tertiary
        isFullWidth
        testID="continue-button"
        onPress={onPressContinue}
        disabled={isLoading}
      >
        {t("onboarding.continue")}
      </Button>
      <Button
        secondary
        testID="skip-button"
        isLoading={isLoading}
        onPress={onPressSkip}
      >
        {t("onboarding.doThisLaterButtonText")}
      </Button>
    </StyledFooterButtonContainer>
  );
};

export const RecoveryPhraseScreen: React.FC<RecoveryPhraseScreenProps> = ({
  navigation,
}) => {
  const { password, setMnemonicPhrase, setPassword, clearLoginData } =
    useLoginDataStore();
  const [localMnemonicPhrase] = useState(
    StellarHDWallet.generateMnemonic({
      entropyBits: 128,
    }),
  );
  const { error, isLoading, signUp, clearError, storeBiometricPassword } =
    useAuthenticationStore();
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { copyToClipboard } = useSecureClipboard();
  const skipModalRef = React.useRef<BottomSheetModal | null>(null);
  const { biometryType } = useBiometrics();

  useEffect(() => {
    setMnemonicPhrase(localMnemonicPhrase);
    setPassword(password);
  }, [localMnemonicPhrase, password, setMnemonicPhrase, setPassword]);

  useEffect(() => {
    clearError?.();
  }, [clearError]);

  const handleContinue = () => {
    if (!localMnemonicPhrase) return;
    analytics.track(AnalyticsEvent.VIEWED_RECOVERY_PHRASE);

    navigation.navigate(AUTH_STACK_ROUTES.VALIDATE_RECOVERY_PHRASE_SCREEN);
  };

  const handleSkip = () => {
    skipModalRef.current?.present();
  };

  const confirmSkip = useCallback(() => {
    if (biometryType) {
      storeBiometricPassword(password!).then(() => {
        navigation.navigate(AUTH_STACK_ROUTES.BIOMETRICS_ENABLE_SCREEN, {
          source: BiometricsSource.ONBOARDING,
        });
      });
    } else {
      // No biometrics available, proceed with normal signup
      signUp({
        password: password!,
        mnemonicPhrase: localMnemonicPhrase,
      }).then(() => {
        clearLoginData(); // Clear sensitive data after successful signup
        analytics.track(AnalyticsEvent.ACCOUNT_CREATOR_FINISHED);
      });
    }

    skipModalRef.current?.dismiss();
  }, [
    signUp,
    password,
    localMnemonicPhrase,
    navigation,
    biometryType,
    storeBiometricPassword,
    clearLoginData,
  ]);

  const handleConfirmSkip = useCallback(() => {
    confirmSkip();
  }, [confirmSkip]);

  const handleCopy = useCallback(() => {
    if (!localMnemonicPhrase) return;
    copyToClipboard(localMnemonicPhrase);

    analytics.trackCopyBackupPhrase();
  }, [localMnemonicPhrase, copyToClipboard]);

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
    <>
      <OnboardLayout
        icon={
          <Icon.ShieldTick
            circle
            circleBackground={themeColors.lilac[3]}
            circleBorder={themeColors.lilac[6]}
          />
        }
        title={t("recoveryPhraseScreen.title")}
        isLoading={isLoading}
        footerNoteText={t("recoveryPhraseScreen.footerNoteText")}
        footer={
          <Footer
            isLoading={isLoading}
            onPressContinue={handleContinue}
            onPressSkip={handleSkip}
          />
        }
      >
        <Text secondary md>
          {t("recoveryPhraseScreen.warning")}
        </Text>
        <RecoveryPhraseContainer>
          <RecoveryPhraseText primary md>
            {localMnemonicPhrase}
          </RecoveryPhraseText>
        </RecoveryPhraseContainer>
        <Button
          secondary
          isFullWidth
          onPress={handleCopy}
          icon={<Icon.Copy01 size={16} color={PALETTE.dark.gray["09"]} />}
        >
          {t("recoveryPhraseScreen.copyButtonText")}
        </Button>
      </OnboardLayout>
      <RecoveryPhraseSkipBottomSheet
        modalRef={skipModalRef}
        onConfirm={handleConfirmSkip}
        isLoading={isLoading}
        onDismiss={() => skipModalRef.current?.dismiss()}
      />
    </>
  );
};
