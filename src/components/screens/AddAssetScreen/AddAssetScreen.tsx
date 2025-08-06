/* eslint-disable @typescript-eslint/no-misused-promises */
import Blockaid from "@blockaid/client";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import BottomSheet from "components/BottomSheet";
import Spinner from "components/Spinner";
import { SecurityDetailBottomSheet } from "components/blockaid";
import { BaseLayout } from "components/layout/BaseLayout";
import AddAssetBottomSheetContent from "components/screens/AddAssetScreen/AddAssetBottomSheetContent";
import AssetItem from "components/screens/AddAssetScreen/AssetItem";
import EmptyState from "components/screens/AddAssetScreen/EmptyState";
import ErrorState from "components/screens/AddAssetScreen/ErrorState";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { AnalyticsEvent } from "config/analyticsConfig";
import { DEFAULT_BLOCKAID_SCAN_DELAY } from "config/constants";
import {
  MANAGE_ASSETS_ROUTES,
  ManageAssetsStackParamList,
} from "config/routes";
import { FormattedSearchAssetRecord, HookStatus } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useBlockaidAsset } from "hooks/blockaid/useBlockaidAsset";
import useAppTranslation from "hooks/useAppTranslation";
import { useAssetLookup } from "hooks/useAssetLookup";
import { useBalancesList } from "hooks/useBalancesList";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useManageAssets } from "hooks/useManageAssets";
import { useRightHeaderButton } from "hooks/useRightHeader";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { analytics } from "services/analytics";
import { SecurityLevel } from "services/blockaid/constants";
import {
  assessAssetSecurity,
  extractSecurityWarnings,
} from "services/blockaid/helper";

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
  const [scannedAsset, setScannedAsset] = useState<
    Blockaid.TokenScanResponse | undefined
  >(undefined);
  const [isScanning, setIsScanning] = useState(false);
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

  const { scanAsset } = useBlockaidAsset();

  const securityAssessment = useMemo(
    () => assessAssetSecurity(scannedAsset),
    [scannedAsset],
  );
  const isAssetMalicious = securityAssessment.isMalicious;
  const isAssetSuspicious = securityAssessment.isSuspicious;

  const securitySeverity = useMemo(() => {
    if (isAssetMalicious) return SecurityLevel.MALICIOUS;
    if (isAssetSuspicious) return SecurityLevel.SUSPICIOUS;

    return undefined;
  }, [isAssetMalicious, isAssetSuspicious]);

  const securityWarnings = useMemo(() => {
    if (isAssetMalicious || isAssetSuspicious) {
      const warnings = extractSecurityWarnings(scannedAsset);

      if (Array.isArray(warnings) && warnings.length > 0) {
        return warnings;
      }
    }

    return [];
  }, [isAssetMalicious, isAssetSuspicious, scannedAsset]);

  const resetPageState = useCallback(() => {
    handleRefresh();
    resetSearch();
  }, [handleRefresh, resetSearch]);

  const { addAsset, removeAsset, isAddingAsset, isRemovingAsset } =
    useManageAssets({
      network,
      account,
      onSuccess: resetPageState,
    });

  useRightHeaderButton({
    onPress: () => moreInfoBottomSheetModalRef.current?.present(),
  });

  const handlePasteFromClipboard = useCallback(() => {
    getClipboardText().then(handleSearch);
  }, [getClipboardText, handleSearch]);

  const handleAddAsset = useCallback(
    (asset: FormattedSearchAssetRecord) => {
      setSelectedAsset(asset);
      setIsScanning(true);
      setScannedAsset(undefined);

      scanAsset(asset.assetCode, asset.issuer)
        .then((scanResult) => {
          setScannedAsset(scanResult);
        })
        .catch(() => {
          setScannedAsset(undefined);
        })
        .finally(() => {
          setIsScanning(false);
        });

      setTimeout(() => {
        addAssetBottomSheetModalRef.current?.present();
      }, DEFAULT_BLOCKAID_SCAN_DELAY);
    },
    [scanAsset],
  );

  const handleConfirmAssetAddition = useCallback(async () => {
    if (!selectedAsset) {
      return;
    }

    analytics.trackAddTokenConfirmed(selectedAsset.assetCode);

    await addAsset(selectedAsset);

    addAssetBottomSheetModalRef.current?.dismiss();
  }, [selectedAsset, addAsset]);

  const handleCancelAssetAddition = useCallback(() => {
    if (selectedAsset) {
      analytics.trackAddTokenRejected(selectedAsset.assetCode);
    }

    addAssetBottomSheetModalRef.current?.dismiss();
  }, [selectedAsset]);

  const handleSecurityWarning = useCallback(() => {
    securityWarningBottomSheetModalRef.current?.present();
  }, []);

  const handleProceedAnyway = useCallback(() => {
    securityWarningBottomSheetModalRef.current?.dismiss();

    handleConfirmAssetAddition();
  }, [handleConfirmAssetAddition]);

  const handleRemoveAsset = useCallback(
    (asset: FormattedSearchAssetRecord) => {
      removeAsset({
        assetRecord: asset,
        assetType: asset.assetType,
      });
    },
    [removeAsset],
  );

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
          handleCloseModal={() => {
            addAssetBottomSheetModalRef.current?.dismiss();
          }}
          analyticsEvent={AnalyticsEvent.VIEW_ADD_ASSET_MANUALLY}
          shouldCloseOnPressBackdrop={!isScanning && !!selectedAsset}
          customContent={
            <AddAssetBottomSheetContent
              asset={selectedAsset}
              account={account}
              onCancel={handleCancelAssetAddition}
              onAddAsset={
                isAssetMalicious || isAssetSuspicious
                  ? handleSecurityWarning
                  : handleConfirmAssetAddition
              }
              proceedAnywayAction={handleConfirmAssetAddition}
              isAddingAsset={isAddingAsset}
              isMalicious={isAssetMalicious}
              isSuspicious={isAssetSuspicious}
            />
          }
        />
        <BottomSheet
          modalRef={securityWarningBottomSheetModalRef}
          handleCloseModal={() =>
            securityWarningBottomSheetModalRef.current?.dismiss()
          }
          customContent={
            <SecurityDetailBottomSheet
              warnings={securityWarnings}
              onCancel={() =>
                securityWarningBottomSheetModalRef.current?.dismiss()
              }
              onProceedAnyway={handleProceedAnyway}
              onClose={() =>
                securityWarningBottomSheetModalRef.current?.dismiss()
              }
              severity={securitySeverity}
              proceedAnywayText={t("addAssetScreen.approveAnyway")}
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
                  handleRemoveAsset={() => handleRemoveAsset(asset)}
                  isRemovingAsset={isRemovingAsset}
                  isScanningAsset={isScanning}
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
