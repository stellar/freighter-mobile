import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { BalancesList } from "components/BalancesList";
import BottomSheetAdaptiveContainer from "components/primitives/BottomSheetAdaptiveContainer";
import TokenContextMenu from "components/screens/SwapScreen/components/TokenContextMenu";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { Text } from "components/sds/Typography";
import {
  DEFAULT_DEBOUNCE_DELAY,
  NATIVE_TOKEN_CODE,
  NETWORKS,
} from "config/constants";
import { PricedBalance } from "config/types";
import { pxValue } from "helpers/dimensions";
import { isContractId } from "helpers/soroban";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import useDebounce from "hooks/useDebounce";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface SelectTokenBottomSheetProps {
  onTokenSelect: (tokenId: string, tokenSymbol: string) => void;
  title: string;
  onClose?: () => void;
  network: NETWORKS;
}

const SelectTokenBottomSheet: React.FC<SelectTokenBottomSheetProps> = ({
  onTokenSelect,
  title,
  onClose,
  network,
}) => {
  const { themeColors } = useColors();
  const { getClipboardText } = useClipboard();
  const { t } = useAppTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [filteringTerm, setFilteringTerm] = useState("");
  const { account } = useGetActiveAccount();
  const publicKey = account?.publicKey ?? "";
  const insets = useSafeAreaInsets();

  const debouncedUpdateFilteringTerm = useDebounce(() => {
    setFilteringTerm(searchTerm);
  }, DEFAULT_DEBOUNCE_DELAY);

  const handleSearch = (text: string) => {
    setSearchTerm(text);
    debouncedUpdateFilteringTerm();
  };

  const renderTokenContextMenu = (balance: PricedBalance) => (
    <TokenContextMenu balance={balance} network={network} />
  );
  const handlePasteFromClipboard = () => {
    getClipboardText().then(handleSearch);
  };

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

    onTokenSelect(tokenId, tokenSymbol);
  };

  return (
    <View className="flex-1 justify-between items-center w-full">
      <BottomSheetAdaptiveContainer
        bottomPaddingPx={insets.bottom + pxValue(32)}
        header={
          <View>
            <View className="relative flex-row items-center justify-center mb-8">
              {onClose && (
                <TouchableOpacity onPress={onClose} className="absolute left-0">
                  <Icon.X color={themeColors.base[1]} />
                </TouchableOpacity>
              )}
              <Text md medium semiBold>
                {title}
              </Text>
            </View>
            <View className="mb-6 mt-4">
              <Input
                fieldSize="lg"
                leftElement={
                  <Icon.SearchMd
                    size={16}
                    color={themeColors.foreground.primary}
                  />
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
            <View className="flex-row items-center">
              <Text medium secondary>
                {t("swapScreen.swapScreenTokenListTitle")}
              </Text>
            </View>
          </View>
        }
      >
        <BottomSheetScrollView
          showsVerticalScrollIndicator={false}
          alwaysBounceVertical={false}
        >
          <View style={{ paddingBottom: insets.bottom + pxValue(32) }}>
            <BalancesList
              publicKey={publicKey}
              network={network}
              onTokenPress={handleTokenPress}
              searchTerm={filteringTerm}
              disableNavigation
              renderRightContent={renderTokenContextMenu}
            />
          </View>
        </BottomSheetScrollView>
      </BottomSheetAdaptiveContainer>
    </View>
  );
};

export default SelectTokenBottomSheet;
