import { App } from "components/sds/App";
import Avatar from "components/sds/Avatar";
import { Badge } from "components/sds/Badge";
import { Button, IconPosition } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { ActiveAccount } from "ducks/auth";
import { SessionProposal } from "ducks/walletKit";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { View } from "react-native";

type DappConnectionBottomSheetContentProps = {
  sessionProposal: SessionProposal | null;
  account: ActiveAccount | null;
  onCancel: () => void;
  onConnection: () => void;
  isConnecting: boolean;
};

const DappConnectionBottomSheetContent: React.FC<
  DappConnectionBottomSheetContentProps
> = ({ sessionProposal, account, onCancel, onConnection, isConnecting }) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();

  if (!sessionProposal || !account) {
    return null;
  }

  // TODO: use URL class instead
  const dAppDomain = sessionProposal.proposer.metadata.url
    .split("://")[1]
    .split("/")[0];

  return (
    <View className="flex-1 justify-center items-center mt-2">
      <App
        size="lg"
        appName={sessionProposal.proposer.metadata.name}
        favicon={sessionProposal.proposer.metadata.icons[0]}
      />
      <View className="mt-4" />
      <Text lg primary medium style={{ textAlign: "center" }}>
        {sessionProposal.proposer.metadata.name}
      </Text>
      <View className="mt-1" />
      {dAppDomain && (
        <Text sm secondary>
          {dAppDomain}
        </Text>
      )}
      <View className="mt-2" />
      <Badge
        variant="secondary"
        size="md"
        icon={<Icon.Link01 size={16} />}
        iconPosition={IconPosition.LEFT}
      >
        {t("dappConnectionBottomSheetContent.connectionRequest")}
      </Badge>
      <View className="flex-row items-center mt-6 p-6 bg-background-tertiary rounded-xl justify-center">
        <Text md secondary style={{ textAlign: "center" }}>
          {t("dappConnectionBottomSheetContent.disclaimer")}
        </Text>
      </View>
      <View className="w-full flex-row items-center mt-6 px-6 py-4 bg-background-primary border border-border-primary rounded-xl justify-between">
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
      <View className="flex-row justify-between w-full mt-6 gap-3">
        <View className="flex-1">
          <Button
            secondary
            lg
            isFullWidth
            onPress={onCancel}
            disabled={isConnecting}
          >
            {t("common.cancel")}
          </Button>
        </View>
        <View className="flex-1">
          <Button
            tertiary
            lg
            isFullWidth
            onPress={onConnection}
            isLoading={isConnecting}
          >
            {t("dappConnectionBottomSheetContent.connect")}
          </Button>
        </View>
      </View>
    </View>
  );
};

export default DappConnectionBottomSheetContent;
