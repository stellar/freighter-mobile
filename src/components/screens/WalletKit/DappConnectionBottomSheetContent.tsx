import { List } from "components/List";
import Spinner from "components/Spinner";
import { App } from "components/sds/App";
import Avatar from "components/sds/Avatar";
import { Badge } from "components/sds/Badge";
import { Button, IconPosition } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { NETWORKS } from "config/constants";
import { ActiveAccount, useAuthenticationStore } from "ducks/auth";
import { WalletKitSessionProposal } from "ducks/walletKit";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import { useDappMetadata } from "hooks/useDappMetadata";
import React from "react";
import { TouchableOpacity, View } from "react-native";
import { analytics } from "services/analytics";

/**
 * Props for the DappConnectionBottomSheetContent component
 * @interface DappConnectionBottomSheetContentProps
 * @property {WalletKitSessionProposal | null} proposalEvent - The session proposal event
 * @property {ActiveAccount | null} account - The active account
 * @property {() => void} onCancel - Function to handle cancellation
 * @property {() => void} onConnection - Function to handle connection
 * @property {boolean} isConnecting - Whether a connection is currently being established
 * @property {boolean} isMalicious - Whether the dApp is malicious
 * @property {boolean} isSuspicious - Whether the dApp is suspicious
 */
type DappConnectionBottomSheetContentProps = {
  proposalEvent: WalletKitSessionProposal | null;
  account: ActiveAccount | null;
  onCancel: () => void;
  onConnection: () => void;
  isConnecting: boolean;
  isMalicious?: boolean;
  isSuspicious?: boolean;
  securityWarningAction?: () => void;
};

/**
 * Bottom sheet content component for displaying and handling dApp connection requests.
 * Shows dApp details and provides options to connect or cancel the request.
 *
 * @component
 * @param {DappConnectionBottomSheetContentProps} props - The component props
 * @returns {JSX.Element | null} The bottom sheet content component or null if required data is missing
 */
const DappConnectionBottomSheetContent: React.FC<
  DappConnectionBottomSheetContentProps
> = ({
  proposalEvent,
  account,
  onCancel,
  onConnection,
  isConnecting,
  isMalicious,
  isSuspicious,
  securityWarningAction,
}) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
  const { network } = useAuthenticationStore();
  const dappMetadata = useDappMetadata(proposalEvent);

  if (!dappMetadata || !account) {
    return null;
  }

  const dappDomain = dappMetadata.url?.split("://")?.[1]?.split("/")?.[0];

  const handleUserCancel = () => {
    if (proposalEvent) {
      analytics.trackGrantAccessFail(
        proposalEvent.params.proposer.metadata.url,
        "user_rejected",
      );
    }

    onCancel();
  };

  const listItems = [
    {
      icon: <Icon.Wallet01 size={16} color={themeColors.foreground.primary} />,
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
          {network === NETWORKS.PUBLIC ? t("mainnet") : t("testnet")}
        </Text>
      ),
      titleColor: themeColors.text.secondary,
    },
  ];

  const renderButtons = () => {
    const cancelButton = (
      <View
        className={`${!isMalicious && !isSuspicious ? "flex-1" : "w-full"}`}
      >
        <Button
          tertiary={isSuspicious}
          destructive={isMalicious}
          secondary={!isMalicious && !isSuspicious}
          xl
          isFullWidth
          onPress={handleUserCancel}
          disabled={isConnecting}
        >
          {t("common.cancel")}
        </Button>
      </View>
    );

    if (isMalicious || isSuspicious) {
      return (
        <>
          {cancelButton}
          <TouchableOpacity
            onPress={onConnection}
            disabled={isConnecting}
            className="w-full justify-center items-center"
          >
            {isConnecting ? (
              <Spinner size="small" />
            ) : (
              <Text
                md
                semiBold
                color={
                  isMalicious ? themeColors.red[11] : themeColors.text.secondary
                }
              >
                {t("dappConnectionBottomSheetContent.connectAnyway")}
              </Text>
            )}
          </TouchableOpacity>
        </>
      );
    }

    return (
      <>
        {cancelButton}
        <View className="flex-1">
          <Button
            tertiary
            xl
            isFullWidth
            onPress={onConnection}
            isLoading={isConnecting}
          >
            {t("dappConnectionBottomSheetContent.connect")}
          </Button>
        </View>
      </>
    );
  };

  return (
    <View className="flex-1 justify-center items-center mt-2 gap-[16px]">
      <View className="gap-[16px] justify-center items-center">
        <App
          size="lg"
          appName={dappMetadata.name}
          favicon={dappMetadata.icons[0]}
        />

        <View className="justify-center items-center">
          <Text lg primary medium textAlign="center">
            {dappMetadata.name}
          </Text>
          {dappDomain && (
            <Text sm secondary>
              {dappDomain}
            </Text>
          )}
        </View>

        <Badge
          variant="secondary"
          size="md"
          icon={<Icon.Link01 size={14} />}
          iconPosition={IconPosition.LEFT}
        >
          {t("dappConnectionBottomSheetContent.connectionRequest")}
        </Badge>
      </View>

      {(isMalicious || isSuspicious) && (
        <TouchableOpacity
          onPress={securityWarningAction}
          className={`px-[16px] py-[12px] rounded-[16px] w-full ${isMalicious ? "bg-red-3" : "bg-amber-3"}`}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1 gap-[8px]">
              <Icon.AlertSquare
                size={16}
                themeColor={isMalicious ? "red" : "amber"}
              />
              <Text
                sm
                color={
                  isMalicious ? themeColors.red[11] : themeColors.amber[11]
                }
              >
                {isMalicious
                  ? t("dappConnectionBottomSheetContent.maliciousFlag")
                  : t("dappConnectionBottomSheetContent.suspiciousFlag")}
              </Text>
            </View>

            <Icon.ChevronRight
              size={16}
              themeColor={isMalicious ? "red" : "amber"}
            />
          </View>
        </TouchableOpacity>
      )}

      <View className="flex-row items-center px-[16px] py-[12px] bg-background-tertiary rounded-[16px] justify-center">
        <Text md secondary textAlign="center">
          {t("dappConnectionBottomSheetContent.disclaimer")}
        </Text>
      </View>

      <View className="w-full">
        <List items={listItems} variant="secondary" />
      </View>

      {!isMalicious && !isSuspicious && (
        <Text sm secondary textAlign="center">
          {t("addAssetScreen.confirmTrust")}
        </Text>
      )}

      <View
        className={`${!isMalicious && !isSuspicious ? "flex-row" : "flex-col"} w-full gap-[12px]`}
      >
        {renderButtons()}
      </View>
    </View>
  );
};

export default DappConnectionBottomSheetContent;
