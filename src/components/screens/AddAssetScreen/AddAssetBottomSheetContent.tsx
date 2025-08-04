import { AssetIcon } from "components/AssetIcon";
import { List } from "components/List";
import Spinner from "components/Spinner";
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
import { truncateAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import React from "react";
import { View, TouchableOpacity } from "react-native";

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
  const { copyToClipboard } = useClipboard();

  const getDisplayText = () => {
    if (!asset) return "";
    if (isMalicious || isSuspicious) {
      return truncateAddress(asset.issuer, 7, 0);
    }

    return network === NETWORKS.PUBLIC
      ? NETWORK_NAMES.PUBLIC
      : NETWORK_NAMES.TESTNET;
  };

  const getSecurityBannerBgColor = () => {
    if (isMalicious) {
      return "bg-red-3";
    }

    return "bg-amber-3";
  };

  if (!asset) {
    return null;
  }

  const listItems = [
    {
      icon: <Icon.Wallet01 size={16} color={themeColors.foreground.primary} />,
      title: t("wallet"),
      trailingContent: (
        <View className="flex-row items-center gap-2">
          <Avatar
            size="sm"
            publicAddress={account?.publicKey ?? ""}
            hasBorder={false}
            hasBackground={false}
          />
          <Text md primary>
            {account?.accountName}
          </Text>
        </View>
      ),
      titleColor: themeColors.text.secondary,
    },
  ];

  if (!isMalicious && !isSuspicious) {
    listItems.push({
      icon: <Icon.Globe01 size={16} color={themeColors.foreground.primary} />,
      title: t("network"),
      trailingContent: (
        <Text md primary>
          {network === NETWORKS.PUBLIC ? t("mainnet") : t("testnet")}
        </Text>
      ),
      titleColor: themeColors.text.secondary,
    });
  }

  if (isMalicious || isSuspicious) {
    listItems.push({
      icon: <Icon.Circle size={16} color={themeColors.foreground.primary} />,
      title: t("addAssetScreen.assetAddress"),
      trailingContent: (
        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={() => {
              copyToClipboard(asset.issuer);
            }}
            className="p-1"
          >
            <Icon.Copy01 size={16} color={themeColors.foreground.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              copyToClipboard(asset.issuer);
            }}
          >
            <Text md primary>
              {getDisplayText()}
            </Text>
          </TouchableOpacity>
        </View>
      ),
      titleColor: themeColors.text.secondary,
    });
  }

  return (
    <View className="flex-1 justify-center items-center mt-8">
      <View>
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
          <View className="absolute -bottom-1 -right-1 rounded-full p-1 z-10 bg-red-3">
            <Icon.AlertCircle size={12} color={themeColors.status.error} />
          </View>
        )}
      </View>

      <View className="mt-4" />
      <Text lg primary>
        {asset.assetCode}
      </Text>

      <View className="mt-1" />
      {asset.domain && (
        <Text sm secondary>
          {asset.domain}
        </Text>
      )}

      <View className="mt-4" />
      <Badge
        variant="secondary"
        size="md"
        icon={
          !isMalicious && !isSuspicious ? (
            <Icon.PlusCircle size={14} />
          ) : (
            <Icon.Link01 size={14} />
          )
        }
        iconPosition={IconPosition.LEFT}
      >
        {isMalicious || isSuspicious
          ? t("addAssetScreen.approveTrustline")
          : t("addAssetScreen.addAsset")}
      </Badge>

      {(isMalicious || isSuspicious) && (
        <TouchableOpacity
          onPress={onAddAsset}
          className={`mt-4 w-full px-[16px] py-[12px] rounded-[16px] ${getSecurityBannerBgColor()}`}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1 gap-[8px]">
              <Icon.AlertSquare
                size={16}
                themeColor={isMalicious ? "red" : "amber"}
              />
              <Text
                sm
                textAlign="left"
                color={
                  isMalicious ? themeColors.red[11] : themeColors.amber[11]
                }
              >
                {isMalicious
                  ? t("addAssetScreen.maliciousAsset")
                  : t("addAssetScreen.addAssetScreen.suspiciousAsset")}
              </Text>
            </View>
            <Icon.ChevronRight
              size={16}
              themeColor={isMalicious ? "red" : "amber"}
            />
          </View>
        </TouchableOpacity>
      )}

      <View className="px-[16px] py-[12px] mt-6 bg-background-tertiary rounded-[16px] justify-center">
        <Text md secondary regular textAlign="center">
          {t("addAssetScreen.disclaimer")}
        </Text>
      </View>

      <View className="w-full mt-6">
        <List items={listItems} variant="secondary" />
      </View>

      {!isMalicious && !isSuspicious && (
        <View className="mt-4 px-6">
          <Text sm secondary textAlign="center">
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
            xl
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
              className="w-full h-10 justify-center items-center rounded-full bg-transparent border-0"
            >
              {isAddingAsset ? (
                <Spinner size="small" />
              ) : (
                <Text
                  md
                  semiBold
                  color={
                    isMalicious
                      ? themeColors.red[11]
                      : themeColors.text.secondary
                  }
                >
                  {t("addAssetScreen.approveAnyway")}
                </Text>
              )}
            </TouchableOpacity>
          ) : (
            <Button
              tertiary
              xl
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
