/* eslint-disable react/no-unstable-nested-components */
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BaseLayout } from "components/layout/BaseLayout";
import { RecentTransactionsList } from "components/screens/SendPaymentScreen/RecentTransactionsList";
import { SearchSuggestionsList } from "components/screens/SendPaymentScreen/SearchSuggestionsList";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { SEND_PAYMENT_ROUTES, SendPaymentStackParamList } from "config/routes";
import { THEME } from "config/theme";
import useAppTranslation from "hooks/useAppTranslation";
import React, { useEffect, useState } from "react";
import { TouchableOpacity, View } from "react-native";

type SendPaymentScreenProps = NativeStackScreenProps<
  SendPaymentStackParamList,
  typeof SEND_PAYMENT_ROUTES.SEND_PAYMENT_SCREEN
>;

const SendPaymentScreen: React.FC<SendPaymentScreenProps> = ({
  navigation,
}) => {
  const { t } = useAppTranslation();
  const [address, setAddress] = useState("");
  const [recentTransactions] = useState([
    // This is just mock data for now, will be replaced with actual data later
    {
      id: "1",
      address: "GA7M...63FC",
    },
    {
      id: "2",
      address: "CB2GPQAQJAJIGBXVQBMZ4GXMV7QSTA4LQASUAJXCD4ZYUKH2C25HKFQR",
    },
  ]);

  // Mock search suggestions data
  const [searchSuggestions, setSearchSuggestions] = useState<
    Array<{ id: string; address: string }>
  >([]);

  // Mock search function - will be replaced with actual API call later
  const handleSearch = (text: string) => {
    setAddress(text);
    if (text.length > 0) {
      // Mock search results
      setSearchSuggestions([
        {
          id: "4",
          address: "CB2GPQAQJAJIGBXVQBMZ4GXMV7QSTA4LQASUAJXCD4ZYUKH2C25HKFQR",
        },
      ]);
    } else {
      setSearchSuggestions([]);
    }
  };

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon.X size={24} color={THEME.colors.base.secondary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, t]);

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="flex-1">
        <View className="mb-8">
          <Input
            fieldSize="lg"
            leftElement={
              <Icon.UserCircle
                size={16}
                color={THEME.colors.foreground.primary}
              />
            }
            placeholder={t("sendPaymentScreen.inputPlaceholder")}
            onChangeText={handleSearch}
            endButton={{
              content: "Paste",
              onPress: () => {
                console.log("End button pressed");
              },
              disabled: false,
            }}
            value={address}
          />
        </View>

        {searchSuggestions.length > 0 ? (
          <SearchSuggestionsList suggestions={searchSuggestions} />
        ) : (
          recentTransactions.length > 0 && (
            <RecentTransactionsList transactions={recentTransactions} />
          )
        )}
      </View>
    </BaseLayout>
  );
};

export default SendPaymentScreen;
