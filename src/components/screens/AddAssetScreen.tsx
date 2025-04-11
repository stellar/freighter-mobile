/* eslint-disable react/no-array-index-key */
/* eslint-disable no-underscore-dangle */
/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable react/no-unstable-nested-components */
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AssetIcon } from "components/AssetIcon";
import BottomSheet from "components/BottomSheet";
import Spinner from "components/Spinner";
import { BaseLayout } from "components/layout/BaseLayout";
import Avatar from "components/sds/Avatar";
import { Badge } from "components/sds/Badge";
import { Button, IconPosition } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { Text } from "components/sds/Typography";
import { getColor } from "config/colors";
import {
  MANAGE_ASSETS_ROUTES,
  ManageAssetsStackParamList,
} from "config/routes";
import { PALETTE, THEME } from "config/theme";
import { PricedBalance, SearchAssetResponse } from "config/types";
import { ActiveAccount, useAuthenticationStore } from "ducks/auth";
import { formatAssetIdentifier } from "helpers/balances";
import { px, pxValue } from "helpers/dimensions";
import { getNativeContractDetails, isContractId } from "helpers/soroban";
import useAppTranslation from "hooks/useAppTranslation";
import { useBalancesList } from "hooks/useBalancesList";
import { useClipboard } from "hooks/useClipboard";
import useDebounce from "hooks/useDebounce";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { useEffect, useRef, useState } from "react";
import {
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { getTokenDetails, isSacContractExecutable } from "services/indexer";
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

enum PageStatus {
  IDLE = "idle",
  LOADING = "loading",
  SUCCESS = "success",
  ERROR = "error",
}

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

const AddAssetRightContent: React.FC<{
  hasTrustline: boolean;
  onPress: () => void;
}> = ({ hasTrustline, onPress }) => {
  const { t } = useAppTranslation();
  return (
    <Button
      secondary
      squared
      lg
      disabled={hasTrustline}
      testID="add-asset-button"
      icon={
        <Icon.PlusCircle size={pxValue(16)} color={PALETTE.dark.gray["09"]} />
      }
      iconPosition={IconPosition.RIGHT}
      onPress={onPress}
    >
      {t("addAssetScreen.add")}
    </Button>
  );
};

const AssetItem: React.FC<{
  asset: FormattedSearchAssetRecord;
  onPress: () => void;
}> = ({ asset, onPress }) => (
  <View className="mb-4 flex-row justify-between items-center flex-1">
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
    <AddAssetRightContent hasTrustline={asset.hasTrustline} onPress={onPress} />
  </View>
);

const EmptyState: React.FC = () => {
  const { t } = useAppTranslation();

  return (
    <View className="flex-1 justify-center items-center">
      <Text sm secondary>
        {t("addAssetScreen.emptyState")}
      </Text>
    </View>
  );
};

const ErrorState: React.FC = () => {
  const { t } = useAppTranslation();

  return (
    <View className="flex-1 items-center">
      <Text sm secondary>
        {t("addAssetScreen.somethingWentWrong")}
      </Text>
    </View>
  );
};

const AddAssetBottomSheetContent = ({
  asset,
  account,
  onCancel,
  onAddAsset,
}: {
  asset: FormattedSearchAssetRecord | null;
  account: ActiveAccount | null;
  onCancel: () => void;
  onAddAsset: () => void;
}) => {
  const colorScheme = useColorScheme();
  const { t } = useAppTranslation();

  if (!asset) {
    return null;
  }

  return (
    <View className="flex-1 justify-center items-center mt-2">
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
      <View className="mt-4" />
      <Text lg primary medium>
        {asset.assetCode}
      </Text>
      <View className="mt-1" />
      {asset.domain && (
        <Text sm secondary>
          {asset.domain}
        </Text>
      )}
      <View className="mt-2" />
      <Badge
        variant="secondary"
        size="md"
        icon={<Icon.ShieldPlus size={pxValue(16)} />}
        iconPosition={IconPosition.LEFT}
      >
        {t("addAssetScreen.addAssetTrustline")}
      </Badge>
      <View className="mt-6" />
      <View className="flex-row items-center p-6 bg-background-tertiary rounded-xl justify-center">
        <Text md secondary style={{ textAlign: "center" }}>
          {t("addAssetScreen.disclaimer")}
        </Text>
      </View>
      <View className="mt-6" />
      <View className="w-full flex-row items-center px-6 py-4 bg-background-primary border border-border-primary rounded-xl justify-between">
        <View className="flex-row items-center">
          <Icon.UserCircle
            size={pxValue(16)}
            color={getColor(colorScheme ?? "dark", "gray", 9)}
          />
          <Text
            md
            secondary
            style={{ textAlign: "center", marginLeft: pxValue(8) }}
          >
            {t("wallet")}
          </Text>
        </View>
        <View className="flex-row items-center">
          <Text
            md
            secondary
            style={{ textAlign: "center", marginRight: pxValue(8) }}
          >
            {account?.accountName}
          </Text>
          <Avatar
            size="sm"
            hasBorder={false}
            publicAddress={account?.publicKey ?? ""}
          />
        </View>
      </View>
      <View className="mt-6" />
      <View className="flex-row justify-between w-full gap-3">
        <View className="flex-1">
          <Button secondary lg isFullWidth onPress={onCancel}>
            {t("addAssetScreen.cancel")}
          </Button>
        </View>
        <View className="flex-1">
          <Button tertiary lg isFullWidth onPress={onAddAsset}>
            {t("addAssetScreen.addAsset")}
          </Button>
        </View>
      </View>
      <View className="mt-6" />
    </View>
  );
};

const AddAssetScreen: React.FC<AddAssetScreenProps> = ({ navigation }) => {
  const { network } = useAuthenticationStore();
  const { account } = useGetActiveAccount();
  const { t } = useAppTranslation();
  const { getClipboardText } = useClipboard();
  const [searchResults, setSearchResults] = useState<
    FormattedSearchAssetRecord[]
  >([]);
  const [status, setStatus] = useState<PageStatus>(PageStatus.IDLE);
  const [selectedAsset, setSelectedAsset] =
    useState<FormattedSearchAssetRecord | null>(null);
  const moreInfoBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const addAssetBottomSheetModalRef = useRef<BottomSheetModal>(null);
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
          onPress={() => moreInfoBottomSheetModalRef.current?.present()}
        >
          <Icon.HelpCircle
            size={pxValue(24)}
            color={THEME.colors.base.secondary}
          />
        </TouchableOpacity>
      ),
    });
  }, [navigation, t]);

  const handleContractLookup = async (contractId: string) => {
    const nativeContractDetails = getNativeContractDetails(network);

    if (nativeContractDetails.contract === contractId) {
      return {
        assetCode: nativeContractDetails.code,
        domain: nativeContractDetails.domain,
        hasTrustline: true,
        issuer: nativeContractDetails.issuer,
        isNative: true,
      };
    }

    const tokenDetails = await getTokenDetails({
      contractId,
      publicKey: account?.publicKey ?? "",
      network,
    });

    if (!tokenDetails) {
      return null;
    }

    const isSacContract = await isSacContractExecutable(contractId, network);

    return {
      assetCode: tokenDetails.symbol,
      domain: "Stellar Network",
      hasTrustline: false,
      issuer: isSacContract
        ? (tokenDetails.name.split(":")[1] ?? "")
        : contractId,
      isNative: false,
    };
  };

  const debouncedSearch = useDebounce(async () => {
    if (!search) {
      setStatus(PageStatus.IDLE);
      setSearchResults([]);
      return;
    }

    setStatus(PageStatus.LOADING);

    if (isContractId(search)) {
      const lookupResult = await handleContractLookup(search).catch(() => {
        setStatus(PageStatus.ERROR);
        return null;
      });

      setSearchResults(lookupResult ? [lookupResult] : []);
      setStatus(PageStatus.SUCCESS);
      return;
    }

    const resJson = await searchAsset(search, network);

    if (!resJson) {
      setStatus(PageStatus.ERROR);
      return;
    }

    const formattedRecords = formatSearchAssetRecords(
      resJson._embedded.records,
      balanceItems,
    );

    setSearchResults(formattedRecords);
    setStatus(PageStatus.SUCCESS);
  }, 500);

  const handlePasteFromClipboard = () => {
    getClipboardText().then((value) => {
      setSearch(value);

      debouncedSearch();
    });
  };

  const handleSearch = (text: string) => {
    setSearch(text);

    debouncedSearch();
  };

  const handleAddAsset = (asset: FormattedSearchAssetRecord) => {
    setSelectedAsset(asset);

    addAssetBottomSheetModalRef.current?.present();
  };

  const handleAddAssetTrustline = () => {
    addAssetBottomSheetModalRef.current?.dismiss();
  };

  return (
    <BaseLayout insets={{ top: false }} useKeyboardAvoidingView>
      <View className="flex-1 justify-between">
        <BottomSheet
          title={t("manageAssetsScreen.moreInfo.title")}
          description={`${t("manageAssetsScreen.moreInfo.block1")}\n\n${t("manageAssetsScreen.moreInfo.block2")}`}
          modalRef={moreInfoBottomSheetModalRef}
          handleCloseModal={() =>
            moreInfoBottomSheetModalRef.current?.dismiss()
          }
        />
        <BottomSheet
          modalRef={addAssetBottomSheetModalRef}
          handleCloseModal={() =>
            addAssetBottomSheetModalRef.current?.dismiss()
          }
          bottomSheetModalProps={{
            enablePanDownToClose: false,
          }}
          shouldCloseOnPressBackdrop
          customContent={
            <AddAssetBottomSheetContent
              asset={selectedAsset}
              account={account}
              onCancel={() => addAssetBottomSheetModalRef.current?.dismiss()}
              onAddAsset={handleAddAssetTrustline}
            />
          }
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
        {status === PageStatus.LOADING && <Spinner />}
        {status === PageStatus.SUCCESS && (
          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            alwaysBounceVertical={false}
          >
            {searchResults.length > 0 ? (
              searchResults.map((asset, index) => (
                <AssetItem
                  key={index}
                  asset={asset}
                  onPress={() => handleAddAsset(asset)}
                />
              ))
            ) : (
              <EmptyState />
            )}
          </ScrollView>
        )}
        {status === PageStatus.ERROR && <ErrorState />}
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
