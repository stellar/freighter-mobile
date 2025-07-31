import Clipboard from "@react-native-clipboard/clipboard";
import { AssetIcon } from "components/AssetIcon";
import Avatar from "components/sds/Avatar";
import { Badge } from "components/sds/Badge";
import { Button, IconPosition } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { NETWORKS, NETWORK_NAMES } from "config/constants";
import {
  AssetTypeWithCustomToken,
  FormattedSearchAssetRecord,
} from "config/types";
import { ActiveAccount, useAuthenticationStore } from "ducks/auth";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { View, TouchableOpacity, ActivityIndicator } from "react-native";

type AddAssetBottomSheetContentProps = {
  asset: FormattedSearchAssetRecord | null;
  account: ActiveAccount | null;
  onCancel: () => void;
  onAddAsset: () => void;
  isAddingAsset: boolean;
  isMalicious?: boolean;
  isSuspicious?: boolean;
};

const AddAssetBottomSheetContent: React.FC<AddAssetBottomSheetContentProps> = ({
  asset,
  account,
  onCancel,
  onAddAsset,
  isAddingAsset,
  isMalicious = false,
  isSuspicious = false,
}) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
  const { network } = useAuthenticationStore();

  const getDisplayText = () => {
    if (!asset) return "";
    if (isMalicious || isSuspicious) {
      return `${asset.issuer.substring(0, 7)}...`;
    }
    return network === NETWORKS.PUBLIC
      ? NETWORK_NAMES.PUBLIC
      : NETWORK_NAMES.TESTNET;
  };

  if (!asset) {
    return null;
  }

  return (
    <View className="flex-1 justify-center items-center mt-2">
      <View className="relative">
        <AssetIcon
          token={{
            type: asset.assetType as AssetTypeWithCustomToken,
            code: asset.assetCode,
            issuer: {
              key: asset.issuer,
            },
          }}
        />
        {isMalicious && (
          <View
            className="absolute -bottom-1 -right-1 rounded-full p-1 z-10"
            style={{
              backgroundColor: themeColors.red[3],
            }}
          >
            <Icon.AlertCircle size={12} color={themeColors.status.error} />
          </View>
        )}
      </View>
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
        icon={<Icon.Link01 size={16} />}
        iconPosition={IconPosition.LEFT}
      >
        {isMalicious || isSuspicious
          ? t("addAssetScreen.approveTrustline")
          : t("addAssetScreen.addAsset")}
      </Badge>

      {/* Security Warning */}
      {(isMalicious || isSuspicious) && (
        <TouchableOpacity
          onPress={onAddAsset}
          className="mt-4 w-full px-6 py-3 rounded-lg"
          style={{
            backgroundColor: isMalicious
              ? themeColors.red[3]
              : themeColors.amber[3],
          }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1">
              <Icon.AlertSquare
                size={16}
                color={
                  isMalicious
                    ? themeColors.status.error
                    : themeColors.status.warning
                }
              />
              <Text
                sm
                style={{
                  color: isMalicious
                    ? themeColors.red[11]
                    : themeColors.status.warning,
                  textAlign: "left",
                  marginLeft: 8,
                }}
              >
                {isMalicious
                  ? t("addAssetScreen.maliciousAsset")
                  : "This token was flagged as suspicious"}
              </Text>
            </View>
            <Icon.ChevronRight
              size={16}
              color={
                isMalicious
                  ? themeColors.status.error
                  : themeColors.status.warning
              }
            />
          </View>
        </TouchableOpacity>
      )}

      {/* Disclaimer - Show for both states */}
      <View className="flex-row items-center mt-6 p-4 bg-background-tertiary rounded-xl justify-center">
        <Text md secondary style={{ textAlign: "center" }}>
          {t("addAssetScreen.disclaimer")}
        </Text>
      </View>
      <View className="w-full flex-col items-center mt-6 bg-background-tertiary rounded-xl justify-between">
        <View className="flex-row items-center px-6 py-4 justify-between w-full">
          <View className="flex-row items-center">
            <Icon.Wallet01 size={16} color={themeColors.foreground.primary} />
            <Text
              md
              secondary
              style={{ textAlign: "center", marginLeft: pxValue(8) }}
            >
              {t("wallet")}
            </Text>
          </View>
          <View className="flex-row items-center">
            <View style={{ transform: [{ scale: 0.7 }] }} className="mr-1">
              <Avatar
                size="sm"
                hasBorder
                publicAddress={account?.publicKey ?? ""}
              />
            </View>
            <Text md style={{ textAlign: "center", marginRight: pxValue(8) }}>
              {account?.accountName}
            </Text>
          </View>
        </View>
        <View
          className="h-px self-center w-11/12"
          style={{ backgroundColor: themeColors.gray[6] }}
        />

        <View className="flex-row items-center px-6 py-4 justify-between w-full">
          <View className="flex-row items-center">
            <Icon.Circle size={16} color={themeColors.foreground.primary} />
            <Text
              md
              secondary
              style={{ textAlign: "center", marginLeft: pxValue(8) }}
            >
              {isMalicious || isSuspicious
                ? t("addAssetScreen.assetAddress")
                : t("network")}
            </Text>
          </View>
          <View className="flex-row items-center">
            {(isMalicious || isSuspicious) && (
              <TouchableOpacity
                onPress={() => {
                  Clipboard.setString(asset.issuer);
                }}
                className="mr-2 p-1"
              >
                <Icon.Copy01 size={16} color={themeColors.foreground.primary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => {
                if (isMalicious || isSuspicious) {
                  Clipboard.setString(asset.issuer);
                }
              }}
            >
              <Text md>{getDisplayText()}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Confirmation Text - Only show when not malicious or suspicious */}
      {!isMalicious && !isSuspicious && (
        <View className="mt-4 px-6">
          <Text sm secondary className="text-center" style={{ lineHeight: 16 }}>
            {t("addAssetScreen.confirmTrust")}
          </Text>
        </View>
      )}

      <View
        className={`w-full mt-6 ${isMalicious || isSuspicious ? "flex-col gap-3" : "flex-row justify-between gap-3"}`}
      >
        <View className={isMalicious || isSuspicious ? "w-full" : "flex-1"}>
          <Button
            tertiary={isSuspicious}
            destructive={isMalicious}
            secondary={!isMalicious && !isSuspicious}
            lg
            isFullWidth
            onPress={onCancel}
            disabled={isAddingAsset}
          >
            {t("common.cancel")}
          </Button>
        </View>
        <View className={isMalicious || isSuspicious ? "w-full" : "flex-1"}>
          {isMalicious || isSuspicious ? (
            <TouchableOpacity
              onPress={onAddAsset}
              disabled={isAddingAsset}
              className="w-full h-10 justify-center items-center rounded-full"
              style={{
                backgroundColor: "transparent",
                borderWidth: 0,
              }}
            >
              {isAddingAsset ? (
                <ActivityIndicator
                  size="small"
                  color={
                    isMalicious
                      ? themeColors.status.error
                      : themeColors.foreground.secondary
                  }
                />
              ) : (
                <Text
                  lg
                  style={{
                    color: isMalicious
                      ? themeColors.red[11]
                      : themeColors.text.secondary,
                  }}
                >
                  {t("addAssetScreen.approveAnyway")}
                </Text>
              )}
            </TouchableOpacity>
          ) : (
            <Button
              tertiary
              lg
              isFullWidth
              onPress={onAddAsset}
              isLoading={isAddingAsset}
            >
              {t("addAssetScreen.addAssetButton")}
            </Button>
          )}
        </View>
      </View>
    </View>
  );
};

export default AddAssetBottomSheetContent;
