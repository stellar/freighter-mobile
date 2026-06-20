import { BalancesList } from "components/BalancesList";
import { CollectibleImage } from "components/CollectibleImage";
import Spinner from "components/Spinner";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import {
  DEFAULT_PADDING,
  NETWORKS,
  TransactionContext,
} from "config/constants";
import { useCollectiblesStore } from "ducks/collectibles";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import { useBalancesList } from "hooks/useBalancesList";
import useColors from "hooks/useColors";
import { useFilteredCollectibles } from "hooks/useFilteredCollectibles";
import React from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";

interface TokensCollectiblesInlineProps {
  publicKey: string;
  network: NETWORKS;
  onTokenPress?: (tokenId: string) => void;
  onCollectiblePress?: ({
    collectionAddress,
    tokenId,
  }: {
    collectionAddress: string;
    tokenId: string;
  }) => void;
  showSpendableAmount?: boolean;
  feeContext?: TransactionContext;
  balanceRowTestIDPrefix?: string;
}

export const TokensCollectiblesInline: React.FC<
  TokensCollectiblesInlineProps
> = ({
  publicKey,
  network,
  onTokenPress,
  onCollectiblePress,
  showSpendableAmount = false,
  feeContext = TransactionContext.Send,
  balanceRowTestIDPrefix,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  // Tokens state, lifted from the same hook BalancesList uses internally so we
  // can drive a single page-level spinner/error.
  const { isLoading: tokensLoading, error: tokensError, noBalances } =
    useBalancesList({ publicKey, network });

  // Collectibles state.
  const collectiblesLoading = useCollectiblesStore((state) => state.isLoading);
  const collectiblesError = useCollectiblesStore((state) => state.error);
  const { visibleCollectibles } = useFilteredCollectibles();

  const hasTokens = !noBalances;
  const hasCollectibles = visibleCollectibles.length > 0;

  // Single spinner: keep it up until both sources have data for the first time.
  //
  // Both sources gate on "no data yet" — tokens on noBalances (matching
  // BalancesList's own spinner condition) and collectibles on !hasCollectibles.
  // This waits for BOTH sources before any content renders, but once a section
  // has data a later background refetch (which flips isLoading without clearing
  // the existing data) no longer blanks the whole page back to a spinner.
  //
  // The collectibles store keeping stale data/error mid-refetch (it only flips
  // isLoading) is not a concern here: the network and active account cannot
  // change while the send flow is mounted, so the data on screen always belongs
  // to the current account/network.
  //
  // Because the spinner covers the initial load of both sources, a per-section
  // error only surfaces once loading has settled, so the collectibles store's
  // stale-error-during-retry is masked and the per-section error checks below
  // need no extra !collectiblesLoading guard.
  const showSpinner =
    (tokensLoading && noBalances) || (collectiblesLoading && !hasCollectibles);

  // Each source renders its own section independently: a failed source shows
  // its (curated) error beneath its section header, while the other source
  // still renders its content. A section is "shown" when it either has data or
  // has errored.
  const tokensSectionShown = Boolean(tokensError) || hasTokens;
  const collectiblesSectionShown = Boolean(collectiblesError) || hasCollectibles;

  // The combined empty fallback only applies when both sources succeeded with
  // no data; an error in either section takes its place instead.
  const showEmpty = !tokensSectionShown && !collectiblesSectionShown;

  const renderSectionHeader = (
    icon: React.ReactNode,
    title: string,
    withTopMargin = false,
  ) => (
    <View
      className={`flex-row items-center gap-2 mb-6 ${
        withTopMargin ? "mt-8" : ""
      }`}
    >
      {icon}
      <Text md medium secondary>
        {title}
      </Text>
    </View>
  );

  const renderInlineError = (testID: string, message: string) => (
    <View className="py-2">
      <Text md secondary testID={testID}>
        {message}
      </Text>
    </View>
  );

  const renderCollectibles = () =>
    visibleCollectibles.map((collection) => (
      <View key={collection.collectionAddress}>
        <View className="flex-row items-center gap-[12px] mb-3 mt-3">
          <Text md secondary numberOfLines={1}>
            {collection.collectionName}
          </Text>
          <View className="flex-1 h-[1px] bg-gray-3" />
          <Text md secondary>
            {collection.items.length}
          </Text>
        </View>

        {collection.items.map((item) => (
          <TouchableOpacity
            key={`${item.collectionAddress}-${item.tokenId}`}
            className="flex-row items-center gap-4 py-3"
            onPress={() =>
              onCollectiblePress?.({
                collectionAddress: item.collectionAddress,
                tokenId: item.tokenId,
              })
            }
          >
            <View className="w-[40px] h-[40px] rounded-[8px] overflow-hidden bg-background-tertiary">
              <CollectibleImage imageUri={item.image} placeholderIconSize={20} />
            </View>

            <Text md medium numberOfLines={1} style={{ flexShrink: 1 }}>
              {item.name || `${collection.collectionName} #${item.tokenId}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    ));

  const renderContent = () => {
    // Wait for both sources before rendering any content, so neither a
    // section's data nor its error appears until loading has fully settled.
    if (showSpinner) {
      return (
        <View className="items-center justify-center py-6">
          <Spinner
            testID="tokens-collectibles-inline-spinner"
            size="large"
            color={themeColors.secondary}
          />
        </View>
      );
    }

    return (
      <>
        {tokensSectionShown && (
          <>
            {renderSectionHeader(
              <Icon.Coins03 size={16} color={themeColors.text.secondary} />,
              t("balancesList.title"),
            )}

            {tokensError ? (
              renderInlineError("tokens-inline-error", t("balancesList.error"))
            ) : (
              <BalancesList
                publicKey={publicKey}
                network={network}
                onTokenPress={onTokenPress}
                disableInnerScrolling
                showSpendableAmount={showSpendableAmount}
                feeContext={feeContext}
                balanceRowTestIDPrefix={balanceRowTestIDPrefix}
              />
            )}
          </>
        )}

        {collectiblesSectionShown && (
          <>
            {renderSectionHeader(
              <Icon.Image01 size={16} color={themeColors.text.secondary} />,
              t("collectiblesGrid.title"),
              tokensSectionShown,
            )}

            {collectiblesError
              ? renderInlineError(
                  "collectibles-inline-error",
                  t("collectiblesGrid.error"),
                )
              : renderCollectibles()}
          </>
        )}

        {showEmpty && (
          <View className="flex-row items-center gap-2 py-2">
            <Icon.Grid01 size={16} color={themeColors.text.secondary} />
            <Text md medium secondary>
              {t("transactionTokenScreen.empty")}
            </Text>
          </View>
        )}
      </>
    );
  };

  return (
    <ScrollView
      className="flex-1"
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingHorizontal: pxValue(DEFAULT_PADDING) }}
    >
      {renderContent()}

      <View className="pb-4" />
    </ScrollView>
  );
};
