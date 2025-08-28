import { NativeStackScreenProps } from "@react-navigation/native-stack";
import iPhoneFrameImage from "assets/iphone-frame.png";
import { OnboardLayout } from "components/layout/OnboardLayout";
import { IconPosition } from "components/sds/Button";
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
import { View, Image } from "react-native";
import { BIOMETRY_TYPE } from "react-native-keychain";
import { Svg, Defs, Rect, LinearGradient, Stop } from "react-native-svg";
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
  const { verifyActionWithBiometrics } = useAuthenticationStore();

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

      verifyActionWithBiometrics(() => {
        signUp({
          mnemonicPhrase,
          password,
        });
        return Promise.resolve();
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
  }, [
    route.params,
    setIsBiometricsEnabled,
    signUp,
    verifyActionWithBiometrics,
  ]);

  const handleSkip = () => {
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

  const iconContainerDimensions = {
    width: pxValue(104),
    height: pxValue(104),
  };

  const iconSize = pxValue(80);

  const iconSvgProperties = {
    ...iconContainerDimensions,
    viewBox: `0 0 ${pxValue(104)} ${pxValue(104)}`,
    rx: pxValue(16),
    fill: "rgba(255, 255, 255, 0.28)",
  };

  const BlurredBackgroundBiometricsIcon = (
    <View
      className="items-center justify-center mt-4 flex-grow-0 relative z-10"
      style={iconContainerDimensions}
    >
      <Svg {...iconSvgProperties}>
        {/* Blurred background with rounded corners */}
        <Rect {...iconSvgProperties} />
      </Svg>
      <View className="absolute inset-0 items-center justify-center">
        <Icon.FaceId01 color={themeColors.white} size={iconSize} />
      </View>
    </View>
  );

  const iPhoneFrameDimensions = {
    width: pxValue(354),
    height: pxValue(300),
  };

  const iPhoneFrameSvgProperties = {
    width: pxValue(354),
    height: pxValue(300),
    viewBox: `0 0 ${pxValue(354)} ${pxValue(300)}`,
  };

  const BlurredBackgroundFingerprintIcon = (
    <View
      className="items-center justify-center mt-4 flex-grow-0 relative z-10"
      style={iconContainerDimensions}
    >
      <Svg {...iconSvgProperties}>
        {/* Blurred background with rounded corners */}
        <Rect {...iconSvgProperties} />
      </Svg>
      <View className="absolute inset-0 items-center justify-center">
        <Icon.Fingerprint05 color={themeColors.white} size={iconSize} />
      </View>
    </View>
  );

  const iPhoneFrame = (
    <View className="items-center justify-center -mt-[64px] relative z-0">
      <View className="relative">
        <Image
          source={iPhoneFrameImage}
          style={iPhoneFrameDimensions}
          resizeMode="contain"
        />
        {/* Gradient Mask Overlay */}
        <View className="absolute inset-0">
          <Svg {...iPhoneFrameSvgProperties}>
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
              {...iPhoneFrameSvgProperties}
              fill="url(#paint0_linear_6563_78245)"
            />
          </Svg>
        </View>
      </View>
    </View>
  );

  const getIcon = useCallback(
    (color?: string, circle?: boolean) => {
      if (biometryType && FACE_ID_BIOMETRY_TYPES.includes(biometryType)) {
        return <Icon.FaceId circle={circle} color={color} />;
      }
      return <Icon.Fingerprint01 circle={circle} color={color} />;
    },
    [biometryType],
  );

  const biometryTitle: Record<BIOMETRY_TYPE, string> = useMemo(
    () => ({
      [BIOMETRY_TYPE.FACE_ID]: t("biometricsOnboardingScreen.faceId.title"),
      [BIOMETRY_TYPE.FINGERPRINT]: t(
        "biometricsOnboardingScreen.fingerprint.title",
      ),
      [BIOMETRY_TYPE.TOUCH_ID]: t("biometricsOnboardingScreen.touchId.title"),
      [BIOMETRY_TYPE.FACE]: t(
        "biometricsOnboardingScreen.faceBiometrics.title",
      ),
      [BIOMETRY_TYPE.OPTIC_ID]: t("biometricsOnboardingScreen.opticId.title"),
      [BIOMETRY_TYPE.IRIS]: t("biometricsOnboardingScreen.iris.title"),
    }),
    [t],
  );

  const biometryDescription: Record<BIOMETRY_TYPE, string> = useMemo(
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
      [BIOMETRY_TYPE.OPTIC_ID]: t(
        "biometricsOnboardingScreen.opticId.footerNoteText",
      ),
      [BIOMETRY_TYPE.IRIS]: t("biometricsOnboardingScreen.iris.footerNoteText"),
    }),
    [t],
  );

  const footerNoteText: Record<BIOMETRY_TYPE, string> = useMemo(
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
      [BIOMETRY_TYPE.OPTIC_ID]: t(
        "biometricsOnboardingScreen.opticId.footerNoteText",
      ),
      [BIOMETRY_TYPE.IRIS]: t("biometricsOnboardingScreen.iris.footerNoteText"),
    }),
    [t],
  );

  return (
    <OnboardLayout
      icon={getIcon()}
      title={biometryTitle[biometryType!] ?? ""}
      footerNoteText={footerNoteText[biometryType!] ?? ""}
      defaultActionButtonIcon={getIcon(themeColors.foreground.primary, false)}
      defaultActionButtonIconPosition={IconPosition.LEFT}
      defaultActionButtonText={t("common.enable")}
      secondaryActionButtonText={t("common.skip")}
      onPressSecondaryActionButton={handleSkip}
      onPressDefaultActionButton={enableBiometrics}
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
