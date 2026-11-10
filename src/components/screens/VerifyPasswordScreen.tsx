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
 * The password step of Create new wallet. Confirms with the password, or
 * Face ID when it's on, then creates what the route names: an account under
 * an existing phrase, or the held new phrase and its first account.
 */
const VerifyPasswordScreen: React.FC<VerifyPasswordScreenProps> = ({
  navigation,
  route,
}) => {
  const {
    createAccount,
    addRecoveryPhraseSource,
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

      const create =
        target.kind === "newPhrase"
          ? addRecoveryPhraseSource(
              password,
              target.pendingPhraseId,
              target.accountName,
            )
          : createAccount(password, target.sourceId, target.accountName);

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
      continueButtonText={t("verifyPasswordScreen.actions.createNewWallet")}
      title={t("verifyPasswordScreen.verifyPasswordTemplateTitle")}
      description={t("verifyPasswordScreen.verifyPasswordTemplateDescription")}
      showLogo={false}
      insets={{ top: false, bottom: true }}
    />
  );
};

export default VerifyPasswordScreen;
