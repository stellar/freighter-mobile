/* eslint-disable react/no-unstable-nested-components */
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BalancesList } from "components/BalancesList";
import { BaseLayout } from "components/layout/BaseLayout";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { SWAP_ROUTES, SwapStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { isContractId } from "helpers/soroban";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import useDebounce from "hooks/useDebounce";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { useEffect, useState } from "react";
import { TouchableOpacity, View } from "react-native";

type SwapScreenProps = NativeStackScreenProps<
  SwapStackParamList,
  typeof SWAP_ROUTES.SWAP_SCREEN
>;

const SwapScreen: React.FC<SwapScreenProps> = ({ navigation }) => {
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();
  const { getClipboardText } = useClipboard();
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [filteringTerm, setFilteringTerm] = useState("");

  // Debounced function to update the term used for filtering
  const debouncedUpdateFilteringTerm = useDebounce(() => {
    setFilteringTerm(searchTerm);
  }, 300);

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon.X size={24} color={themeColors.base[1]} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, themeColors]);

  const handleTokenPress = (tokenId: string) => {
    let tokenSymbol: string;

    if (tokenId === "native") {
      tokenSymbol = NATIVE_TOKEN_CODE;
    } else if (isContractId(tokenId)) {
      // For Soroban contracts, pass the contract ID as symbol initially
      // The TokenDetailsScreen will handle fetching the actual symbol
      tokenSymbol = tokenId;
    } else {
      // Classic asset format: CODE:ISSUER
      [tokenSymbol] = tokenId.split(":");
    }

    navigation.navigate(SWAP_ROUTES.SWAP_AMOUNT_SCREEN, {
      tokenId,
      tokenSymbol,
    });
  };

  const handleSearch = (text: string) => {
    setSearchTerm(text);

    debouncedUpdateFilteringTerm();
  };

  const handlePasteFromClipboard = () => {
    getClipboardText().then(handleSearch);
  };

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="flex-1">
        <View className="mb-8 mt-4">
          <Input
            fieldSize="md"
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
        <BalancesList
          publicKey={account?.publicKey ?? ""}
          network={network}
          searchTerm={filteringTerm}
          onTokenPress={handleTokenPress}
          showTitleIcon
        />
      </View>
    </BaseLayout>
  );
};

export default SwapScreen;
