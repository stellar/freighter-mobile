import { BlurView } from "@react-native-community/blur";
import { useNavigation } from "@react-navigation/native";
import {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";
import iPhoneFrameImage from "assets/iphone-frame.png";
import { OnboardLayout } from "components/layout/OnboardLayout";
import { IconPosition } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import {
  BiometricsSource,
  FACE_ID_BIOMETRY_TYPES,
  STORAGE_KEYS,
} from "config/constants";
import { logger } from "config/logger";
import {
  AUTH_STACK_ROUTES,
  AuthStackParamList,
  ROOT_NAVIGATOR_ROUTES,
  RootStackParamList,
} from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { useLoginDataStore } from "ducks/loginData";
import { isIOS } from "helpers/device";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import { useBiometrics } from "hooks/useBiometrics";
import useColors from "hooks/useColors";
import React, { useCallback, useMemo, useState } from "react";
import { View, Image } from "react-native";
import { BIOMETRY_TYPE } from "react-native-keychain";
import { Svg, Defs, Rect, LinearGradient, Stop } from "react-native-svg";
import { analytics } from "services/analytics";
import { dataStorage } from "services/storage/storageFactory";

type BiometricsOnboardingScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  typeof AUTH_STACK_ROUTES.BIOMETRICS_ENABLE_SCREEN
>;

/**
 * Unified component for displaying biometric icons with blurred background
 *
 * This component renders either a Face ID or fingerprint icon with a blurred
 * background overlay, automatically determining the appropriate icon and size
 * based on the biometry type. On Android, it uses a fallback background color
 * instead of blur to avoid rendering issues.
 *
 * @param {BIOMETRY_TYPE} iconBiometryType - The type of biometric authentication
 * @param {string} color - The color of the icon (defaults to white)
 * @param {number} [iconSize] - Optional custom icon size
 * @param {Object} iconContainerDimensions - The dimensions for the icon container
 * @returns {JSX.Element} The blurred background icon component
 */
const BlurredBackgroundIcon = ({
  iconBiometryType,
  color,
  iconSize,
  iconContainerDimensions,
}: {
  iconBiometryType: BIOMETRY_TYPE;
  color: string;
  iconSize?: number;
  iconContainerDimensions: { width: number; height: number };
}) => {
  const isFaceId = FACE_ID_BIOMETRY_TYPES.includes(iconBiometryType);
  const defaultIconSize = pxValue(80);
  const iconSizeToUse = iconSize ?? defaultIconSize;

  const IconComponent = isFaceId ? Icon.FaceId01 : Icon.TouchId;

  return (
    <View
      className="items-center justify-center mt-4 flex-grow-0"
      style={iconContainerDimensions}
    >
      <View
        style={{
          width: iconContainerDimensions.width,
          height: iconContainerDimensions.height,
          position: "relative",
        }}
      >
        {isIOS ? (
          <BlurView
            blurType="light"
            blurAmount={6}
            reducedTransparencyFallbackColor={color}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              bottom: 0,
              right: 0,
              borderRadius: Math.round(pxValue(16)), // care about rounded values for blurView
              zIndex: 1,
            }}
          />
        ) : (
          // Android fallback: use a semi-transparent background instead of blur
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: iconContainerDimensions.width,
              height: iconContainerDimensions.height,
              borderRadius: Math.round(pxValue(16)),
              backgroundColor: "rgba(255, 255, 255, 0.17)",
              zIndex: 1,
            }}
          />
        )}
        <View
          className="absolute inset-0 items-center justify-center"
          style={{ zIndex: 2 }}
        >
          <IconComponent color={color} size={iconSizeToUse} />
        </View>
      </View>
    </View>
  );
};

export const BiometricsOnboardingScreen: React.FC<
  BiometricsOnboardingScreenProps
> = ({ route }) => {
  const { t } = useAppTranslation();
  const {
    isLoading,
    signUp,
    importWallet,
    enableBiometrics: enableBiometricsAction,
  } = useAuthenticationStore();
  const { setIsBiometricsEnabled, biometryType } = useBiometrics();
  const { themeColors } = useColors();
  const { mnemonicPhrase, password: hookPassword } = useLoginDataStore();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [isProcessing, setIsProcessing] = useState(false);

  // Check if this is the pre-authentication flow (new) or post-authentication flow (existing)

  const enableBiometrics = useCallback(async () => {
    // In pre-auth flow, we need to store the password for biometrics and complete the signup
    const { source } = route.params;
    const password = hookPassword;

    if (source === BiometricsSource.POST_ONBOARDING) {
      await enableBiometricsAction(async () => {
        await dataStorage.setItem(
          STORAGE_KEYS.HAS_SEEN_BIOMETRICS_ENABLE_SCREEN,
          "true",
        );
        setIsBiometricsEnabled(true);
        navigation.navigate(ROOT_NAVIGATOR_ROUTES.MAIN_TAB_STACK);

        return Promise.resolve();
      });
      return;
    }

    if (!mnemonicPhrase || !password) {
      logger.error(
        "BiometricsOnboardingScreen",
        "Missing mnemonic phrase",
        "mnemonicPhrase or password is missing",
      );
      return;
    }

    try {
      await enableBiometricsAction(async (biometricPassword) => {
        await dataStorage.setItem(
          STORAGE_KEYS.HAS_SEEN_BIOMETRICS_ENABLE_SCREEN,
          "true",
        );

        // Use importWallet for import flow, signUp for onboarding flow
        if (source === BiometricsSource.IMPORT_WALLET) {
          await importWallet({
            mnemonicPhrase,
            password: biometricPassword ?? hookPassword,
          });
        } else {
          await signUp({
            mnemonicPhrase,
            password: biometricPassword ?? hookPassword,
          });
        }

        setIsBiometricsEnabled(true);
        return Promise.resolve();
      });

      analytics.track(AnalyticsEvent.ACCOUNT_CREATOR_FINISHED);
    } catch (error) {
      logger.error(
        "BiometricsOnboardingScreen",
        "Failed to complete authentication with biometrics",
        error,
      );
    }
  }, [
    route.params,
    setIsBiometricsEnabled,
    signUp,
    importWallet,
    enableBiometricsAction,
    navigation,
    mnemonicPhrase,
    hookPassword,
  ]);

  const handleSkip = useCallback(async () => {
    setIsProcessing(true);
    const { source } = route.params;
    const password = hookPassword;
    await dataStorage.setItem(
      STORAGE_KEYS.HAS_SEEN_BIOMETRICS_ENABLE_SCREEN,
      "true",
    );

    if (source === BiometricsSource.POST_ONBOARDING) {
      navigation.goBack();
      return;
    }

    if (!mnemonicPhrase || !password) {
      logger.error(
        "BiometricsOnboardingScreen",
        "Missing mnemonic phrase or password",
        "mnemonicPhrase or password is missing",
      );
      return;
    }

    try {
      // Use importWallet for import flow, signUp for onboarding flow
      if (source === BiometricsSource.IMPORT_WALLET) {
        await importWallet({
          mnemonicPhrase,
          password: hookPassword,
        });
      } else {
        await signUp({
          mnemonicPhrase,
          password: hookPassword,
        });
      }

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
  }, [
    route.params,
    signUp,
    importWallet,
    navigation,
    mnemonicPhrase,
    hookPassword,
  ]);

  const handleSkipPress = useCallback(async () => {
    setTimeout(() => {
      setIsProcessing(true);
    }); // throw it out of the event loop to avoid react batching the state update
    await handleSkip();
    setIsProcessing(false);
  }, [handleSkip]);

  const handleEnableBiometricsPress = useCallback(async () => {
    setTimeout(() => {
      setIsProcessing(true);
    }); // throw it out of the event loop to avoid react batching the state update
    await enableBiometrics();
    setIsProcessing(false);
  }, [enableBiometrics]);

  const iconContainerDimensions = {
    width: pxValue(104),
    height: pxValue(104),
  };

  const iPhoneFrameDimensions = {
    width: pxValue(354),
    height: pxValue(300),
  };

  const iPhoneFrameSvgProperties = {
    width: pxValue(354),
    height: pxValue(300),
    viewBox: `0 0 ${Math.round(pxValue(354))} ${Math.round(pxValue(300))}`,
  };

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

  if (!biometryType) {
    return null;
  }

  return (
    <OnboardLayout
      icon={getIcon()}
      title={biometryTitle[biometryType] ?? ""}
      footerNoteText={footerNoteText[biometryType] ?? ""}
      defaultActionButtonIcon={getIcon(themeColors.foreground.primary, false)}
      defaultActionButtonIconPosition={IconPosition.LEFT}
      defaultActionButtonText={t("common.enable")}
      secondaryActionButtonText={t("common.skip")}
      onPressSecondaryActionButton={handleSkipPress}
      onPressDefaultActionButton={handleEnableBiometricsPress}
      isLoading={isLoading || isProcessing}
      isDefaultActionButtonDisabled={isLoading || isProcessing}
      isSecondaryActionButtonDisabled={isLoading || isProcessing}
    >
      <View className="pr-8">
        <Text secondary md>
          {biometryDescription[biometryType] ?? ""}
        </Text>
      </View>
      <View className="items-center">
        <BlurredBackgroundIcon
          iconBiometryType={biometryType}
          color={themeColors.white}
          iconContainerDimensions={iconContainerDimensions}
        />

        {iPhoneFrame}
      </View>
    </OnboardLayout>
  );
};
