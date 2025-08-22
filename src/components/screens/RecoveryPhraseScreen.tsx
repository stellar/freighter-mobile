import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { OnboardLayout } from "components/layout/OnboardLayout";
import RecoveryPhraseSkipBottomSheet from "components/screens/RecoveryPhraseSkipBottomSheet";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import {
  AUTH_STACK_ROUTES,
  AuthStackParamList,
  RootStackParamList,
  ROOT_NAVIGATOR_ROUTES,
} from "config/routes";
import { PALETTE, THEME } from "config/theme";
import { useAuthenticationStore } from "ducks/auth";
import { px } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import { useFaceId } from "hooks/useFaceId";
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
        lg
        isFullWidth
        testID="continue-button"
        onPress={onPressContinue}
        disabled={isLoading}
      >
        {t("onboarding.continue")}
      </Button>
      <Button
        secondary
        lg
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
  route,
  navigation,
}) => {
  const { password } = route.params;
  const [recoveryPhrase] = useState(
    StellarHDWallet.generateMnemonic({
      entropyBits: 128,
    }),
  );
  const { error, isLoading, signUp, clearError } = useAuthenticationStore();
  const { t } = useAppTranslation();
  const { copyToClipboard } = useClipboard();
  const skipModalRef = React.useRef<BottomSheetModal | null>(null);
  const { isFaceIdAvailable } = useFaceId();
  const [isSkipping, setIsSkipping] = useState(false);

  const handleNavigateToMainTabStack = useCallback(() => {
    navigation.navigate(ROOT_NAVIGATOR_ROUTES.MAIN_TAB_STACK);
  }, [navigation]);

  const handleNavigateToFaceIdOnboardingScreen = useCallback(() => {
    navigation.navigate(ROOT_NAVIGATOR_ROUTES.FACE_ID_ONBOARDING_SCREEN, {
      password,
    });
  }, [navigation, password]);

  useEffect(() => {
    clearError?.();
  }, [clearError]);

  const handleContinue = () => {
    if (!recoveryPhrase) return;
    analytics.track(AnalyticsEvent.VIEWED_RECOVERY_PHRASE);

    navigation.navigate(AUTH_STACK_ROUTES.VALIDATE_RECOVERY_PHRASE_SCREEN, {
      password,
      recoveryPhrase,
    });
  };

  const handleSkip = () => {
    skipModalRef.current?.present();
  };

  const confirmSkip = useCallback(() => {
    setIsSkipping(true);

    setTimeout(() => {
      (async () => {
        const success = await signUp({
          password,
          mnemonicPhrase: recoveryPhrase,
        });

        if (success && !isFaceIdAvailable) {
          handleNavigateToMainTabStack();
        } else if (success) {
          handleNavigateToFaceIdOnboardingScreen();
        }

        analytics.track(AnalyticsEvent.ACCOUNT_CREATOR_FINISHED);

        skipModalRef.current?.dismiss();
        setIsSkipping(false);
      })();
    }, 0);
  }, [
    signUp,
    password,
    recoveryPhrase,
    isFaceIdAvailable,
    handleNavigateToMainTabStack,
    handleNavigateToFaceIdOnboardingScreen,
  ]);

  const handleConfirmSkip = useCallback(() => {
    confirmSkip();
  }, [confirmSkip]);

  const handleCopy = useCallback(() => {
    if (!recoveryPhrase) return;
    copyToClipboard(recoveryPhrase);

    analytics.trackCopyBackupPhrase();
  }, [recoveryPhrase, copyToClipboard]);

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
        icon={<Icon.ShieldTick circle />}
        title={t("recoveryPhraseScreen.title")}
        isLoading={isLoading || isSkipping}
        footerNoteText={t("recoveryPhraseScreen.footerNoteText")}
        footer={
          <Footer
            isLoading={isLoading || isSkipping}
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
            {recoveryPhrase}
          </RecoveryPhraseText>
        </RecoveryPhraseContainer>
        <Button
          secondary
          lg
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
        isLoading={isLoading || isSkipping}
        onDismiss={() => skipModalRef.current?.dismiss()}
      />
    </>
  );
};
