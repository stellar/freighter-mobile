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
 * @property {boolean} isUnableToScan - Whether the site scan failed
 */
type DappConnectionBottomSheetContentProps = {
  proposalEvent: WalletKitSessionProposal | null;
  account: ActiveAccount | null;
  onCancel: () => void;
  onConnection: () => void;
  isConnecting: boolean;
  isMalicious?: boolean;
  isSuspicious?: boolean;
  isUnableToScan?: boolean;
  securityWarningAction?: () => void;
  proceedAnywayAction?: () => void;
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
  isUnableToScan,
  securityWarningAction,
  proceedAnywayAction,
}) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
  const { network } = useAuthenticationStore();
  const dappMetadata = useDappMetadata(proposalEvent);

  const getBannerText = useMemo(() => {
    if (isMalicious) {
      return t("dappConnectionBottomSheetContent.maliciousFlag");
    }
    if (isSuspicious) {
      return t("dappConnectionBottomSheetContent.suspiciousFlag");
    }
    if (isUnableToScan) {
      return t("securityWarning.proceedWithCaution");
    }
    return "";
  }, [isMalicious, isSuspicious, isUnableToScan, t]);

  const getBannerVariant = useMemo(() => {
    if (isMalicious) {
      return "error" as const;
    }
    return "warning" as const;
  }, [isMalicious]);

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
              hasDarkBackground
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
    // Normal state - side by side with biometrics
    if (!isMalicious && !isSuspicious && !isUnableToScan) {
      return (
        <View className="flex-row justify-between gap-3">
          <View className="flex-1">
            <Button
              secondary
              xl
              isFullWidth
              onPress={handleUserCancel}
              disabled={isConnecting}
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
              onPress={() => onConnection()}
              isLoading={isConnecting}
              disabled={isConnecting}
            >
              {t("dappConnectionBottomSheetContent.connect")}
            </Button>
          </View>
        </View>
      );
    }

    if (isUnableToScan) {
      return (
        <View className="flex-row justify-between gap-3">
          <View className="flex-1">
            <Button
              secondary
              xl
              isFullWidth
              onPress={handleUserCancel}
              disabled={isConnecting}
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
              isLoading={isConnecting}
              disabled={isConnecting}
            >
              {t("common.continue")}
            </Button>
          </View>
        </View>
      );
    }

    return (
      <View className="flex-col gap-3">
        <View className="w-full">
          <Button
            tertiary={isSuspicious}
            destructive={isMalicious}
            xl
            isFullWidth
            onPress={handleUserCancel}
            disabled={isConnecting}
          >
            {t("common.cancel")}
          </Button>
        </View>
        <View className="w-full">
          <TextButton
            text={t("dappConnectionBottomSheetContent.connectAnyway")}
            onPress={onConnection}
            isLoading={isConnecting}
            disabled={isConnecting}
            variant={isMalicious ? "error" : "secondary"}
          />
        </View>
      </View>
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

      {(isMalicious || isSuspicious || isUnableToScan) && (
        <Banner
          variant={getBannerVariant}
          text={getBannerText}
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

      {!isMalicious && !isSuspicious && !isUnableToScan && (
        <Text sm secondary textAlign="center">
          {t("blockaid.security.site.confirmTrust")}
        </Text>
      )}

      <View className="w-full">{renderButtons()}</View>
    </View>
  );
};

export default DappConnectionBottomSheetContent;
