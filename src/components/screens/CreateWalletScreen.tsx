import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import AccountNameForm from "components/AccountNameForm";
import AddWalletOption, {
  ADD_WALLET_OPTION_ICON_SIZE,
  AddWalletOptionIcon,
} from "components/AddWalletOption";
import BottomSheet from "components/BottomSheet";
import ScreenTitle from "components/ScreenTitle";
import { BaseLayout } from "components/layout/BaseLayout";
import AccountItemRow from "components/screens/HomeScreen/AccountItemRow";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { DEFAULT_PADDING, DEFAULT_PRESS_DELAY } from "config/constants";
import { logger } from "config/logger";
import {
  MANAGE_WALLETS_ROUTES,
  ManageWalletsStackParamList,
} from "config/routes";
import { SecretSource } from "config/types";
import { useAccountsFiatTotalsStore } from "ducks/accountsFiatTotals";
import {
  generatePendingRecoveryPhrase,
  useAuthenticationStore,
} from "ducks/auth";
import { AccountGroupKind, groupAccountsBySource } from "helpers/accountGroups";
import { getNextDefaultAccountName } from "helpers/accountName";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getSecretSources } from "services/auth/secretSources";

type CreateWalletScreenProps = NativeStackScreenProps<
  ManageWalletsStackParamList,
  typeof MANAGE_WALLETS_ROUTES.CREATE_WALLET_SCREEN
>;

/** Where the named account goes: an existing phrase, or a new one. */
type NamingTarget =
  | { kind: "existingPhrase"; sourceId: string }
  | { kind: "newPhrase" };

/**
 * Create new wallet: add an account under one of the wallet's recovery
 * phrases, or start a new phrase with its first account. Each phrase lists
 * its accounts with an Add account row, and New recovery phrase sits last.
 * A wallet with no phrase (one started from a secret key) lists only that.
 *
 * Either way the name is set first, in a sheet. An existing phrase then goes
 * to the password step; a new phrase goes to its backup screen first.
 *
 * Design: ?node-id=2554-164768, the name sheet ?node-id=2554-164937.
 */
const CreateWalletScreen: React.FC<CreateWalletScreenProps> = ({
  navigation,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const insets = useSafeAreaInsets();
  const { allAccounts, getAllAccounts, network } = useAuthenticationStore();
  const { account: activeAccount } = useGetActiveAccount();
  const fiatTotals = useAccountsFiatTotalsStore((state) => state.fiatTotals);
  const isLoadingFiatTotals = useAccountsFiatTotalsStore(
    (state) => state.isLoading,
  );
  const fetchAccountsFiatTotals = useAccountsFiatTotalsStore(
    (state) => state.fetchAccountsFiatTotals,
  );
  const nameSheetRef = useRef<BottomSheetModal>(null);
  const [target, setTarget] = useState<NamingTarget | null>(null);
  // Null until the first read, so the phrases aren't drawn and then
  // regrouped once the sources arrive.
  const [sources, setSources] = useState<SecretSource[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      getAllAccounts();
      getSecretSources()
        .then((map) => setSources(Object.values(map)))
        .catch((error) => {
          logger.error(
            "CreateWalletScreen",
            "Failed to read secret sources",
            error,
          );
          // No phrases to list; New recovery phrase still works.
          setSources((current) => current ?? []);
        });
    }, [getAllAccounts]),
  );

  useFocusEffect(
    useCallback(() => {
      if (allAccounts.length === 0) {
        return;
      }
      // TTL-gated, so returning to the screen doesn't refetch every time.
      fetchAccountsFiatTotals({
        publicKeys: allAccounts.map(({ publicKey }) => publicKey),
        network,
        excludePublicKey: activeAccount?.publicKey,
      });
    }, [
      allAccounts,
      network,
      activeAccount?.publicKey,
      fetchAccountsFiatTotals,
    ]),
  );

  const phraseGroups = useMemo(
    () =>
      sources
        ? groupAccountsBySource({ accounts: allAccounts, sources, t }).filter(
            ({ kind }) => kind === AccountGroupKind.PHRASE,
          )
        : [],
    [allAccounts, sources, t],
  );

  const defaultAccountName = useMemo(
    () =>
      getNextDefaultAccountName(
        allAccounts.map(({ name }) => name),
        (number) => t("authStore.account", { number }),
      ),
    [allAccounts, t],
  );

  const startNaming = (next: NamingTarget) => {
    setTarget(next);
    nameSheetRef.current?.present();
  };

  const handleNamed = (accountName: string) => {
    nameSheetRef.current?.dismiss();

    if (target?.kind === "newPhrase") {
      // Held in the auth store until the password step stores it; the
      // backup screen reads it from there by its id, never from params.
      const pendingPhraseId = generatePendingRecoveryPhrase();
      navigation.navigate(MANAGE_WALLETS_ROUTES.BACKUP_RECOVERY_PHRASE_SCREEN, {
        pendingPhraseId,
        accountName,
      });
      return;
    }

    if (target?.kind === "existingPhrase") {
      navigation.navigate(MANAGE_WALLETS_ROUTES.VERIFY_PASSWORD_SCREEN, {
        kind: "existingPhrase",
        sourceId: target.sourceId,
        accountName,
      });
    }
  };

  return (
    <BaseLayout insets={{ top: false, bottom: false }}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View
          className="mt-2"
          style={{ marginBottom: insets.bottom + pxValue(DEFAULT_PADDING) }}
        >
          <ScreenTitle
            title={t("createWalletScreen.title")}
            subtitle={t("createWalletScreen.subtitle")}
          />
          {sources && (
            <View className="gap-4" testID="create-wallet">
              {phraseGroups.map((group) => (
                <View
                  key={group.key}
                  className="bg-background-tertiary rounded-[16px] p-4 gap-4"
                  testID="create-wallet-group"
                >
                  <Text sm secondary>
                    {group.label}
                  </Text>
                  {group.accounts.map((account) => (
                    <AccountItemRow
                      key={account.id}
                      account={account}
                      isSelected={account.id === activeAccount?.id}
                      isAccountSwitching={false}
                      isSwitchingToThisAccount={false}
                      fiatTotal={fiatTotals[account.publicKey]}
                      isLoadingFiatTotal={isLoadingFiatTotals}
                    />
                  ))}
                  <TouchableOpacity
                    className="flex-row items-center gap-3"
                    onPress={() =>
                      startNaming({
                        kind: "existingPhrase",
                        sourceId: group.sourceId!,
                      })
                    }
                    delayPressIn={DEFAULT_PRESS_DELAY}
                    accessibilityRole="button"
                    accessibilityLabel={t("createWalletScreen.addAccountTo", {
                      label: group.label,
                    })}
                    testID="create-wallet-add-account"
                  >
                    <AddWalletOptionIcon>
                      <Icon.Plus
                        size={ADD_WALLET_OPTION_ICON_SIZE}
                        color={themeColors.foreground.secondary}
                      />
                    </AddWalletOptionIcon>
                    <Text md medium primary>
                      {t("createWalletScreen.addAccount")}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
              <AddWalletOption
                icon={
                  <Icon.Plus
                    size={ADD_WALLET_OPTION_ICON_SIZE}
                    color={themeColors.foreground.secondary}
                  />
                }
                title={t("createWalletScreen.newRecoveryPhrase")}
                description={t(
                  "createWalletScreen.newRecoveryPhraseDescription",
                )}
                onPress={() => startNaming({ kind: "newPhrase" })}
                testID="create-wallet-generate"
              />
            </View>
          )}
        </View>
      </ScrollView>

      <BottomSheet
        modalRef={nameSheetRef}
        customContent={
          <AccountNameForm
            title={t("createWalletScreen.setAccountName")}
            initialName={defaultAccountName}
            submitLabel={
              target?.kind === "newPhrase"
                ? t("createWalletScreen.next")
                : t("createWalletScreen.create")
            }
            onSubmit={handleNamed}
            onClose={() => nameSheetRef.current?.dismiss()}
            isBottomSheetInput
            testID="set-account-name"
          />
        }
      />
    </BaseLayout>
  );
};

export default CreateWalletScreen;
