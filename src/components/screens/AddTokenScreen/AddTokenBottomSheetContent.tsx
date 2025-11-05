import { Asset } from "@stellar/stellar-sdk";
import { List } from "components/List";
import { TokenIcon } from "components/TokenIcon";
import Avatar from "components/sds/Avatar";
import { Badge } from "components/sds/Badge";
import { Banner } from "components/sds/Banner";
import { Button, IconPosition } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { TextButton } from "components/sds/TextButton";
import { Text } from "components/sds/Typography";
import {
  NETWORKS,
  NETWORK_NAMES,
  mapNetworkToNetworkDetails,
} from "config/constants";
import {
  TokenTypeWithCustomToken,
  FormattedSearchTokenRecord,
} from "config/types";
import { ActiveAccount, useAuthenticationStore } from "ducks/auth";
import { isContractId } from "helpers/soroban";
import { truncateAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import React, { useMemo } from "react";
import { View, TouchableOpacity } from "react-native";

type AddTokenBottomSheetContentProps = {
  token: FormattedSearchTokenRecord | null;
  account: ActiveAccount | null;
  onCancel: () => void;
  onAddToken: () => void;
  proceedAnywayAction?: () => void;
  isAddingToken: boolean;
  isMalicious?: boolean;
  isSuspicious?: boolean;
  isUnableToScanToken?: boolean;
  onSecurityWarningPress?: () => void;
};

const AddTokenBottomSheetContent: React.FC<AddTokenBottomSheetContentProps> = ({
  token,
  account,
  onCancel,
  onAddToken,
  proceedAnywayAction,
  isAddingToken,
  isMalicious = false,
  isSuspicious = false,
  isUnableToScanToken = false,
  onSecurityWarningPress,
}) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
  const { network } = useAuthenticationStore();
  const { copyToClipboard } = useClipboard();
  const { networkPassphrase } = mapNetworkToNetworkDetails(network);

  const renderButtons = () => {
    // Normal state - side by side with biometrics
    if (!isMalicious && !isSuspicious && !isUnableToScanToken) {
      return (
        <View className="flex-row justify-between gap-3">
          <View className="flex-1">
            <Button
              secondary
              xl
              isFullWidth
              onPress={onCancel}
              disabled={isAddingToken}
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
              onPress={() => onAddToken()}
              isLoading={isAddingToken}
            >
              {t("addTokenScreen.addTokenButton")}
            </Button>
          </View>
        </View>
      );
    }

    // Unable to scan state - side by side with biometrics
    if (isUnableToScanToken) {
      return (
        <View className="flex-row justify-between gap-3">
          <View className="flex-1">
            <Button
              secondary
              xl
              isFullWidth
              onPress={onCancel}
              disabled={isAddingToken}
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
              onPress={() => {
                proceedAnywayAction?.();
              }}
              isLoading={isAddingToken}
              disabled={isAddingToken}
            >
              {t("common.continue")}
            </Button>
          </View>
        </View>
      );
    }

    // Malicious/Suspicious state - stacked layout with TextButton
    return (
      <View className="flex-col gap-3">
        <View className="w-full">
          <Button
            tertiary={isSuspicious}
            destructive={isMalicious}
            xl
            isFullWidth
            onPress={onCancel}
            disabled={isAddingToken}
          >
            {t("common.cancel")}
          </Button>
        </View>
        <View className="w-full">
          <TextButton
            text={t("addTokenScreen.approveAnyway")}
            biometric
            onPress={() => {
              proceedAnywayAction?.();
            }}
            isLoading={isAddingToken}
            disabled={isAddingToken}
            variant={isMalicious ? "error" : "secondary"}
          />
        </View>
      </View>
    );
  };

  const listItems = useMemo(() => {
    if (!token) return [];

    // If issuer is already a contract ID, use it directly
    // Otherwise, create an Asset and get its contract ID
    const tokenContractId = isContractId(token.issuer)
      ? token.issuer
      : new Asset(token.tokenCode, token.issuer).contractId(networkPassphrase);

    const items = [
      {
        icon: (
          <Icon.Wallet01 size={16} color={themeColors.foreground.primary} />
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
        icon: <Icon.Globe01 size={16} color={themeColors.foreground.primary} />,
        title: t("network"),
        trailingContent: (
          <Text md primary>
            {network === NETWORKS.PUBLIC
              ? NETWORK_NAMES.PUBLIC
              : NETWORK_NAMES.TESTNET}
          </Text>
        ),
        titleColor: themeColors.text.secondary,
      },
      {
        icon: <Icon.Circle size={16} color={themeColors.foreground.primary} />,
        title: t("addTokenScreen.tokenAddress"),
        trailingContent: (
          <TouchableOpacity
            onPress={() => {
              copyToClipboard(tokenContractId);
            }}
            className="flex-row items-center gap-2"
          >
            <View className="p-1">
              <Icon.Copy01 size={16} color={themeColors.foreground.primary} />
            </View>
            <Text md primary>
              {truncateAddress(tokenContractId)}
            </Text>
          </TouchableOpacity>
        ),
        titleColor: themeColors.text.secondary,
      },
    ];

    return items;
  }, [
    token,
    account?.publicKey,
    account?.accountName,
    network,
    networkPassphrase,
    themeColors.foreground.primary,
    themeColors.text.secondary,
    t,
    copyToClipboard,
  ]);

  if (!token) {
    return null;
  }

  return (
    <View className="flex-1 justify-center items-center mt-8">
      <View>
        <TokenIcon
          token={{
            type: token.tokenType as TokenTypeWithCustomToken,
            code: token.tokenCode,
            issuer: {
              key: token.issuer,
            },
          }}
        />
        {isMalicious && (
          <View className="absolute -bottom-1 -right-1 rounded-full p-1 z-10 bg-red-3">
            <Icon.AlertCircle size={12} themeColor="red" />
          </View>
        )}
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
        icon={<Icon.PlusCircle size={14} />}
        iconPosition={IconPosition.LEFT}
      >
        {t("addTokenScreen.addToken")}
      </Badge>

      {(isMalicious || isSuspicious || isUnableToScanToken) && (
        <Banner
          variant={isMalicious ? "error" : "warning"}
          text={(() => {
            if (isMalicious) return t("addTokenScreen.maliciousToken");
            if (isSuspicious) return t("addTokenScreen.suspiciousToken");
            return t("securityWarning.proceedWithCaution");
          })()}
          onPress={onSecurityWarningPress}
          className="mt-4"
        />
      )}

      <View className="px-[16px] py-[12px] mt-6 bg-background-tertiary rounded-[16px] justify-center">
        <Text md secondary regular textAlign="center">
          {t("addTokenScreen.disclaimer")}
        </Text>
      </View>

      <View className="w-full mt-6">
        <List items={listItems} variant="secondary" />
      </View>

      {!isMalicious && !isSuspicious && !isUnableToScanToken && (
        <View className="mt-4 px-6">
          <Text sm secondary textAlign="center">
            {t("addTokenScreen.confirmTrust")}
          </Text>
        </View>
      )}

      <View className="w-full mt-6">{renderButtons()}</View>
    </View>
  );
};

export default AddTokenBottomSheetContent;
