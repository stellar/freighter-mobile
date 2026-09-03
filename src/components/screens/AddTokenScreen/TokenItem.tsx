import ManageTokenRightContent from "components/ManageTokenRightContent";
import { TokenIconWithBadge } from "components/TokenIconWithBadge";
import AddTokenRightContent from "components/screens/AddTokenScreen/AddTokenRightContent";
import { Text } from "components/sds/Typography";
import {
  TokenTypeWithCustomToken,
  FormattedSearchTokenRecord,
} from "config/types";
import useAppTranslation from "hooks/useAppTranslation";
import React, { memo } from "react";
import { View } from "react-native";

type TokenItemProps = {
  token: FormattedSearchTokenRecord;
  handleAddToken: (token: FormattedSearchTokenRecord) => void;
  handleRemoveToken: (token: FormattedSearchTokenRecord) => void;
};

const TokenItem: React.FC<TokenItemProps> = ({
  token,
  handleAddToken,
  handleRemoveToken,
}) => {
  const { t } = useAppTranslation();

  let subtitle = "-";
  if (token.isNative) {
    subtitle = t("common.stellarNetwork");
  } else if (token.domain) {
    subtitle = token.domain;
  } else if (
    token.name &&
    token.tokenType === TokenTypeWithCustomToken.CUSTOM_TOKEN
  ) {
    subtitle = token.name;
  }

  return (
    <View className="mb-4 flex-row justify-between items-center flex-1">
      <View className="flex-row items-center flex-1">
        <TokenIconWithBadge
          iconUrl={token.iconUrl}
          token={{
            type: token.tokenType as TokenTypeWithCustomToken,
            code: token.tokenCode,
            issuer: {
              key: token.issuer,
            },
          }}
          securityLevel={token.securityLevel}
        />
        <View className="ml-4 flex-1 mr-2">
          <Text md primary medium numberOfLines={1}>
            {token.tokenCode}
          </Text>
          <Text sm secondary medium numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </View>
      {token.hasTrustline ? (
        <ManageTokenRightContent
          token={{
            isNative: token.isNative,
            id: token.isNative
              ? token.tokenCode
              : `${token.tokenCode}:${token.issuer}`,
          }}
          handleRemoveToken={() => handleRemoveToken(token)}
        />
      ) : (
        <AddTokenRightContent handleAddToken={() => handleAddToken(token)} />
      )}
    </View>
  );
};
export default memo(
  TokenItem,
  (prev, next) =>
    prev.token.tokenCode === next.token.tokenCode &&
    prev.token.issuer === next.token.issuer,
);
