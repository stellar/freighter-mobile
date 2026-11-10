import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { FOCUS_RING_WIDTH } from "components/FocusRing";
import { PasswordField } from "components/PasswordField";
import { RecoveryPhraseGrid } from "components/RecoveryPhraseGrid";
import { BaseLayout } from "components/layout/BaseLayout";
import { BiometricToggleButton } from "components/sds/BiometricToggleButton";
import { Button, IconPosition } from "components/sds/Button";
import { Checkbox } from "components/sds/Checkbox";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent, buildScreenViewedProps } from "config/analyticsConfig";
import { LoginType } from "config/constants";
import { SETTINGS_ROUTES, SettingsStackParamList } from "config/routes";
import {
  revealAccountSecretKey,
  revealRecoveryPhrase,
  useAuthenticationStore,
} from "ducks/auth";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import { useSecureClipboard } from "hooks/useSecureClipboard";
import React, { useEffect, useState } from "react";
import { Trans } from "react-i18next";
import { ScrollView, StyleSheet, View } from "react-native";
import { analytics } from "services/analytics";
import { track } from "services/analytics/core";

type RevealSecretScreenProps = NativeStackScreenProps<
  SettingsStackParamList,
  typeof SETTINGS_ROUTES.REVEAL_SECRET_SCREEN
>;

/*
  One reveal flow for both secrets an account can offer from Edit account.

  consent: the warning and the acknowledgement.
  password: re-authentication, with biometrics when they're on.
  revealed: the secret and Tap to copy.
*/
type Step = "consent" | "password" | "revealed";

// See ShowRecoveryPhraseScreen: the scroll view reaches past the page padding
// by the focus ring's width so the password field's ring keeps its sides.
const styles = StyleSheet.create({
  scroll: { marginHorizontal: -FOCUS_RING_WIDTH },
  scrollContent: { paddingHorizontal: FOCUS_RING_WIDTH, flexGrow: 1 },
});

/** The red "Never share" card every step opens with. */
const NeverShareBanner: React.FC<{ title: string; body: string }> = ({
  title,
  body,
}) => {
  const { themeColors } = useColors();

  return (
    <View
      className="bg-red-3 rounded-2xl px-4 py-3 gap-2 border border-red-6"
      accessibilityRole="alert"
      testID="reveal-secret-banner"
    >
      <View className="flex-row items-center gap-2">
        <Icon.AlertCircle size={16} color={themeColors.status.error} />
        <Text sm medium color={themeColors.status.error}>
          {title}
        </Text>
      </View>
      <Text sm primary>
        {body}
      </Text>
    </View>
  );
};

const RevealSecretScreen: React.FC<RevealSecretScreenProps> = ({
  navigation,
  route,
}) => {
  const { params } = route;
  const isPhrase = params.kind === "recoveryPhrase";
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { signInMethod } = useAuthenticationStore();
  const { copyToClipboard } = useSecureClipboard();
  const [step, setStep] = useState<Step>("consent");
  const [hasAcknowledged, setHasAcknowledged] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [secret, setSecret] = useState("");

  // Each key is written out in full so the translation lint can find it.
  const copy = isPhrase
    ? {
        title: t("revealSecretScreen.recoveryPhrase.title"),
        revealedTitle: t("revealSecretScreen.recoveryPhrase.revealedTitle"),
        bannerTitle: t("revealSecretScreen.recoveryPhrase.bannerTitle"),
        revealedBannerBody: t(
          "revealSecretScreen.recoveryPhrase.revealedBannerBody",
        ),
        heading: t("revealSecretScreen.recoveryPhrase.heading"),
        acknowledgementKey:
          "revealSecretScreen.recoveryPhrase.acknowledgement" as const,
        action: t("revealSecretScreen.recoveryPhrase.action"),
        testID: "reveal-recovery-phrase",
        screens: [
          AnalyticsEvent.VIEW_UNLOCK_RECOVERY_PHRASE,
          AnalyticsEvent.VIEW_SHOW_RECOVERY_PHRASE,
        ],
      }
    : {
        title: t("revealSecretScreen.secretKey.title"),
        revealedTitle: t("revealSecretScreen.secretKey.revealedTitle"),
        bannerTitle: t("revealSecretScreen.secretKey.bannerTitle"),
        revealedBannerBody: t(
          "revealSecretScreen.secretKey.revealedBannerBody",
        ),
        heading: t("revealSecretScreen.secretKey.heading"),
        acknowledgementKey:
          "revealSecretScreen.secretKey.acknowledgement" as const,
        action: t("revealSecretScreen.secretKey.action"),
        testID: "reveal-secret-key",
        screens: [
          AnalyticsEvent.VIEW_UNLOCK_SECRET_KEY,
          AnalyticsEvent.VIEW_SHOW_SECRET_KEY,
        ],
      };

  useEffect(() => {
    navigation.setOptions({
      headerTitle: step === "revealed" ? copy.revealedTitle : copy.title,
    });
  }, [navigation, step, copy.revealedTitle, copy.title]);

  // The route doesn't auto-track: a reveal is only counted once the password
  // is accepted, so the screen is named from the step it's on.
  const screenName = copy.screens[step === "revealed" ? 1 : 0];
  useEffect(() => {
    track(AnalyticsEvent.SCREEN_VIEWED, buildScreenViewedProps(screenName));
  }, [screenName]);

  const reveal = async (passwordToUse: string) =>
    params.kind === "recoveryPhrase"
      ? revealRecoveryPhrase({
          password: passwordToUse,
          sourceId: params.sourceId,
        })
      : revealAccountSecretKey({
          accountId: params.accountId,
          password: passwordToUse,
        });

  // The biometric button passes the stored password; the field's is used
  // when biometrics are off.
  const handleReveal = async (...args: unknown[]) => {
    const passwordToUse = (args[0] as string | undefined) ?? password;

    if (!passwordToUse) {
      setError(t("authStore.error.invalidPassword"));
      return;
    }

    setIsLoading(true);
    setError(undefined);
    try {
      setSecret(await reveal(passwordToUse));
      setPassword("");
      setStep("revealed");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("authStore.error.invalidPassword"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!secret) return;

    copyToClipboard(secret);
    if (isPhrase) {
      analytics.trackCopyBackupPhrase();
    }
  };

  if (step === "revealed") {
    return (
      <BaseLayout insets={{ top: false }} testID={`${copy.testID}-revealed`}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >
          {/* The phrase ends with Done; the secret key has no buttons at the
              bottom and is left with the header's back arrow. */}
          <View className="flex-1 gap-6 mt-4">
            <NeverShareBanner
              title={copy.bannerTitle}
              body={copy.revealedBannerBody}
            />
            <View className="gap-4 items-center">
              {isPhrase ? (
                <View className="self-stretch">
                  <RecoveryPhraseGrid
                    words={secret.split(" ")}
                    testID="reveal-recovery-phrase-value"
                  />
                </View>
              ) : (
                <View className="self-stretch bg-background-secondary rounded-xl p-3">
                  <Text md medium testID="reveal-secret-key-value">
                    {secret}
                  </Text>
                </View>
              )}
              <Button
                minimal
                sm
                onPress={handleCopy}
                testID={`${copy.testID}-copy`}
                icon={<Icon.Copy01 size={16} />}
                iconPosition={IconPosition.RIGHT}
              >
                {t("revealSecretScreen.tapToCopy")}
              </Button>
            </View>
            {isPhrase && (
              <>
                <View className="flex-1" />
                <Button
                  secondary
                  xl
                  onPress={() => navigation.goBack()}
                  testID={`${copy.testID}-done`}
                >
                  {t("common.done")}
                </Button>
              </>
            )}
          </View>
        </ScrollView>
      </BaseLayout>
    );
  }

  if (step === "password") {
    return (
      <BaseLayout
        useKeyboardAvoidingView
        useSafeArea
        insets={{ top: false, bottom: false }}
      >
        <ScrollView
          className="flex-1"
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 gap-6 mt-4">
            <NeverShareBanner
              title={copy.bannerTitle}
              body={t("revealSecretScreen.consentBannerBody")}
            />
            {signInMethod === LoginType.PASSWORD && (
              <PasswordField
                testID={`${copy.testID}-password`}
                label={t("showRecoveryPhraseScreen.password")}
                placeholder={t(
                  "showRecoveryPhraseScreen.passwordInputPlaceholder",
                )}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setError(undefined);
                }}
                error={error}
              />
            )}
            {signInMethod !== LoginType.PASSWORD && error && (
              <Text sm color={themeColors.status.error}>
                {error}
              </Text>
            )}
            <View className="flex-1" />
            <Button
              biometric
              destructive
              xl
              onPress={handleReveal}
              isLoading={isLoading}
              disabled={signInMethod === LoginType.PASSWORD && !password}
              testID={`${copy.testID}-submit`}
            >
              {copy.action}
            </Button>
            <BiometricToggleButton size="xl" />
            <View className="mb-6" />
          </View>
        </ScrollView>
      </BaseLayout>
    );
  }

  return (
    <BaseLayout insets={{ top: false }} testID={`${copy.testID}-consent`}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 gap-6 mt-4">
          <NeverShareBanner
            title={copy.bannerTitle}
            body={t("revealSecretScreen.consentBannerBody")}
          />
          <View className="items-center gap-3 mt-6">
            <View className="w-12 h-12 rounded-xl bg-background-tertiary items-center justify-center">
              <Icon.Shield03 color={themeColors.foreground.primary} />
            </View>
            <Text lg semiBold textAlign="center">
              {copy.heading}
            </Text>
            <Text sm secondary textAlign="center">
              {t("revealSecretScreen.consentSubtitle")}
            </Text>
          </View>
          <View className="flex-1" />
          <Checkbox
            checked={hasAcknowledged}
            onChange={setHasAcknowledged}
            label={
              <Text sm secondary>
                <Trans
                  ns="translations"
                  i18nKey={copy.acknowledgementKey}
                  // Trans fills the element with the <strong> words.
                  components={{
                    strong: (
                      <Text sm semiBold primary>
                        {null}
                      </Text>
                    ),
                  }}
                />
              </Text>
            }
            testID={`${copy.testID}-acknowledge`}
          />
          <Button
            destructive
            xl
            disabled={!hasAcknowledged}
            onPress={() => setStep("password")}
            testID={`${copy.testID}-continue`}
          >
            {copy.action}
          </Button>
        </View>
      </ScrollView>
    </BaseLayout>
  );
};

export default RevealSecretScreen;
