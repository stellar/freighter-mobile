import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RecoveryPhraseGrid } from "components/RecoveryPhraseGrid";
import { OnboardLayout, OnboardTitle } from "components/layout/OnboardLayout";
import { CopyPhraseButton } from "components/screens/RecoveryPhraseScreen";
import { Button } from "components/sds/Button";
import { Text } from "components/sds/Typography";
import {
  MANAGE_WALLETS_ROUTES,
  ManageWalletsStackParamList,
} from "config/routes";
import {
  clearPendingRecoveryPhrase,
  getPendingRecoveryPhrase,
} from "ducks/auth";
import useAppTranslation from "hooks/useAppTranslation";
import { useSecureClipboard } from "hooks/useSecureClipboard";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { analytics } from "services/analytics";

type BackupRecoveryPhraseScreenProps = NativeStackScreenProps<
  ManageWalletsStackParamList,
  typeof MANAGE_WALLETS_ROUTES.BACKUP_RECOVERY_PHRASE_SCREEN
>;

/**
 * Back Up Your New Recovery Phrase: the phrase Create new wallet generated,
 * hidden until the user asks to see it, then with Tap to copy, the warning,
 * and Create, which goes on to the password step.
 *
 * The phrase is read from the auth store by its generation id, and the
 * store holds it until the password step stores it. Leaving this screen
 * backwards drops it, so an abandoned phrase is never stored.
 *
 * Design: hidden ?node-id=2554-165958, revealed ?node-id=2554-165990.
 */
const BackupRecoveryPhraseScreen: React.FC<BackupRecoveryPhraseScreenProps> = ({
  navigation,
  route,
}) => {
  const { t } = useAppTranslation();
  const { copyToClipboard } = useSecureClipboard();
  const { pendingPhraseId, accountName } = route.params;
  const [phrase] = useState(() => getPendingRecoveryPhrase(pendingPhraseId));
  const [isRevealed, setIsRevealed] = useState(false);

  // Mounted for as long as the flow is past this point, so this runs when
  // the user backs out, or once the stack resets after a successful create.
  // Only this screen's generation, so it can't drop a newer one.
  useEffect(
    () => () => clearPendingRecoveryPhrase(pendingPhraseId),
    [pendingPhraseId],
  );

  useEffect(() => {
    // Nothing held for this generation: the session locked, the flow was
    // left, or a later generation replaced it. Start again.
    if (!phrase) {
      navigation.goBack();
    }
  }, [navigation, phrase]);

  if (!phrase) {
    return null;
  }

  const handleCopy = () => {
    copyToClipboard(phrase, { hideNotification: true });
    analytics.trackCopyBackupPhrase();
  };

  const title = (
    <OnboardTitle>{t("backupRecoveryPhraseScreen.title")}</OnboardTitle>
  );
  const description = (
    <Text md secondary>
      {t("backupRecoveryPhraseScreen.description")}{" "}
      <Text md semiBold primary>
        {t("backupRecoveryPhraseScreen.descriptionEmphasis")}
      </Text>
    </Text>
  );

  if (!isRevealed) {
    return (
      <OnboardLayout title={title} description={description} footer={null}>
        <View className="mt-[8px] gap-6" testID="backup-recovery-phrase-hidden">
          <RecoveryPhraseGrid />
          <Button
            secondary
            xl
            isFullWidth
            onPress={() => setIsRevealed(true)}
            testID="backup-recovery-phrase-reveal"
          >
            {t("recoveryPhraseScreen.revealButtonText")}
          </Button>
        </View>
      </OnboardLayout>
    );
  }

  return (
    <OnboardLayout
      title={title}
      description={description}
      footerNoteText={t("recoveryPhraseScreen.warning")}
      footerNoteTone="warning"
      defaultActionButtonText={t("backupRecoveryPhraseScreen.create")}
      onPressDefaultActionButton={() =>
        navigation.navigate(MANAGE_WALLETS_ROUTES.VERIFY_PASSWORD_SCREEN, {
          kind: "newPhrase",
          pendingPhraseId,
          accountName,
        })
      }
    >
      <View className="mt-[8px] items-center gap-4">
        <RecoveryPhraseGrid
          words={phrase.split(" ")}
          testID="backup-recovery-phrase-value"
        />
        <CopyPhraseButton onCopy={handleCopy} />
      </View>
    </OnboardLayout>
  );
};

export default BackupRecoveryPhraseScreen;
