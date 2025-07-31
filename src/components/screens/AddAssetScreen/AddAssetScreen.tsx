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
import SecurityWarningBottomSheet from "components/screens/AddAssetScreen/SecurityWarningBottomSheet";
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
import { useScanAsset } from "hooks/useScanAsset";
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
  const securityWarningBottomSheetModalRef = useRef<BottomSheetModal>(null);
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

  const { scanAsset, data: scanData } = useScanAsset();

  useRightHeaderButton({
    onPress: () => moreInfoBottomSheetModalRef.current?.present(),
  });

  const handlePasteFromClipboard = () => {
    getClipboardText().then(handleSearch);
  };

  const handleAddAsset = async (asset: FormattedSearchAssetRecord) => {
    setSelectedAsset(asset);

    // Scan the asset for security threats
    try {
      await scanAsset({
        assetCode: asset.assetCode,
        assetIssuer: asset.issuer,
        network,
      });
    } catch (error) {
      // Handle scan error silently
    }

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

  const handleSecurityWarning = () => {
    securityWarningBottomSheetModalRef.current?.present();
  };

  const handleProceedAnyway = () => {
    securityWarningBottomSheetModalRef.current?.dismiss();
    handleConfirmAssetAddition();
  };

  // Check if the selected asset is malicious based on scan results
  const isAssetMalicious = () => {
    if (!selectedAsset || !scanData || !scanData.data) {
      return false;
    }

    const scanResult = scanData.data;

    // Check if the scan result indicates malicious activity
    const maliciousScore = scanResult.malicious_score;

    // Convert string to number if needed
    const score =
      typeof maliciousScore === "string"
        ? parseFloat(maliciousScore)
        : maliciousScore;

    if (typeof score === "number" && score > 0.7) {
      return true;
    }

    // Check for specific attack types
    const attackTypes = scanResult.attack_types;

    if (attackTypes && Object.keys(attackTypes).length > 0) {
      return true;
    }

    // Check result_type
    const resultType = scanResult.result_type;

    if (resultType === "Malicious") {
      return true;
    }

    return false;
  };

  const isAssetSuspicious = () => {
    if (!selectedAsset || !scanData || !scanData.data) {
      return false;
    }

    const scanResult = scanData.data;

    // Check if the scan result indicates suspicious activity
    const maliciousScore = scanResult.malicious_score;
    const score =
      typeof maliciousScore === "string"
        ? parseFloat(maliciousScore)
        : maliciousScore;

    // Suspicious if score is between 0.3 and 0.7
    if (typeof score === "number" && score >= 0.3 && score <= 0.7) {
      return true;
    }

    // Check result_type
    const resultType = scanResult.result_type;
    if (resultType === "Warning") {
      return true;
    }

    return false;
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
              onAddAsset={
                isAssetMalicious() || isAssetSuspicious()
                  ? handleSecurityWarning
                  : handleConfirmAssetAddition
              }
              isAddingAsset={isAddingAsset}
              isMalicious={isAssetMalicious()}
              isSuspicious={isAssetSuspicious()}
            />
          }
        />
        <BottomSheet
          modalRef={securityWarningBottomSheetModalRef}
          handleCloseModal={() =>
            securityWarningBottomSheetModalRef.current?.dismiss()
          }
          customContent={
            <SecurityWarningBottomSheet
              warnings={[
                {
                  id: "malicious-token",
                  title: "This token is a scam",
                  description: "The token has been flagged as malicious",
                },
                {
                  id: "low-liquidity",
                  title: "This token has low liquidity",
                  description: "Trading this token may be risky",
                },
                {
                  id: "malicious-site",
                  title: "This site is a malicious app",
                  description: "The source has been flagged as unsafe",
                },
              ]}
              onCancel={() =>
                securityWarningBottomSheetModalRef.current?.dismiss()
              }
              onProceedAnyway={handleProceedAnyway}
              onClose={() =>
                securityWarningBottomSheetModalRef.current?.dismiss()
              }
              severity={isAssetMalicious() ? "malicious" : "suspicious"}
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
