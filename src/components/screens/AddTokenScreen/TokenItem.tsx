import ManageTokenRightContent from "components/ManageTokenRightContent";
import { TokenIcon } from "components/TokenIcon";
import AddTokenRightContent from "components/screens/AddTokenScreen/AddTokenRightContent";
import { Text } from "components/sds/Typography";
import {
  TokenTypeWithCustomToken,
  FormattedSearchTokenRecord,
} from "config/types";
import React from "react";
import { View } from "react-native";

type TokenItemProps = {
  token: FormattedSearchTokenRecord;
  handleAddToken: () => void;
  handleRemoveToken: () => void;
  isRemovingToken: boolean;
  isScanningToken: boolean;
};

const TokenItem: React.FC<TokenItemProps> = ({
  token,
  handleAddToken,
  handleRemoveToken,
  isRemovingToken,
  isScanningToken,
}) => (
  <View className="mb-4 flex-row justify-between items-center flex-1">
    <View className="flex-row items-center flex-1">
      <TokenIcon
        token={{
          type: token.tokenType as TokenTypeWithCustomToken,
          code: token.tokenCode,
          issuer: {
            key: token.issuer,
          },
        }}
      />
      <View className="ml-4 flex-1 mr-2">
        <Text md primary medium numberOfLines={1}>
          {token.tokenCode}
        </Text>
        <Text sm secondary medium numberOfLines={1}>
          {token.domain || "-"}
        </Text>
      </View>
    </View>
    {token.hasTrustline ? (
      <ManageTokenRightContent
        token={{
          isNative: token.isNative,
          id: `${token.tokenCode}:${token.issuer}`,
        }}
        handleRemoveToken={handleRemoveToken}
        isRemovingToken={isRemovingToken}
      />
    ) : (
      <AddTokenRightContent
        handleAddToken={handleAddToken}
        isScanningToken={isScanningToken}
      />
    )}
  </View>
);
export default TokenItem;
