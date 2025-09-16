import ManageTokenRightContent from "components/ManageTokenRightContent";
import { TokenIcon } from "components/TokenIcon";
import AddTokenRightContent from "components/screens/AddTokenScreen/AddTokenRightContent";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import {
  TokenTypeWithCustomToken,
  FormattedSearchTokenRecord,
} from "config/types";
import React, { memo } from "react";
import { View } from "react-native";

type TokenItemProps = {
  token: FormattedSearchTokenRecord;
  handleAddToken: () => void;
  handleRemoveToken: () => void;
};

const TokenItem: React.FC<TokenItemProps> = ({
  token,
  handleAddToken,
  handleRemoveToken,
}) => {
  const { isSuspicious, isMalicious } = {
    isSuspicious: token.isSuspicious || token.isMalicious,
    isMalicious: token.isMalicious,
  };

  return (
    <View className="mb-4 flex-row justify-between items-center flex-1">
      <View className="flex-row items-center flex-1">
        <View className="relative z-0">
          <TokenIcon
            iconUrl={token.iconUrl}
            token={{
              type: token.tokenType as TokenTypeWithCustomToken,
              code: token.tokenCode,
              issuer: {
                key: token.issuer,
              },
            }}
          />
          {isSuspicious && (
            <View className="absolute bottom-0 right-0 w-4 h-4 items-center justify-center z-10">
              <Icon.AlertCircle
                size={8}
                themeColor={isMalicious ? "red" : "amber"}
                withBackground
              />
            </View>
          )}
        </View>
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
        />
      ) : (
        <AddTokenRightContent handleAddToken={handleAddToken} />
      )}
    </View>
  );
};
export default memo(TokenItem);
