import { BalancesList } from "components/BalancesList";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { Text } from "components/sds/Typography";
import {
  DEFAULT_DEBOUNCE_DELAY,
  NATIVE_TOKEN_CODE,
  TransactionContext,
} from "config/constants";
import { PricedBalance } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { isContractId } from "helpers/soroban";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import useDebounce from "hooks/useDebounce";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { ReactNode, useState } from "react";
import { View } from "react-native";

interface TokenSelectionContentProps {
  onTokenPress: (tokenId: string, tokenSymbol: string) => void;
  renderRightContent?: (balance: PricedBalance) => ReactNode;
  excludeTokenIds?: string[];
  showSpendableAmount?: boolean;
  feeContext?: TransactionContext;
}

const TokenSelectionContent: React.FC<TokenSelectionContentProps> = ({
  onTokenPress,
  renderRightContent,
  excludeTokenIds = [],
  showSpendableAmount = false,
  feeContext = TransactionContext.Swap,
}) => {
  const { account } = useGetActiveAccount();
  const publicKey = account?.publicKey ?? "";
  const { network } = useAuthenticationStore();
  const { getClipboardText } = useClipboard();
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [filteringTerm, setFilteringTerm] = useState("");

  const debouncedUpdateFilteringTerm = useDebounce(() => {
    setFilteringTerm(searchTerm);
  }, DEFAULT_DEBOUNCE_DELAY);

  const handleTokenPress = (tokenId: string) => {
    let tokenSymbol: string;

    if (tokenId === "native") {
      tokenSymbol = NATIVE_TOKEN_CODE;
    } else if (isContractId(tokenId)) {
      // For Soroban contracts, pass the contract ID as symbol initially
      // The TokenDetailsScreen will handle fetching the actual symbol
      tokenSymbol = tokenId;
    } else {
      // Classic token format: CODE:ISSUER
      [tokenSymbol] = tokenId.split(":");
    }

    onTokenPress(tokenId, tokenSymbol);
  };

  const handleSearch = (text: string) => {
    setSearchTerm(text);
    debouncedUpdateFilteringTerm();
  };

  const handlePasteFromClipboard = () => {
    getClipboardText().then(handleSearch);
  };

  return (
    <View className="flex-1">
      <View className="mb-8 mt-4">
        <Input
          fieldSize="lg"
          leftElement={
            <Icon.SearchMd size={16} color={themeColors.foreground.primary} />
          }
          testID="search-input"
          placeholder={t("swapScreen.searchTokenInputPlaceholder")}
          onChangeText={handleSearch}
          endButton={{
            content: t("common.paste"),
            onPress: handlePasteFromClipboard,
          }}
          value={searchTerm}
        />
      </View>

      <View className="flex-row items-center mb-6">
        <Text medium secondary>
          {t("swapScreen.swapScreenTokenListTitle")}
        </Text>
      </View>
      <BalancesList
        publicKey={publicKey}
        network={network}
        onTokenPress={handleTokenPress}
        searchTerm={filteringTerm}
        disableNavigation
        renderRightContent={renderRightContent}
        excludeTokenIds={excludeTokenIds}
        showSpendableAmount={showSpendableAmount}
        feeContext={feeContext}
      />
    </View>
  );
};

export default TokenSelectionContent;
