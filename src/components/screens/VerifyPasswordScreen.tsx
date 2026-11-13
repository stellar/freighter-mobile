import { NativeStackScreenProps } from "@react-navigation/native-stack";
import InputPasswordTemplate from "components/templates/InputPasswordTemplate";
import {
  MANAGE_WALLETS_ROUTES,
  ROOT_NAVIGATOR_ROUTES,
  ManageWalletsStackParamList,
} from "config/routes";
import { useAuthenticationStore, getActiveAccountPublicKey } from "ducks/auth";
import useAppTranslation from "hooks/useAppTranslation";
import React, { useCallback, useEffect, useState } from "react";

type VerifyPasswordScreenProps = NativeStackScreenProps<
  ManageWalletsStackParamList,
  typeof MANAGE_WALLETS_ROUTES.VERIFY_PASSWORD_SCREEN
>;

/**
 * The password step of Create new wallet and Import Recovery Phrase.
 * Confirms with the password, or Face ID when it's on, then creates what the
 * route names: an account under an existing phrase, the held new phrase and
 * its first account, or the held imported phrase and its accounts.
 */
const VerifyPasswordScreen: React.FC<VerifyPasswordScreenProps> = ({
  navigation,
  route,
}) => {
  const {
    createAccount,
    addRecoveryPhraseSource,
    importRecoveryPhrase,
    isCreatingAccount,
    error,
    clearError,
  } = useAuthenticationStore();
  const target = route.params;
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const { t } = useAppTranslation();

  useEffect(() => {
    clearError();
  }, [clearError]);

  useEffect(() => {
    const fetchActiveAccountPublicKey = async () => {
      const retrievedPublicKey = await getActiveAccountPublicKey();
      setPublicKey(retrievedPublicKey);
    };

    fetchActiveAccountPublicKey();
  }, []);

  const handleUnlock = useCallback(
    (password: string) => {
      if (isCreatingAccount) return;

      const create = (() => {
        switch (target.kind) {
          case "newPhrase":
            return addRecoveryPhraseSource(
              password,
              target.pendingPhraseId,
              target.accountName,
            );
          case "importPhrase":
            return importRecoveryPhrase(password, target.pendingPhraseId);
          default:
            return createAccount(password, target.sourceId, target.accountName);
        }
      })();

      create
        .then(() => {
          navigation.reset({
            index: 0,
            // @ts-expect-error: This is a valid route.
            routes: [{ name: ROOT_NAVIGATOR_ROUTES.MAIN_TAB_STACK }],
          });
        })
        // The store has set `error`, which the template shows.
        .catch(() => {});
    },
    [
      addRecoveryPhraseSource,
      createAccount,
      importRecoveryPhrase,
      isCreatingAccount,
      navigation,
      target,
    ],
  );

  return (
    <InputPasswordTemplate
      publicKey={publicKey}
      error={error}
      isLoading={isCreatingAccount}
      handleContinue={handleUnlock}
      continueButtonText={
        target.kind === "importPhrase"
          ? t("verifyPasswordScreen.actions.importRecoveryPhrase")
          : t("verifyPasswordScreen.actions.createNewWallet")
      }
      title={t("verifyPasswordScreen.verifyPasswordTemplateTitle")}
      description={t("verifyPasswordScreen.verifyPasswordTemplateDescription")}
      showLogo={false}
      insets={{ top: false, bottom: true }}
    />
  );
};

export default VerifyPasswordScreen;
