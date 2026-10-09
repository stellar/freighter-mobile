import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { WelcomeHeader } from "components/WelcomeHeader";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import { Text } from "components/sds/Typography";
import { FREIGHTER_TERMS_URL, FREIGHTER_PRIVACY_URL } from "config/constants";
import { AUTH_STACK_ROUTES, AuthStackParamList } from "config/routes";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { StyleSheet, View } from "react-native";

type WelcomeScreenProps = {
  navigation: NativeStackNavigationProp<
    AuthStackParamList,
    typeof AUTH_STACK_ROUTES.WELCOME_SCREEN
  >;
};

// A StyleSheet rather than NativeWind classes: the SDS Text takes no
// className, so its overrides go through the style prop.
const styles = StyleSheet.create({
  link: {
    textDecorationLine: "underline",
  },
});

/**
 * The Create/Import entry screen, shown whenever there is no wallet on the
 * device: on a fresh install, and after a wipe such as Forgot password.
 *
 * Design: https://www.figma.com/design/lcdj2ucnJ2BfvRvsLboBNC/Varial?node-id=650-6360
 * (light) and ?node-id=760-37023 (dark).
 */
export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ navigation }) => {
  const { t } = useAppTranslation();

  const navigateToScreen = (isImporting: boolean) => {
    navigation.push(AUTH_STACK_ROUTES.CHOOSE_PASSWORD_SCREEN, {
      isImporting,
    });
  };

  // The spacers share the free height in the Figma frame's proportions: on
  // the 402x874 phone it was drawn on, the header and the buttons land at the
  // frame's y-positions, 254 and 572, and on other heights every gap scales
  // by the same factor. The last gap is 116, not the frame's 130, because
  // BaseLayout's bottom padding sits the terms line higher than the frame.
  return (
    <BaseLayout useSafeArea>
      <View className="flex-1" testID="welcome-screen">
        <View className="grow-[168]" />
        <WelcomeHeader title={t("welcomeScreen.title")} />
        <View className="grow-[146]" />
        <View className="gap-[8px]">
          <Button
            secondary
            xl
            testID="create-wallet-button"
            onPress={() => navigateToScreen(false)}
          >
            {t("welcomeScreen.createNewWallet")}
          </Button>
          <Button
            tertiary
            xl
            testID="import-wallet-button"
            onPress={() => navigateToScreen(true)}
          >
            {t("welcomeScreen.importWallet")}
          </Button>
        </View>
        <View className="grow-[116]" />
        <Text xs secondary textAlign="center">
          {t("welcomeScreen.terms.beforeTermsLink")}
          <Text
            xs
            secondary
            url={FREIGHTER_TERMS_URL}
            accessibilityRole="link"
            style={styles.link}
          >
            {t("welcomeScreen.terms.termsLink")}
          </Text>
          {t("welcomeScreen.terms.betweenLinks")}
          <Text
            xs
            secondary
            url={FREIGHTER_PRIVACY_URL}
            accessibilityRole="link"
            style={styles.link}
          >
            {t("welcomeScreen.terms.privacyPolicyLink")}
          </Text>
          {t("welcomeScreen.terms.afterPrivacyPolicyLink")}
        </Text>
      </View>
    </BaseLayout>
  );
};
