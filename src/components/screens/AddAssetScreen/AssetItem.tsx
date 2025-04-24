import { AssetIcon } from "components/AssetIcon";
import ManageAssetRightContent from "components/ManageAssetRightContent";
import AddAssetRightContent from "components/screens/AddAssetScreen/AddAssetRightContent";
import { Text } from "components/sds/Typography";
import {
  AssetTypeWithCustomToken,
  FormattedSearchAssetRecord,
} from "config/types";
import React from "react";
import { View } from "react-native";

type AssetItemProps = {
  asset: FormattedSearchAssetRecord;
  handleAddAsset: () => void;
  handleRemoveAsset: () => void;
  isRemovingAsset: boolean;
};

const AssetItem: React.FC<AssetItemProps> = ({
  asset,
  handleAddAsset,
  handleRemoveAsset,
  isRemovingAsset,
}) => (
  <View className="mb-4 flex-row justify-between items-center flex-1">
    <View className="flex-row items-center flex-1">
      <AssetIcon
        token={{
          type: asset.assetType as AssetTypeWithCustomToken,
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
    {asset.hasTrustline ? (
      <ManageAssetRightContent
        asset={{
          isNative: asset.isNative,
          id: `${asset.assetCode}:${asset.issuer}`,
        }}
        handleRemoveAsset={handleRemoveAsset}
        isRemovingAsset={isRemovingAsset}
      />
    ) : (
      <AddAssetRightContent handleAddAsset={handleAddAsset} />
    )}
  </View>
);
export default AssetItem;
