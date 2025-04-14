import { AssetIcon } from "components/AssetIcon";
import AddAssetRightContent from "components/screens/AddAssetScreen/AddAssetRightContent";
import { FormattedSearchAssetRecord } from "components/screens/AddAssetScreen/types";
import { Text } from "components/sds/Typography";
import React from "react";
import { View } from "react-native";

type AssetItemProps = {
  asset: FormattedSearchAssetRecord;
  onPress: () => void;
};

const AssetItem: React.FC<AssetItemProps> = ({ asset, onPress }) => (
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

export default AssetItem;
