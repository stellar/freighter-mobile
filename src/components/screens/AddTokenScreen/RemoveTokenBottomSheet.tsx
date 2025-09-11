import { Asset } from "@stellar/stellar-sdk";
import { List } from "components/List";
import { TokenIcon } from "components/TokenIcon";
import Avatar from "components/sds/Avatar";
import { Badge } from "components/sds/Badge";
import { Button, IconPosition } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { mapNetworkToNetworkDetails } from "config/constants";
import {
  NativeToken,
  NonNativeToken,
  TokenTypeWithCustomToken,
} from "config/types";
import { ActiveAccount, useAuthenticationStore } from "ducks/auth";
import { truncateAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import React, { useMemo } from "react";
import { View } from "react-native";

type TokenDetails = {
  issuer: string;
  tokenCode: string;
  tokenType: string;
  domain?: string;
};

type RemoveTokenBottomSheetContentProps = {
  token: TokenDetails | null;
  account: ActiveAccount | null;
  onCancel: () => void;
  onRemoveToken: () => Promise<void>;
  isRemovingToken: boolean;
};

const RemoveTokenBottomSheetContent: React.FC<
  RemoveTokenBottomSheetContentProps
> = ({ token, account, onCancel, onRemoveToken, isRemovingToken }) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
  const { network } = useAuthenticationStore();
  const { networkPassphrase } = mapNetworkToNetworkDetails(network);
  const { copyToClipboard } = useClipboard();

  const listItems = useMemo(() => {
    if (!token) return [];

    const tokenContractId = new Asset(token.tokenCode, token.issuer).contractId(
      networkPassphrase,
    );

    const handleCopyTokenAddress = (contractAddress: string) => {
      copyToClipboard(contractAddress, {
        notificationMessage: t("common.copied"),
      });
    };

    const items = [
      {
        icon: (
          <Icon.Wallet01 size={16} themeColor="gray" />
        ),
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
      {
        icon: (
          <Icon.CodeCircle01 size={16} color={themeColors.foreground.primary} />
        ),
        title: t("tokenAddress"),
        trailingContent: (
          <View
            className="flex-row items-center gap-2"
            onTouchEnd={() => handleCopyTokenAddress(tokenContractId)}
          >
            <Icon.Copy01 size={16} color={themeColors.foreground.primary} />
            <Text md primary>
              {truncateAddress(tokenContractId)}
            </Text>
          </View>
        ),
        titleColor: themeColors.text.secondary,
      },
    ];

    return items;
  }, [
    token,
    account?.publicKey,
    account?.accountName,
    themeColors.foreground.primary,
    themeColors.text.secondary,
    t,
    copyToClipboard,
    networkPassphrase,
  ]);

  if (!token) {
    return null;
  }

  const iconTokenProp =
    token.issuer === "XLM"
      ? ({
          type: "native",
          code: token.issuer,
        } as NativeToken)
      : ({
          type: token.tokenType as TokenTypeWithCustomToken,
          code: token.tokenCode,
          issuer: {
            key: token.issuer,
          },
        } as NonNativeToken);

  return (
    <View className="flex-1 justify-center items-center mt-8">
      <View>
        <TokenIcon token={iconTokenProp} />
      </View>

      <View className="mt-4" />
      <Text lg primary>
        {token.tokenCode}
      </Text>

      <View className="mt-1" />
      {token.domain && (
        <Text sm secondary>
          {token.domain}
        </Text>
      )}

      <View className="mt-4" />
      <Badge
        variant="secondary"
        size="md"
        icon={<Icon.Link01 size={14} />}
        iconPosition={IconPosition.LEFT}
      >
        {t("addTokenScreen.removeToken")}
      </Badge>

      <View className="px-[16px] py-[12px] mt-6 bg-background-tertiary rounded-[16px] justify-center">
        <Text md secondary regular textAlign="center">
          {t("addTokenScreen.removeDisclaimer")}
        </Text>
      </View>

      <View className="w-full mt-6">
        <List items={listItems} variant="secondary" />
      </View>

      <View className="w-full mt-6 flex-row justify-between gap-3">
        <View className="flex-1">
          <Button
            secondary
            xl
            isFullWidth
            onPress={onCancel}
            disabled={isRemovingToken}
          >
            {t("common.cancel")}
          </Button>
        </View>
        <View className="flex-1">
          <Button
            biometric
            tertiary
            xl
            isFullWidth
            onPress={onRemoveToken}
            isLoading={isRemovingToken}
          >
            {t("addTokenScreen.removeTokenButton")}
          </Button>
        </View>
      </View>
    </View>
  );
};

export default RemoveTokenBottomSheetContent;
