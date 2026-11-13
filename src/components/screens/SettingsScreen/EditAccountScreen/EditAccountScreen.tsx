import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import BottomSheet from "components/BottomSheet";
import { List, ListItemProps } from "components/List";
import { BaseLayout } from "components/layout/BaseLayout";
import RenameAccountForm from "components/screens/HomeScreen/RenameAccountForm";
import Avatar from "components/sds/Avatar";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import { NETWORKS } from "config/constants";
import { logger } from "config/logger";
import {
  RevealSecretParams,
  SETTINGS_ROUTES,
  SettingsStackParamList,
} from "config/routes";
import { SecretSource, SecretSourceType } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { getSourceLabel } from "helpers/accountGroups";
import { getStellarExpertUrl } from "helpers/stellarExpert";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import { useInAppBrowser } from "hooks/useInAppBrowser";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { analytics } from "services/analytics";
import { getSecretSources } from "services/auth/secretSources";

type EditAccountScreenProps = NativeStackScreenProps<
  SettingsStackParamList,
  typeof SETTINGS_ROUTES.EDIT_ACCOUNT_SCREEN
>;

/**
 * One account's settings: its name, the secrets that control it, and its
 * explorer link. A phrase-derived account offers its recovery phrase and its
 * own secret key; an imported account offers only its key.
 *
 * Networks and Hide wallet are out of scope.
 */
const EditAccountScreen: React.FC<EditAccountScreenProps> = ({
  navigation,
  route,
}) => {
  const { accountId } = route.params;
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { open: openInAppBrowser } = useInAppBrowser();
  const { allAccounts, network, renameAccount, isRenamingAccount } =
    useAuthenticationStore();
  const [phraseSource, setPhraseSource] = useState<SecretSource | null>(null);
  const renameSheetRef = useRef<BottomSheetModal>(null);

  const account = allAccounts.find(({ id }) => id === accountId) ?? null;
  const sourceId = account?.sourceId;

  useEffect(() => {
    if (!account) {
      navigation.goBack();
    }
  }, [account, navigation]);

  // Only the phrase that roots this account is offered. A secret-key import
  // is its own source and has no phrase.
  useEffect(() => {
    if (!sourceId) {
      setPhraseSource(null);
      return;
    }
    getSecretSources()
      .then((sources) => {
        const source = sources[sourceId];
        setPhraseSource(
          source?.type === SecretSourceType.PHRASE ? source : null,
        );
      })
      .catch((error) => {
        logger.error(
          "EditAccountScreen",
          "Failed to read secret sources",
          error,
        );
      });
  }, [sourceId]);

  const handleRename = useCallback(
    async (accountName: string) => {
      if (!account) return;

      analytics.trackViewPublicKeyAccountRenamed();
      await renameAccount({ accountName, publicKey: account.publicKey });
      renameSheetRef.current?.dismiss();
    },
    [account, renameAccount],
  );

  if (!account) {
    return null;
  }

  const chevron = <Icon.ChevronRight color={themeColors.foreground.primary} />;
  const unlockToReveal = (
    <View className="flex-row items-center gap-2">
      <Text sm secondary>
        {t("editAccountScreen.unlockToReveal")}
      </Text>
      {chevron}
    </View>
  );

  const nameItems: ListItemProps[] = [
    {
      title: t("editAccountScreen.accountName"),
      titleColor: themeColors.text.primary,
      onPress: () => renameSheetRef.current?.present(),
      trailingContent: (
        <View className="flex-row items-center gap-2 shrink">
          <View className="shrink">
            <Text sm secondary numberOfLines={1}>
              {account.name}
            </Text>
          </View>
          {chevron}
        </View>
      ),
      testID: "edit-account-name",
    },
  ];

  const openReveal = (params: RevealSecretParams) =>
    navigation.navigate(SETTINGS_ROUTES.REVEAL_SECRET_SCREEN, params);

  const secretItems: ListItemProps[] = [];
  if (phraseSource) {
    secretItems.push({
      title: getSourceLabel(phraseSource, t),
      titleColor: themeColors.text.primary,
      onPress: () =>
        openReveal({ kind: "recoveryPhrase", sourceId: phraseSource.id }),
      trailingContent: unlockToReveal,
      testID: "edit-account-recovery-phrase",
    });
  }
  secretItems.push({
    title: t("editAccountScreen.secretKey"),
    titleColor: themeColors.text.primary,
    onPress: () => openReveal({ kind: "secretKey", accountId: account.id }),
    trailingContent: unlockToReveal,
    testID: "edit-account-secret-key",
  });

  // stellar.expert has no futurenet explorer.
  const explorerItems: ListItemProps[] =
    network === NETWORKS.FUTURENET
      ? []
      : [
          {
            title: t("editAccountScreen.viewOnExplorer"),
            titleColor: themeColors.text.primary,
            onPress: () => {
              analytics.track(
                AnalyticsEvent.VIEW_PUBLIC_KEY_CLICKED_STELLAR_EXPERT,
              );
              openInAppBrowser(
                `${getStellarExpertUrl(network)}/account/${account.publicKey}`,
              ).catch((error) =>
                logger.warn(
                  "EditAccountScreen",
                  "Error opening account on stellar.expert:",
                  error,
                ),
              );
            },
            trailingContent: (
              <Icon.LinkExternal01 color={themeColors.foreground.primary} />
            ),
            testID: "edit-account-explorer",
          },
        ];

  return (
    <BaseLayout testID="edit-account-screen" insets={{ top: false }}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="flex flex-col gap-6 mt-4">
          <View className="items-center">
            <Avatar size="xl" publicAddress={account.publicKey} />
          </View>
          <List items={nameItems} />
          <List items={secretItems} />
          {explorerItems.length > 0 && <List items={explorerItems} />}
        </View>
      </ScrollView>

      <BottomSheet
        modalRef={renameSheetRef}
        // A rename in flight can't be dismissed, like its Cancel button.
        shouldCloseOnPressBackdrop={!isRenamingAccount}
        enablePanDownToClose={!isRenamingAccount}
        customContent={
          <RenameAccountForm
            account={account}
            isRenamingAccount={isRenamingAccount}
            onCancel={() => renameSheetRef.current?.dismiss()}
            onSave={handleRename}
            isBottomSheetInput
          />
        }
      />
    </BaseLayout>
  );
};

export default EditAccountScreen;
