/* eslint-disable @typescript-eslint/no-misused-promises */
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import BottomSheet from "components/BottomSheet";
import Spinner from "components/Spinner";
import { BaseLayout } from "components/layout/BaseLayout";
import AddAssetBottomSheetContent from "components/screens/AddAssetScreen/AddAssetBottomSheetContent";
import AssetItem from "components/screens/AddAssetScreen/AssetItem";
import EmptyState from "components/screens/AddAssetScreen/EmptyState";
import ErrorState from "components/screens/AddAssetScreen/ErrorState";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { AnalyticsEvent } from "config/analyticsConfig";
import {
  MANAGE_ASSETS_ROUTES,
  ManageAssetsStackParamList,
} from "config/routes";
import { FormattedSearchAssetRecord, HookStatus } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import useAppTranslation from "hooks/useAppTranslation";
import { useAssetLookup } from "hooks/useAssetLookup";
import { useBalancesList } from "hooks/useBalancesList";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useManageAssets } from "hooks/useManageAssets";
import { useRightHeaderButton } from "hooks/useRightHeader";
import React, { useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { analytics } from "services/analytics";

type AddAssetScreenProps = NativeStackScreenProps<
  ManageAssetsStackParamList,
  typeof MANAGE_ASSETS_ROUTES.ADD_ASSET_SCREEN
>;

const AddAssetScreen: React.FC<AddAssetScreenProps> = () => {
  const { network } = useAuthenticationStore();
  const { account } = useGetActiveAccount();
  const { t } = useAppTranslation();
  const { getClipboardText } = useClipboard();
  const [selectedAsset, setSelectedAsset] =
    useState<FormattedSearchAssetRecord | null>(null);
  const moreInfoBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const addAssetBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const { balanceItems, handleRefresh } = useBalancesList({
    publicKey: account?.publicKey ?? "",
    network,
    shouldPoll: false,
  });
  const { themeColors } = useColors();

  const { searchTerm, searchResults, status, handleSearch, resetSearch } =
    useAssetLookup({
      network,
      publicKey: account?.publicKey,
      balanceItems,
    });

  const resetPageState = () => {
    handleRefresh();
    resetSearch();
  };

  const { addAsset, removeAsset, isAddingAsset, isRemovingAsset } =
    useManageAssets({
      network,
      account,
      onSuccess: resetPageState,
    });

  useRightHeaderButton({
    onPress: () => moreInfoBottomSheetModalRef.current?.present(),
  });

  const handlePasteFromClipboard = () => {
    getClipboardText().then(handleSearch);
  };

  const handleAddAsset = (asset: FormattedSearchAssetRecord) => {
    setSelectedAsset(asset);
    addAssetBottomSheetModalRef.current?.present();
  };

  const handleConfirmAssetAddition = async () => {
    if (!selectedAsset) {
      return;
    }

    analytics.trackAddTokenConfirmed(selectedAsset.assetCode);

    await addAsset(selectedAsset);
    addAssetBottomSheetModalRef.current?.dismiss();
  };

  const handleCancelAssetAddition = () => {
    if (selectedAsset) {
      analytics.trackAddTokenRejected(selectedAsset.assetCode);
    }

    addAssetBottomSheetModalRef.current?.dismiss();
  };

  return (
    <BaseLayout insets={{ top: false }} useKeyboardAvoidingView>
      <View className="flex-1 justify-between">
        <BottomSheet
          modalRef={moreInfoBottomSheetModalRef}
          title={t("manageAssetsScreen.moreInfo.title")}
          description={`${t("manageAssetsScreen.moreInfo.block1")}\n\n${t("manageAssetsScreen.moreInfo.block2")}`}
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
          analyticsEvent={AnalyticsEvent.VIEW_ADD_ASSET_MANUALLY}
          shouldCloseOnPressBackdrop={!isAddingAsset}
          customContent={
            <AddAssetBottomSheetContent
              asset={selectedAsset}
              account={account}
              onCancel={handleCancelAssetAddition}
              onAddAsset={handleConfirmAssetAddition}
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
        {status === HookStatus.LOADING && <Spinner />}
        {status === HookStatus.SUCCESS && (
          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            alwaysBounceVertical={false}
          >
            {searchResults.length > 0 ? (
              searchResults.map((asset) => (
                <AssetItem
                  key={`${asset.assetCode}:${asset.issuer}`}
                  asset={asset}
                  handleAddAsset={() => handleAddAsset(asset)}
                  handleRemoveAsset={() =>
                    removeAsset({
                      assetRecord: asset,
                      assetType: asset.assetType,
                    })
                  }
                  isRemovingAsset={isRemovingAsset}
                />
              ))
            ) : (
              <EmptyState />
            )}
          </ScrollView>
        )}
        {status === HookStatus.ERROR && <ErrorState />}
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
