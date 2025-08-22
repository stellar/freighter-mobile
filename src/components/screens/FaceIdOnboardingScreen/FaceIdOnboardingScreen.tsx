import { NativeStackScreenProps } from "@react-navigation/native-stack";
import iPhoneFrameImage from "assets/iphone-frame.png";
import { OnboardLayout } from "components/layout/OnboardLayout";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import { useFaceId } from "hooks/useFaceId";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, View, Image } from "react-native";
import { Svg, Defs, Rect, LinearGradient, Stop, Path } from "react-native-svg";

type FaceIdOnboardingScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof ROOT_NAVIGATOR_ROUTES.FACE_ID_ONBOARDING_SCREEN
>;

export const FaceIdOnboardingScreen: React.FC<FaceIdOnboardingScreenProps> = ({
  navigation,
}) => {
  const { t } = useAppTranslation();
  const { setHasSeenFaceIdOnboarding } = useAuthenticationStore();
  const { setIsFaceIdEnabled } = useFaceId();
  const [shouldVerifyFaceId, setShouldVerifyFaceId] = useState(false);
  const [isVerifyingFaceId] = useState(false);

  const handleVerifyFaceId = useCallback(() => {
    setIsFaceIdEnabled(true);
    navigation.navigate(ROOT_NAVIGATOR_ROUTES.MAIN_TAB_STACK);
  }, [setIsFaceIdEnabled, navigation]);

  useEffect(() => {
    if (shouldVerifyFaceId) {
      setShouldVerifyFaceId(false);
      handleVerifyFaceId();
    }
  }, [shouldVerifyFaceId, handleVerifyFaceId]);

  const handleEnable = () => {
    Alert.alert(
      t("faceIdOnboardingScreen.promptTitle"),
      t("faceIdOnboardingScreen.promptDescription"),
      [
        {
          text: t("common.cancel"),
        },
        {
          text: t("common.allow"),
          onPress: () => setShouldVerifyFaceId(true),
        },
      ],
    );
  };

  const handleSkip = () => {
    setHasSeenFaceIdOnboarding(true);
    navigation.navigate(ROOT_NAVIGATOR_ROUTES.MAIN_TAB_STACK);
  };

  const BlurredBackgroundFaceIdIcon = (
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

  return (
    <OnboardLayout
      icon={<Icon.FaceId circle />}
      title={t("faceIdOnboardingScreen.title")}
      footerNoteText={t("faceIdOnboardingScreen.footerNoteText")}
      defaultActionButtonText={t("common.enable")}
      secondaryActionButtonText={t("common.skip")}
      onPressSecondaryActionButton={handleSkip}
      onPressDefaultActionButton={handleEnable}
      isLoading={isVerifyingFaceId}
      isDefaultActionButtonDisabled={isVerifyingFaceId}
    >
      <View className="pr-8">
        <Text secondary md>
          {t("faceIdOnboardingScreen.description")}
        </Text>
      </View>
      <View className="items-center">
        {BlurredBackgroundFaceIdIcon}
        {iPhoneFrame}
      </View>
    </OnboardLayout>
  );
};
