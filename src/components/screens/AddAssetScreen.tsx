/* eslint-disable react/no-array-index-key */
/* eslint-disable no-underscore-dangle */
/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable react/no-unstable-nested-components */
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AssetIcon } from "components/AssetIcon";
import BottomSheet from "components/BottomSheet";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button, IconPosition } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { Text } from "components/sds/Typography";
import { NETWORKS } from "config/constants";
import { logger } from "config/logger";
import {
  MANAGE_ASSETS_ROUTES,
  ManageAssetsStackParamList,
} from "config/routes";
import { PALETTE, THEME } from "config/theme";
import { PricedBalance, SearchAssetResponse } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { formatAssetIdentifier } from "helpers/balances";
import { px, pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import { useBalancesList } from "hooks/useBalancesList";
import { useClipboard } from "hooks/useClipboard";
import useDebounce from "hooks/useDebounce";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import { searchAsset } from "services/stellarExpert";
import styled from "styled-components/native";

type AddAssetScreenProps = NativeStackScreenProps<
  ManageAssetsStackParamList,
  typeof MANAGE_ASSETS_ROUTES.ADD_ASSET_SCREEN
>;

const Spacer = styled.View`
  height: ${px(16)};
`;

type FormattedSearchAssetRecord = {
  assetCode: string;
  domain: string;
  hasTrustline: boolean;
  issuer: string;
  isNative: boolean;
};

const formatSearchAssetRecords = (
  records: SearchAssetResponse["_embedded"]["records"],
  currentBalances: (PricedBalance & {
    id: string;
  })[],
): FormattedSearchAssetRecord[] =>
  records.map((record) => {
    const formattedTokenRecord = record.asset.split("-");
    const assetCode = formattedTokenRecord[0];
    const issuer = formattedTokenRecord[1] ?? "";

    const balance = currentBalances.find((currentBalance) => {
      const formattedCurrentBalance = formatAssetIdentifier(currentBalance.id);

      return (
        formattedCurrentBalance.assetCode === assetCode &&
        formattedCurrentBalance.issuer === issuer
      );
    });

    return {
      assetCode,
      domain: record.domain ?? "",
      hasTrustline: !!balance,
      issuer,
      isNative: record.asset === "XLM",
    };
  });

const AddAssetRightContent: React.FC<{ asset: FormattedSearchAssetRecord }> = ({
  asset,
}) => {
  const { t } = useAppTranslation();
  return (
    <Button
      secondary
      squared
      lg
      testID="add-asset-button"
      icon={
        <Icon.PlusCircle size={pxValue(16)} color={PALETTE.dark.gray["09"]} />
      }
      iconPosition={IconPosition.RIGHT}
      onPress={() => {
        logger.debug("AddAssetScreen", "addAssetButton Not implemented", {
          asset,
        });
      }}
    >
      {t("addAssetScreen.add")}
    </Button>
  );
};

const AddAssetScreen: React.FC<AddAssetScreenProps> = ({ navigation }) => {
  const { network } = useAuthenticationStore();
  const { t } = useAppTranslation();
  const { getClipboardText } = useClipboard();
  const [searchResults, setSearchResults] = useState<
    FormattedSearchAssetRecord[]
  >([]);
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const { account } = useGetActiveAccount();
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const { balanceItems } = useBalancesList({
    publicKey: account?.publicKey ?? "",
    network,
    shouldPoll: false,
  });

  const [search, setSearch] = useState("");

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon.X size={pxValue(24)} color={THEME.colors.base.secondary} />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity
          onPress={() => bottomSheetModalRef.current?.present()}
        >
          <Icon.HelpCircle
            size={pxValue(24)}
            color={THEME.colors.base.secondary}
          />
        </TouchableOpacity>
      ),
    });
  }, [navigation, t]);

  const handlePasteFromClipboard = () => {
    getClipboardText().then((value) => {
      setSearch(value);
    });
  };

  const debouncedSearch = useDebounce(async () => {
    if (!search) {
      setStatus("idle");
      setSearchResults([]);
      return;
    }

    setStatus("loading");

    const resJson = await searchAsset(search, NETWORKS.PUBLIC);

    if (!resJson) {
      setStatus("error");
      return;
    }

    const formattedRecords = formatSearchAssetRecords(
      resJson._embedded.records,
      balanceItems,
    );

    setSearchResults(formattedRecords);
    setStatus("success");
  }, 500);

  const handleSearch = (text: string) => {
    setSearch(text);

    debouncedSearch();
  };

  return (
    <BaseLayout insets={{ top: false }} useKeyboardAvoidingView>
      <View className="flex-1 justify-between">
        <BottomSheet
          title={t("manageAssetsScreen.moreInfo.title")}
          description={`${t("manageAssetsScreen.moreInfo.block1")}\n\n${t("manageAssetsScreen.moreInfo.block2")}`}
          modalRef={bottomSheetModalRef}
          handleCloseModal={() => bottomSheetModalRef.current?.dismiss()}
        />
        <Input
          placeholder={t("addAssetScreen.searchPlaceholder")}
          value={search}
          onChangeText={handleSearch}
          fieldSize="lg"
          leftElement={
            <Icon.SearchMd
              size={pxValue(16)}
              color={THEME.colors.foreground.primary}
            />
          }
        />
        <Spacer />
        {status === "loading" && <ActivityIndicator />}
        {status === "success" && (
          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            alwaysBounceVertical={false}
          >
            {searchResults.map((asset, index) => (
              <View
                key={index}
                className="mb-4 flex-row justify-between items-center flex-1"
              >
                <View className="flex-row items-center flex-1">
                  <AssetIcon
                    token={{
                      ...(asset.isNative
                        ? { type: "native" }
                        : {
                            type: "credit_alphanum4",
                          }),
                      code: asset.assetCode,
                      issuer: {
                        key: asset.issuer,
                      },
                    }}
                  />
                  <View className="ml-4 flex-1 mr-2">
                    <Text md primary medium numberOfLines={1}>
                      {asset.assetCode}
                    </Text>
                    <Text sm secondary medium numberOfLines={1}>
                      {asset.domain || "-"}
                    </Text>
                  </View>
                </View>
                <Text>
                  {asset.hasTrustline ? (
                    "Has trustline"
                  ) : (
                    <AddAssetRightContent asset={asset} />
                  )}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}
        {status === "error" && <Text color="red">Something went wrong</Text>}
        <Spacer />
        <Button
          secondary
          lg
          testID="paste-from-clipboard-button"
          onPress={handlePasteFromClipboard}
          icon={<Icon.Clipboard size={16} color={PALETTE.dark.gray["09"]} />}
        >
          {t("addAssetScreen.pasteFromClipboard")}
        </Button>
      </View>
    </BaseLayout>
  );
};

export default AddAssetScreen;
