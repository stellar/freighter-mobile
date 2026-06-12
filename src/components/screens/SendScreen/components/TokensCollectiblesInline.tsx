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

  // Single spinner: keep it up until both sources finish their initial load.
  // Gating on the "no data yet" condition (rather than raw isLoading) avoids
  // the spinner flashing over already-rendered content on background refreshes.
  const showSpinner =
    (tokensLoading && noBalances) ||
    (collectiblesLoading && !hasCollectibles);

  // Single error field: a token error takes precedence over a collectibles
  // error, and any error replaces the whole view rather than rendering the
  // section that succeeded.
  //
  // The collectibles store keeps the previous error set while a retry is in
  // flight (it only flips isLoading), so we gate on !collectiblesLoading to
  // avoid surfacing a stale error during a retry. useBalancesList already
  // suppresses tokensError while loading, so tokens need no such guard.
  let errorMessage: string | null = null;
  if (tokensError) {
    errorMessage = t("balancesList.error");
  } else if (collectiblesError && !collectiblesLoading) {
    errorMessage = t("collectiblesGrid.error");
  }

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
    // An error from either source replaces the whole view, and takes
    // precedence over the spinner: if one source fails while the other is
    // still loading, we surface the error immediately rather than masking it
    // behind a spinner that could otherwise hang indefinitely.
    if (errorMessage) {
      return (
        <View className="py-2">
          <Text md secondary testID="tokens-collectibles-inline-error">
            {errorMessage}
          </Text>
        </View>
      );
    }

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
        {hasTokens && (
          <>
            <View className="flex-row items-center gap-2 mb-6">
              <Icon.Coins03 size={16} color={themeColors.text.secondary} />
              <Text md medium secondary>
                {t("balancesList.title")}
              </Text>
            </View>

            <BalancesList
              publicKey={publicKey}
              network={network}
              onTokenPress={onTokenPress}
              disableInnerScrolling
              showSpendableAmount={showSpendableAmount}
              feeContext={feeContext}
              balanceRowTestIDPrefix={balanceRowTestIDPrefix}
            />
          </>
        )}

        {hasCollectibles && (
          <>
            <View
              className={`flex-row items-center gap-2 mb-6 ${
                hasTokens ? "mt-8" : ""
              }`}
            >
              <Icon.Image01 size={16} color={themeColors.text.secondary} />
              <Text md medium secondary>
                {t("collectiblesGrid.title")}
              </Text>
            </View>

            {renderCollectibles()}
          </>
        )}

        {!hasTokens && !hasCollectibles && (
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
