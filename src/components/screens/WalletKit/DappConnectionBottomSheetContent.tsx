import { List } from "components/List";
import { App } from "components/sds/App";
import Avatar from "components/sds/Avatar";
import { Badge } from "components/sds/Badge";
import { Banner } from "components/sds/Banner";
import { Button, IconPosition } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { TextButton } from "components/sds/TextButton";
import { Text } from "components/sds/Typography";
import { NETWORKS, NETWORK_NAMES } from "config/constants";
import { ActiveAccount, useAuthenticationStore } from "ducks/auth";
import { WalletKitSessionProposal } from "ducks/walletKit";
import useAppTranslation from "hooks/useAppTranslation";
import { useBiometrics } from "hooks/useBiometrics";
import useColors from "hooks/useColors";
import { useDappMetadata } from "hooks/useDappMetadata";
import React, { useMemo } from "react";
import { View } from "react-native";
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
  const { network, verifyActionWithBiometrics } = useAuthenticationStore();
  const { biometricButtonIcon } = useBiometrics();
  const dappMetadata = useDappMetadata(proposalEvent);

  const listItems = useMemo(() => {
    if (!dappMetadata || !account) return [];

    return [
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
    ];
  }, [
    dappMetadata,
    account,
    themeColors.foreground.primary,
    themeColors.text.secondary,
    t,
    network,
  ]);

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
          <TextButton
            text={t("dappConnectionBottomSheetContent.connectAnyway")}
            onPress={onConnection}
            isLoading={isConnecting}
            disabled={isConnecting}
            variant={isMalicious ? "error" : "secondary"}
          />
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
            icon={biometricButtonIcon}
            iconPosition={IconPosition.LEFT}
            isFullWidth
            onPress={() =>
              verifyActionWithBiometrics(() => {
                onConnection();
                return Promise.resolve();
              })
            }
            isLoading={isConnecting}
            disabled={isConnecting}
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
        <Banner
          variant={isMalicious ? "error" : "warning"}
          text={
            isMalicious
              ? t("dappConnectionBottomSheetContent.maliciousFlag")
              : t("dappConnectionBottomSheetContent.suspiciousFlag")
          }
          onPress={securityWarningAction}
        />
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
          {t("blockaid.security.site.confirmTrust")}
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
