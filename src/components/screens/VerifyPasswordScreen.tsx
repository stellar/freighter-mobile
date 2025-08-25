import { NativeStackScreenProps } from "@react-navigation/native-stack";
import InputPasswordTemplate from "components/templates/InputPasswordTemplate";
import {
  MANAGE_WALLETS_ROUTES,
  ManageWalletsStackParamList,
  ROOT_NAVIGATOR_ROUTES,
} from "config/routes";
import { getActiveAccountPublicKey, useAuthenticationStore } from "ducks/auth";
import useAppTranslation from "hooks/useAppTranslation";
import {
  FACE_ID_BIOMETRY_TYPES,
  FINGERPRINT_BIOMETRY_TYPES,
  useBiometrics,
} from "hooks/useBiometrics";
import React, { useCallback, useEffect, useState } from "react";

type VerifyPasswordScreenProps = NativeStackScreenProps<
  ManageWalletsStackParamList,
  typeof MANAGE_WALLETS_ROUTES.VERIFY_PASSWORD_SCREEN
>;

enum BiometricsLoginType {
  FACE_ID = "faceId",
  FINGERPRINT = "fingerprint",
  PASSWORD = "password",
}

const VerifyPasswordScreen: React.FC<VerifyPasswordScreenProps> = ({
  navigation,
}) => {
  const { createAccount, isCreatingAccount, error, clearError } =
    useAuthenticationStore();
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const { t } = useAppTranslation();
  const [signInMethod, setSignInMethod] = useState<BiometricsLoginType>(
    BiometricsLoginType.PASSWORD,
  );
  const { biometryType } = useBiometrics();

  const handleSignInMethodChange = useCallback(
    (method: BiometricsLoginType) => {
      setSignInMethod(method);
    },
    [],
  );

  useEffect(() => {
    const checkBiometricsAvailability = () => {
      if (!biometryType) {
        setSignInMethod(BiometricsLoginType.PASSWORD);
        return;
      }
      if (FACE_ID_BIOMETRY_TYPES.includes(biometryType)) {
        setSignInMethod(BiometricsLoginType.FACE_ID);
      } else if (FINGERPRINT_BIOMETRY_TYPES.includes(biometryType)) {
        setSignInMethod(BiometricsLoginType.FINGERPRINT);
      } else {
        setSignInMethod(BiometricsLoginType.PASSWORD);
      }
    };
    checkBiometricsAvailability();
  }, [biometryType]);

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

      createAccount(password).then(() => {
        navigation.reset({
          index: 0,
          // @ts-expect-error: This is a valid route.
          routes: [{ name: ROOT_NAVIGATOR_ROUTES.MAIN_TAB_STACK }],
        });
      });
    },
    [createAccount, isCreatingAccount, navigation],
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
      signInMethod={signInMethod}
      setSignInMethod={handleSignInMethodChange}
    />
  );
};

export default VerifyPasswordScreen;
