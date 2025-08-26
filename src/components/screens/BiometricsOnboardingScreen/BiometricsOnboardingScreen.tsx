import { NativeStackScreenProps } from "@react-navigation/native-stack";
import iPhoneFrameImage from "assets/iphone-frame.png";
import { OnboardLayout } from "components/layout/OnboardLayout";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import { FACE_ID_BIOMETRY_TYPES } from "config/constants";
import { logger } from "config/logger";
import { AUTH_STACK_ROUTES, AuthStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import { useBiometrics } from "hooks/useBiometrics";
import useColors from "hooks/useColors";
import React, { useCallback, useMemo } from "react";
import { Alert, View, Image } from "react-native";
import { BIOMETRY_TYPE } from "react-native-keychain";
import {
  Svg,
  Defs,
  Rect,
  LinearGradient,
  Stop,
  Path,
  G,
} from "react-native-svg";
import { analytics } from "services/analytics";

type BiometricsOnboardingScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  typeof AUTH_STACK_ROUTES.BIOMETRICS_ONBOARDING_SCREEN
>;

export const BiometricsOnboardingScreen: React.FC<
  BiometricsOnboardingScreenProps
> = ({ route }) => {
  const { t } = useAppTranslation();
  const { isLoading, signUp } = useAuthenticationStore();
  const { setIsBiometricsEnabled, biometryType } = useBiometrics();
  const { themeColors } = useColors();

  // Check if this is the pre-authentication flow (new) or post-authentication flow (existing)

  const enableBiometrics = useCallback(() => {
    // In pre-auth flow, we need to store the password for biometrics and complete the signup
    const { password, mnemonicPhrase } = route.params;

    if (!mnemonicPhrase) {
      logger.error(
        "BiometricsOnboardingScreen",
        "Missing mnemonic phrase for pre-auth flow",
      );
      return;
    }

    try {
      // Store the password for biometrics
      setIsBiometricsEnabled(true);

      signUp({
        mnemonicPhrase,
        password,
      });

      // Track analytics for successful completion
      analytics.track(AnalyticsEvent.ACCOUNT_CREATOR_FINISHED);
    } catch (error) {
      logger.error(
        "BiometricsOnboardingScreen",
        "Failed to complete authentication with biometrics",
        error,
      );
      // Handle error appropriately
    }
  }, [route.params, setIsBiometricsEnabled, signUp]);

  const promptTitle: Partial<Record<BIOMETRY_TYPE, string>> = useMemo(
    () => ({
      [BIOMETRY_TYPE.FACE_ID]: t(
        "biometricsOnboardingScreen.faceId.promptTitle",
      ),
      [BIOMETRY_TYPE.FINGERPRINT]: t(
        "biometricsOnboardingScreen.fingerprint.promptTitle",
      ),
      [BIOMETRY_TYPE.TOUCH_ID]: t(
        "biometricsOnboardingScreen.touchId.promptTitle",
      ),
      [BIOMETRY_TYPE.FACE]: t(
        "biometricsOnboardingScreen.faceBiometrics.promptTitle",
      ),
    }),
    [t],
  );

  const promptDescription: Partial<Record<BIOMETRY_TYPE, string>> = useMemo(
    () => ({
      [BIOMETRY_TYPE.FACE_ID]: t(
        "biometricsOnboardingScreen.faceId.promptDescription",
      ),
      [BIOMETRY_TYPE.FINGERPRINT]: t(
        "biometricsOnboardingScreen.fingerprint.promptDescription",
      ),
      [BIOMETRY_TYPE.TOUCH_ID]: t(
        "biometricsOnboardingScreen.touchId.promptDescription",
      ),
      [BIOMETRY_TYPE.FACE]: t(
        "biometricsOnboardingScreen.faceBiometrics.promptDescription",
      ),
    }),
    [t],
  );

  const handleEnable = () => {
    Alert.alert(
      promptTitle[biometryType!] ?? "",
      promptDescription[biometryType!] ?? "",
      [
        {
          text: t("common.cancel"),
        },
        {
          text: t("common.allow"),
          onPress: enableBiometrics,
        },
      ],
    );
  };

  const handleSkip = () => {
    // In pre-auth flow, complete the signup/import without biometrics
    const { password, mnemonicPhrase } = route.params;

    if (!mnemonicPhrase) {
      logger.error(
        "BiometricsOnboardingScreen",
        "Missing mnemonic phrase for pre-auth flow",
      );
      return;
    }

    try {
      signUp({
        mnemonicPhrase,
        password,
      });

      // Track analytics for successful completion
      analytics.track(AnalyticsEvent.ACCOUNT_CREATOR_FINISHED);
    } catch (error) {
      logger.error(
        "BiometricsOnboardingScreen",
        "Failed to complete authentication",
        error,
      );
      // Handle error appropriately
    }
  };

  const BlurredBackgroundBiometricsIcon = (
    <View
      className="items-center justify-center mt-4 flex-grow-0 relative z-10"
      style={{ width: pxValue(104), height: pxValue(104) }}
    >
      <Svg width={pxValue(104)} height={pxValue(104)} viewBox="0 0 104 104">
        {/* Blurred background with rounded corners */}
        <Rect
          width="104"
          height="104"
          rx="16"
          fill="rgba(255, 255, 255, 0.24)"
        />
        {/* Face ID icon path */}
        <Path
          d="M40 25H39.4C34.3595 25 31.8393 25 29.9141 25.9809C28.2206 26.8438 26.8438 28.2206 25.9809 29.9141C25 31.8393 25 34.3595 25 39.4V40M40 79H39.4C34.3595 79 31.8393 79 29.9141 78.0191C28.2206 77.1562 26.8438 75.7794 25.9809 74.0859C25 72.1607 25 69.6405 25 64.6V64M79 40V39.4C79 34.3595 79 31.8393 78.0191 29.9141C77.1562 28.2206 75.7794 26.8438 74.0859 25.9809C72.1607 25 69.6405 25 64.6 25H64M79 64V64.6C79 69.6405 79 72.1607 78.0191 74.0859C77.1562 75.7794 75.7794 77.1562 74.0859 78.0191C72.1607 79 69.6405 79 64.6 79H64M38.5 40V44.5M65.5 40V44.5M49 53.8003C51.4 53.8003 53.5 51.7003 53.5 49.3003V40M61.6006 61.5999C56.2006 66.9999 47.5006 66.9999 42.1006 61.5999"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );

  const BlurredBackgroundFingerprintIcon = (
    <View
      className="items-center justify-center mt-4 flex-grow-0 relative z-10"
      style={{ width: pxValue(104), height: pxValue(104) }}
    >
      <Svg width={pxValue(104)} height={pxValue(104)} viewBox="0 0 104 104">
        {/* Blurred background with rounded corners */}
        <Rect
          width="104"
          height="104"
          rx="16"
          fill="rgba(255, 255, 255, 0.24)"
        />
        <G>
          <Icon.Fingerprint05 color={themeColors.white} size={pxValue(104)} />
        </G>
      </Svg>
    </View>
  );

  const iPhoneFrame = (
    <View className="items-center justify-center -mt-[64px] relative z-0">
      <View className="relative">
        <Image
          source={iPhoneFrameImage}
          style={{ width: pxValue(354), height: pxValue(300) }}
          resizeMode="contain"
        />
        {/* Gradient Mask Overlay */}
        <View className="absolute inset-0">
          <Svg width={pxValue(354)} height={pxValue(300)} viewBox="0 0 354 300">
            <Defs>
              <LinearGradient
                id="paint0_linear_6563_78245"
                x1="177"
                y1="78"
                x2="177"
                y2="300"
                gradientUnits="userSpaceOnUse"
              >
                <Stop offset="0" stopColor="#161616" stopOpacity="0" />
                <Stop offset="1" stopColor="#161616" stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Rect
              width="354"
              height="300"
              fill="url(#paint0_linear_6563_78245)"
            />
          </Svg>
        </View>
      </View>
    </View>
  );

  const getIcon = useCallback(() => {
    if (biometryType && FACE_ID_BIOMETRY_TYPES.includes(biometryType)) {
      return <Icon.FaceId circle />;
    }
    return <Icon.Fingerprint01 circle />;
  }, [biometryType]);

  const biometryTitle: Partial<Record<BIOMETRY_TYPE, string>> = useMemo(
    () => ({
      [BIOMETRY_TYPE.FACE_ID]: t("biometricsOnboardingScreen.faceId.title"),
      [BIOMETRY_TYPE.FINGERPRINT]: t(
        "biometricsOnboardingScreen.fingerprint.title",
      ),
      [BIOMETRY_TYPE.TOUCH_ID]: t("biometricsOnboardingScreen.touchId.title"),
      [BIOMETRY_TYPE.FACE]: t(
        "biometricsOnboardingScreen.faceBiometrics.title",
      ),
    }),
    [t],
  );

  const biometryDescription: Partial<Record<BIOMETRY_TYPE, string>> = useMemo(
    () => ({
      [BIOMETRY_TYPE.FACE_ID]: t(
        "biometricsOnboardingScreen.faceId.description",
      ),
      [BIOMETRY_TYPE.FINGERPRINT]: t(
        "biometricsOnboardingScreen.fingerprint.description",
      ),
      [BIOMETRY_TYPE.TOUCH_ID]: t(
        "biometricsOnboardingScreen.touchId.description",
      ),
      [BIOMETRY_TYPE.FACE]: t(
        "biometricsOnboardingScreen.faceBiometrics.description",
      ),
    }),
    [t],
  );

  const footerNoteText: Partial<Record<BIOMETRY_TYPE, string>> = useMemo(
    () => ({
      [BIOMETRY_TYPE.FACE_ID]: t(
        "biometricsOnboardingScreen.faceId.footerNoteText",
      ),
      [BIOMETRY_TYPE.FINGERPRINT]: t(
        "biometricsOnboardingScreen.fingerprint.footerNoteText",
      ),
      [BIOMETRY_TYPE.TOUCH_ID]: t(
        "biometricsOnboardingScreen.touchId.footerNoteText",
      ),
      [BIOMETRY_TYPE.FACE]: t(
        "biometricsOnboardingScreen.faceBiometrics.footerNoteText",
      ),
    }),
    [t],
  );

  return (
    <OnboardLayout
      icon={getIcon()}
      title={biometryTitle[biometryType!] ?? ""}
      footerNoteText={footerNoteText[biometryType!] ?? ""}
      defaultActionButtonText={t("common.enable")}
      secondaryActionButtonText={t("common.skip")}
      onPressSecondaryActionButton={handleSkip}
      onPressDefaultActionButton={handleEnable}
      isLoading={isLoading}
      isDefaultActionButtonDisabled={isLoading}
    >
      <View className="pr-8">
        <Text secondary md>
          {biometryDescription[biometryType!] ?? ""}
        </Text>
      </View>
      <View className="items-center">
        {biometryType && FACE_ID_BIOMETRY_TYPES.includes(biometryType)
          ? BlurredBackgroundBiometricsIcon
          : BlurredBackgroundFingerprintIcon}
        {iPhoneFrame}
      </View>
    </OnboardLayout>
  );
};
