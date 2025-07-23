import { AssetIcon } from "components/AssetIcon";
import Avatar from "components/sds/Avatar";
import { Badge } from "components/sds/Badge";
import { Button, IconPosition } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { NETWORKS } from "config/constants";
import {
  AssetTypeWithCustomToken,
  FormattedSearchAssetRecord,
} from "config/types";
import { ActiveAccount, useAuthenticationStore } from "ducks/auth";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { View } from "react-native";

type AddAssetBottomSheetContentProps = {
  asset: FormattedSearchAssetRecord | null;
  account: ActiveAccount | null;
  onCancel: () => void;
  onAddAsset: () => void;
  isAddingAsset: boolean;
};

const AddAssetBottomSheetContent: React.FC<AddAssetBottomSheetContentProps> = ({
  asset,
  account,
  onCancel,
  onAddAsset,
  isAddingAsset,
}) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
  const { network } = useAuthenticationStore();

  if (!asset) {
    return null;
  }

  return (
    <View className="flex-1 justify-center items-center mt-2">
      <AssetIcon
        token={{
          type: asset.assetType as AssetTypeWithCustomToken,
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
        icon={<Icon.Link01 size={16} />}
        iconPosition={IconPosition.LEFT}
      >
        {t("addAssetScreen.addAsset")}
      </Badge>
      <View className="flex-row items-center mt-6 p-6 bg-background-tertiary rounded-xl justify-center">
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
          style={{ backgroundColor: "#343434" }}
        />

        <View className="flex-row items-center px-6 py-4 justify-between w-full">
          <View className="flex-row items-center">
            <Icon.Globe01 size={16} color={themeColors.foreground.primary} />
            <Text
              md
              secondary
              style={{ textAlign: "center", marginLeft: pxValue(8) }}
            >
              {t("network")}
            </Text>
          </View>
          <Text md>
            {network === NETWORKS.PUBLIC ? t("mainnet") : t("testnet")}
          </Text>
        </View>
      </View>

      {/* Confirmation Text */}
      <View className="mt-4 px-6">
        <Text sm secondary className="text-center" style={{ lineHeight: 16 }}>
          {t("addAssetScreen.confirmTrust")}
        </Text>
      </View>

      <View className="flex-row justify-between w-full mt-6 gap-3">
        <View className="flex-1">
          <Button
            secondary
            lg
            isFullWidth
            onPress={onCancel}
            disabled={isAddingAsset}
          >
            {t("common.cancel")}
          </Button>
        </View>
        <View className="flex-1">
          <Button
            tertiary
            lg
            isFullWidth
            onPress={onAddAsset}
            isLoading={isAddingAsset}
          >
            {t("addAssetScreen.addAssetButton")}
          </Button>
        </View>
      </View>
    </View>
  );
};

export default AddAssetBottomSheetContent;
