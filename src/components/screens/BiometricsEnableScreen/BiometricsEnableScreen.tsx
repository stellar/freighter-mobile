import { BlurView } from "@react-native-community/blur";
import { useNavigation } from "@react-navigation/native";
import {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";
import { images } from "assets/images";
import { OnboardLayout } from "components/layout/OnboardLayout";
import { IconPosition } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { colors } from "config/colors";
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
import { DEFAULT_COLOR_SCHEME } from "config/theme";
import { useAuthenticationStore } from "ducks/auth";
import { useLoginDataStore } from "ducks/loginData";
import { isIOS } from "helpers/device";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import { useBiometrics } from "hooks/useBiometrics";
import useColors from "hooks/useColors";
import { useSetupFailedToast } from "hooks/useSetupFailedToast";
import useTheme from "hooks/useTheme";
import React, { useCallback, useMemo, useState } from "react";
import { View, Image, useColorScheme } from "react-native";
import { BIOMETRY_TYPE } from "react-native-keychain";
import { Svg, Defs, Rect, LinearGradient, Stop } from "react-native-svg";
import { dataStorage } from "services/storage/storageFactory";

type BiometricsOnboardingScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  typeof AUTH_STACK_ROUTES.BIOMETRICS_ENABLE_SCREEN
>;

/**
 * The Face ID / Touch ID badge is a frosted card floating over the phone
 * artwork, so it takes its contrast from its own surface rather than from the
 * page. Values read from the Varial onboarding screens in Figma:
 * light https://www.figma.com/design/lcdj2ucnJ2BfvRvsLboBNC/Varial?node-id=1-11981
 * dark  https://www.figma.com/design/lcdj2ucnJ2BfvRvsLboBNC/Varial?node-id=760-36930
 *
 * Both glyphs are palette tokens: Figma binds the light card to Colors/Base/1
 * and the dark one to Colors/Lime/9. base[1] is the scheme's ink, so the light
 * glyph reads it from the light ramp -- base[0] there is the page white, which
 * would erase the glyph against its own light card.
 *
 * `blurType` carries the tint on iOS: these materials are translucent, so the
 * blurred iPhone artwork still reads through the card. `surface` is the flat
 * stand-in for where no live blur exists -- Android, and iOS under
 * reduce-transparency. Painting it over the blur as well stacks two tints and
 * makes the card opaque, which defeats the point of blurring anything.
 */
export const BIOMETRIC_BADGE = {
  light: {
    blurType: "light",
    blurAmount: 6,
    surface: "rgba(255, 255, 255, 0.7)",
    glyph: colors.light.base[1],
  },
  dark: {
    blurType: "dark",
    blurAmount: 5,
    surface: "rgba(0, 0, 0, 0.56)",
    glyph: colors.dark.lime[9],
  },
} as const;

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
  iconSize,
  iconContainerDimensions,
}: {
  iconBiometryType: BIOMETRY_TYPE;
  iconSize?: number;
  iconContainerDimensions: { width: number; height: number };
}) => {
  const colorScheme = useColorScheme() ?? DEFAULT_COLOR_SCHEME;
  const theme = useTheme();
  const badge = BIOMETRIC_BADGE[colorScheme];
  const isFaceId = FACE_ID_BIOMETRY_TYPES.includes(iconBiometryType);
  const defaultIconSize = pxValue(80);
  const iconSizeToUse = iconSize ?? defaultIconSize;

  const IconComponent = isFaceId ? Icon.FaceId01 : Icon.TouchId;

  return (
    <View
      className="items-center justify-center mt-4 flex-grow-0 z-10"
      style={iconContainerDimensions}
    >
      <View
        style={{
          width: iconContainerDimensions.width,
          height: iconContainerDimensions.height,
          position: "relative",
          // On iOS, borderRadius set directly on BlurView doesn't clip the
          // native blur effect, so we round + clip here on the parent instead.
          borderRadius: Math.round(pxValue(16)),
          borderWidth: pxValue(1),
          borderColor: theme.colors.border.default,
          overflow: "hidden",
        }}
      >
        {isIOS ? (
          <BlurView
            blurType={badge.blurType}
            blurAmount={badge.blurAmount}
            reducedTransparencyFallbackColor={badge.surface}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              bottom: 0,
              right: 0,
              zIndex: 1,
            }}
          />
        ) : (
          // Android has no backdrop blur, so it gets the flat fill instead.
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              bottom: 0,
              right: 0,
              backgroundColor: badge.surface,
              zIndex: 1,
            }}
          />
        )}
        <View
          className="absolute inset-0 items-center justify-center"
          style={{ zIndex: 2 }}
        >
          <IconComponent color={badge.glyph} size={iconSizeToUse} />
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
  const { mnemonicPhrase, password, clearLoginData } = useLoginDataStore();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [isProcessing, setIsProcessing] = useState(false);

  // Wallet creation (signUp / importWallet) is deferred to this step, so a
  // failure here isn't a generic "sign up" error — show a setup-specific
  // message.
  const notifySetupFailed = useSetupFailedToast();

  // Check if this is the pre-authentication flow (new) or post-authentication flow (existing)

  const enableBiometrics = useCallback(async () => {
    // In pre-auth flow, we need to store the password for biometrics and complete the signup
    const { source } = route.params;

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

        // Use importWallet for import flow, signUp for onboarding flow.
        // These return false (rather than throwing) on failure — bail out so we
        // don't clear login data / enable biometrics on a failed setup.
        const success =
          source === BiometricsSource.IMPORT_WALLET
            ? await importWallet({
                mnemonicPhrase,
                password: biometricPassword ?? password,
              })
            : await signUp({
                mnemonicPhrase,
                password: biometricPassword ?? password,
              });

        if (!success) {
          throw new Error("Wallet setup failed during biometric enable");
        }

        clearLoginData(); // Clear sensitive data after successful authentication
        setIsBiometricsEnabled(true);
        return Promise.resolve();
      });

      // onboarding.completed / account_recovery.completed now fire from the
      // signUp / importWallet store actions respectively (single terminal
      // point), so the biometrics screen no longer emits completion itself.
    } catch (error) {
      logger.error(
        "BiometricsOnboardingScreen",
        "Failed to complete authentication with biometrics",
        error,
      );
      notifySetupFailed();
    }
  }, [
    route.params,
    setIsBiometricsEnabled,
    signUp,
    importWallet,
    enableBiometricsAction,
    navigation,
    mnemonicPhrase,
    password,
    clearLoginData,
    notifySetupFailed,
  ]);

  const handleSkip = useCallback(async () => {
    setIsProcessing(true);
    const { source } = route.params;
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
      // Use importWallet for import flow, signUp for onboarding flow.
      // Both return false (rather than throwing) on failure.
      const success =
        source === BiometricsSource.IMPORT_WALLET
          ? await importWallet({ mnemonicPhrase, password })
          : await signUp({ mnemonicPhrase, password });

      if (!success) {
        notifySetupFailed();
      }

      // Completion (onboarding.completed / account_recovery.completed) is
      // emitted from the signUp / importWallet store actions, not here.
    } catch (error) {
      logger.error(
        "BiometricsOnboardingScreen",
        "Failed to complete authentication",
        error,
      );
      notifySetupFailed();
    }
  }, [
    route.params,
    signUp,
    importWallet,
    navigation,
    mnemonicPhrase,
    password,
    notifySetupFailed,
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
          source={images.iPhoneFrame}
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
                <Stop
                  offset="0"
                  stopColor={themeColors.background.primary}
                  stopOpacity="0"
                />
                <Stop
                  offset="1"
                  stopColor={themeColors.background.primary}
                  stopOpacity="1"
                />
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
    (circle?: boolean) => {
      if (biometryType && FACE_ID_BIOMETRY_TYPES.includes(biometryType)) {
        return <Icon.FaceId circle={circle} />;
      }
      return <Icon.Fingerprint01 circle={circle} />;
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
      defaultActionButtonIcon={getIcon(false)}
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
          iconContainerDimensions={iconContainerDimensions}
        />

        {iPhoneFrame}
      </View>
    </OnboardLayout>
  );
};
