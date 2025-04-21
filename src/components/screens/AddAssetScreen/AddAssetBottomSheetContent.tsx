import { AssetIcon } from "components/AssetIcon";
import { FormattedSearchAssetRecord } from "components/screens/AddAssetScreen/types";
import Avatar from "components/sds/Avatar";
import { Badge } from "components/sds/Badge";
import { Button, IconPosition } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { ActiveAccount } from "ducks/auth";
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
        icon={<Icon.ShieldPlus size={16} />}
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
          <Icon.UserCircle size={16} color={themeColors.foreground.primary} />
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
          <Button
            secondary
            lg
            isFullWidth
            onPress={onCancel}
            disabled={isAddingAsset}
          >
            {t("addAssetScreen.cancel")}
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
            {t("addAssetScreen.addAsset")}
          </Button>
        </View>
      </View>
    </View>
  );
};

export default AddAssetBottomSheetContent;
