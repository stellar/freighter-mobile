/* eslint-disable react/no-array-index-key */
/* eslint-disable no-underscore-dangle */
/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable react/no-unstable-nested-components */
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import BottomSheet from "components/BottomSheet";
import Spinner from "components/Spinner";
import { BaseLayout } from "components/layout/BaseLayout";
import AddAssetBottomSheetContent from "components/screens/AddAssetScreen/AddAssetBottomSheetContent";
import AssetItem from "components/screens/AddAssetScreen/AssetItem";
import EmptyState from "components/screens/AddAssetScreen/EmptyState";
import ErrorState from "components/screens/AddAssetScreen/ErrorState";
import { FormattedSearchAssetRecord } from "components/screens/AddAssetScreen/types";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import {
  MANAGE_ASSETS_ROUTES,
  ManageAssetsStackParamList,
} from "config/routes";
import { PricedBalance, SearchAssetResponse } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { formatAssetIdentifier } from "helpers/balances";
import { isContractId } from "helpers/soroban";
import useAppTranslation from "hooks/useAppTranslation";
import { useBalancesList } from "hooks/useBalancesList";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import useDebounce from "hooks/useDebounce";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useManageAssets } from "hooks/useManageAssets";
import React, { useEffect, useRef, useState } from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";
import { handleContractLookup } from "services/backend";
import { searchAsset } from "services/stellarExpert";

type AddAssetScreenProps = NativeStackScreenProps<
  ManageAssetsStackParamList,
  typeof MANAGE_ASSETS_ROUTES.ADD_ASSET_SCREEN
>;

enum PageStatus {
  IDLE = "idle",
  LOADING = "loading",
  SUCCESS = "success",
  ERROR = "error",
}

const checkIfUserHasTrustline = (
  currentBalances: (PricedBalance & {
    id: string;
  })[],
  assetCode: string,
  issuer: string,
) => {
  const balance = currentBalances.find((currentBalance) => {
    const formattedCurrentBalance = formatAssetIdentifier(currentBalance.id);

    return (
      formattedCurrentBalance.assetCode === assetCode &&
      formattedCurrentBalance.issuer === issuer
    );
  });

  return !!balance;
};

const formatSearchAssetRecords = (
  records:
    | SearchAssetResponse["_embedded"]["records"]
    | FormattedSearchAssetRecord[],
  currentBalances: (PricedBalance & {
    id: string;
  })[],
): FormattedSearchAssetRecord[] =>
  records
    .map((record) => {
      if ("assetCode" in record) {
        return {
          ...record,
          hasTrustline: checkIfUserHasTrustline(
            currentBalances,
            record.assetCode,
            record.issuer,
          ),
        };
      }

      const formattedTokenRecord = record.asset.split("-");
      const assetCode = formattedTokenRecord[0];
      const issuer = formattedTokenRecord[1] ?? "";

      return {
        assetCode,
        domain: record.domain ?? "",
        hasTrustline: checkIfUserHasTrustline(
          currentBalances,
          assetCode,
          issuer,
        ),
        issuer,
        isNative: record.asset === "XLM",
      };
    })
    .sort((a) => {
      if (a.hasTrustline) {
        return -1;
      }

      return 1;
    });

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
  const { balanceItems, handleRefresh } = useBalancesList({
    publicKey: account?.publicKey ?? "",
    network,
    shouldPoll: false,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const { themeColors } = useColors();

  const resetPageState = () => {
    handleRefresh();
    setStatus(PageStatus.IDLE);
    setSearchResults([]);
    setSearchTerm("");
  };

  const { addAsset, removeAsset, isAddingAsset, isRemovingAsset } =
    useManageAssets({
      network,
      publicKey: account?.publicKey ?? "",
      privateKey: account?.privateKey ?? "",
      onSuccess: resetPageState,
    });

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon.X size={24} color={themeColors.base[1]} />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity
          onPress={() => moreInfoBottomSheetModalRef.current?.present()}
        >
          <Icon.HelpCircle size={24} color={themeColors.base[1]} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, t, themeColors]);

  const debouncedSearch = useDebounce(async () => {
    if (!searchTerm) {
      setStatus(PageStatus.IDLE);
      setSearchResults([]);
      return;
    }

    setStatus(PageStatus.LOADING);

    let resJson;

    if (isContractId(searchTerm)) {
      const lookupResult = await handleContractLookup(
        searchTerm,
        network,
        account?.publicKey,
      ).catch(() => {
        setStatus(PageStatus.ERROR);
        return null;
      });

      resJson = lookupResult ? [lookupResult] : [];
    } else {
      const response = await searchAsset(searchTerm, network);

      resJson = response?._embedded.records;
    }

    if (!resJson) {
      setStatus(PageStatus.ERROR);
      return;
    }

    const formattedRecords = formatSearchAssetRecords(resJson, balanceItems);

    setSearchResults(formattedRecords);
    setStatus(PageStatus.SUCCESS);
  });

  const handleSearch = (text: string) => {
    if (text === searchTerm) {
      return;
    }

    setSearchTerm(text);

    debouncedSearch();
  };

  const handlePasteFromClipboard = () => {
    getClipboardText().then(handleSearch);
  };

  const handleAddAsset = (asset: FormattedSearchAssetRecord) => {
    setSelectedAsset(asset);
    addAssetBottomSheetModalRef.current?.present();
  };

  const handleAddAssetTrustline = async () => {
    if (!selectedAsset) {
      return;
    }

    await addAsset(selectedAsset);
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
          shouldCloseOnPressBackdrop={!isAddingAsset}
          customContent={
            <AddAssetBottomSheetContent
              asset={selectedAsset}
              account={account}
              onCancel={() => addAssetBottomSheetModalRef.current?.dismiss()}
              onAddAsset={handleAddAssetTrustline}
              isAddingAsset={isAddingAsset}
            />
          }
        />
        <Input
          placeholder={t("addAssetScreen.searchPlaceholder")}
          value={searchTerm}
          onChangeText={handleSearch}
          fieldSize="lg"
          autoCapitalize="none"
          autoCorrect={false}
          leftElement={
            <Icon.SearchMd size={16} color={themeColors.foreground.primary} />
          }
        />
        <View className="h-4" />
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
                  handleAddAsset={() => handleAddAsset(asset)}
                  handleRemoveAsset={() => removeAsset(asset)}
                  isRemovingAsset={isRemovingAsset}
                />
              ))
            ) : (
              <EmptyState />
            )}
          </ScrollView>
        )}
        {status === PageStatus.ERROR && <ErrorState />}
        <View className="h-4" />
        <Button
          secondary
          lg
          testID="paste-from-clipboard-button"
          onPress={handlePasteFromClipboard}
          icon={
            <Icon.Clipboard size={16} color={themeColors.foreground.primary} />
          }
        >
          {t("addAssetScreen.pasteFromClipboard")}
        </Button>
      </View>
    </BaseLayout>
  );
};

export default AddAssetScreen;
