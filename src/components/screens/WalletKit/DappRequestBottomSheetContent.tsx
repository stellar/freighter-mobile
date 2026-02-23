import Blockaid from "@blockaid/client";
import { List } from "components/List";
import SignTransactionDetails from "components/screens/SignTransactionDetails";
import { SignTransactionDetailsInterface } from "components/screens/SignTransactionDetails/types";
import { MessageDisplay } from "components/screens/WalletKit/MessageDisplay";
import { App } from "components/sds/App";
import Avatar from "components/sds/Avatar";
import { Banner } from "components/sds/Banner";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { TextButton } from "components/sds/TextButton";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { logger } from "config/logger";
import { ActiveAccount } from "ducks/auth";
import { useProtocolsStore } from "ducks/protocols";
import {
  StellarRpcMethods,
  WalletKitSessionRequest,
  StellarSignMessageParams,
} from "ducks/walletKit";
import { formatTokenForDisplay } from "helpers/formatAmount";
import { findMatchedProtocol, getDisplayHost } from "helpers/protocols";
import { useTransactionBalanceListItems } from "hooks/blockaid/useTransactionBalanceListItems";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import { useDappMetadata } from "hooks/useDappMetadata";
import React, { useMemo } from "react";
import { View } from "react-native";

/**
 * Props for the DappRequestBottomSheetContent component
 * @interface DappRequestBottomSheetContentProps
 * @property {WalletKitSessionRequest | null} requestEvent - The session request event
 * @property {ActiveAccount | null} account - The active account
 * @property {() => void} onCancelRequest - Function to handle cancellation
 * @property {() => void} onConfirm - Function to handle confirmation
 * @property {boolean} isSigning - Whether a transaction is currently being signed
 * @property {boolean} isMalicious - Whether the transaction is malicious
 * @property {boolean} isSuspicious - Whether the transaction is suspicious
 * @property {boolean} isUnableToScan - Whether the transaction scan failed
 * @property {ListItemProps[]} transactionBalanceListItems - The list of transaction balance items
 * @property {() => void} securityWarningAction - Function to handle security warning
 * @property {SignTransactionDetailsInterface} signTransactionDetails - The sign transaction details
 * @property {boolean} isMemoMissing - Whether a required memo is missing
 * @property {boolean} isValidatingMemo - Whether memo validation is in progress
 * @property {() => void} onBannerPress - Function to handle memo warning banner press
 */
interface DappRequestBottomSheetContentProps {
  requestEvent: WalletKitSessionRequest | null;
  account: ActiveAccount | null;
  onCancelRequest: () => void;
  onConfirm: () => void;
  isSigning: boolean;
  isMalicious?: boolean;
  isSuspicious?: boolean;
  isUnableToScan?: boolean;
  transactionScanResult?: Blockaid.StellarTransactionScanResponse;
  securityWarningAction?: () => void;
  proceedAnywayAction?: () => void;
  signTransactionDetails?: SignTransactionDetailsInterface | null;
  isMemoMissing?: boolean;
  isValidatingMemo?: boolean;
  onBannerPress?: () => void;
}

/**
 * Bottom sheet content component for displaying and handling dApp transaction requests.
 * Shows transaction details and provides options to confirm or cancel the request.
 *
 * @component
 * @param {DappRequestBottomSheetContentProps} props - The component props
 * @returns {JSX.Element | null} The bottom sheet content component or null if required data is missing
 */
const DappRequestBottomSheetContent: React.FC<
  DappRequestBottomSheetContentProps
> = ({
  requestEvent,
  account,
  onCancelRequest,
  onConfirm,
  isSigning,
  isMalicious,
  isSuspicious,
  isUnableToScan,
  transactionScanResult,
  securityWarningAction,
  proceedAnywayAction,
  signTransactionDetails,
  isMemoMissing,
  isValidatingMemo,
  onBannerPress,
}) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
  const { protocols } = useProtocolsStore();

  const transactionBalanceListItems = useTransactionBalanceListItems(
    transactionScanResult,
    signTransactionDetails,
  );

  const bannerText = useMemo(() => {
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

  const bannerVariant = useMemo(() => {
    if (isMalicious) {
      return "error" as const;
    }
    return "warning" as const;
  }, [isMalicious]);

  const formatFeeAmount = (feeXlm?: string | number) => {
    if (!feeXlm) return "--";

    return formatTokenForDisplay(String(feeXlm), NATIVE_TOKEN_CODE);
  };

  const sessionRequest = requestEvent?.params;
  const requestMethod = sessionRequest?.request?.method as StellarRpcMethods;
  const requestParams = sessionRequest?.request?.params;
  const isSignMessage = requestMethod === StellarRpcMethods.SIGN_MESSAGE;
  const messageToSign = isSignMessage
    ? (requestParams as StellarSignMessageParams)?.message
    : undefined;

  const accountDetailList = useMemo(
    () => [
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
      // Only show fee for transaction signing, not message signing
      ...(!isSignMessage
        ? [
            {
              icon: (
                <Icon.Route size={16} color={themeColors.foreground.primary} />
              ),
              title: t("transactionAmountScreen.details.fee"),
              trailingContent: (
                <View className="flex-row items-center gap-2">
                  <Text md primary>
                    {formatFeeAmount(signTransactionDetails?.summary.feeXlm)}
                  </Text>
                </View>
              ),
              titleColor: themeColors.text.secondary,
            },
          ]
        : []),
    ],
    [
      account,
      themeColors,
      t,
      signTransactionDetails?.summary.feeXlm,
      isSignMessage,
    ],
  );

  const dappMetadata = useDappMetadata(requestEvent);
  const requestOrigin = requestEvent?.verifyContext?.verified?.origin;

  // Log warning if origin is missing for security audit
  if (!requestOrigin && requestEvent) {
    logger.warn("DappRequestBottomSheetContent", "Missing verified origin", {
      hasVerifyContext: !!requestEvent.verifyContext,
      hasVerified: !!requestEvent.verifyContext?.verified,
    });
  }

  const matchedProtocol = useMemo(
    () =>
      findMatchedProtocol({
        protocols,
        searchUrl: requestOrigin || "",
      }),
    [protocols, requestOrigin],
  );

  if (!dappMetadata || !account || !sessionRequest) {
    logger.warn("DappRequestBottomSheetContent", "Missing required data", {
      hasDappMetadata: !!dappMetadata,
      hasAccount: !!account,
      hasSessionRequest: !!sessionRequest,
    });
    return null;
  }

  const dAppDomain = getDisplayHost(requestOrigin || dappMetadata?.url || "");
  const dAppName = matchedProtocol?.name ?? dappMetadata.name;
  const dAppFavicon = matchedProtocol?.iconUrl ?? dappMetadata.icons[0];

  const renderButtons = () => {
    if (!isMalicious && !isSuspicious && !isUnableToScan) {
      return (
        <View className="flex-row justify-between gap-3">
          <View className="flex-1">
            <Button
              secondary
              xl
              isFullWidth
              onPress={onCancelRequest}
              disabled={isSigning || !!isValidatingMemo}
              testID="dapp-request-cancel-button"
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
              onPress={() => onConfirm?.()}
              isLoading={isSigning || !!isValidatingMemo}
              disabled={!!isMemoMissing || isSigning || !!isValidatingMemo}
              testID="dapp-request-confirm-button"
            >
              {t("dappRequestBottomSheetContent.confirm")}
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
              onPress={onCancelRequest}
              disabled={isSigning || !!isValidatingMemo}
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
              isLoading={isSigning || !!isValidatingMemo}
              disabled={!!isMemoMissing || isSigning || !!isValidatingMemo}
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
            onPress={onCancelRequest}
            disabled={isSigning}
          >
            {t("common.cancel")}
          </Button>
        </View>
        <View className="w-full">
          <TextButton
            text={t("dappRequestBottomSheetContent.confirmAnyway")}
            biometric
            onPress={() => {
              onConfirm?.();
            }}
            isLoading={isSigning}
            disabled={isSigning}
            variant={isMalicious ? "error" : "secondary"}
          />
        </View>
      </View>
    );
  };

  return (
    <View
      className="flex-1 justify-center mt-2 gap-[16px]"
      testID="dapp-request-bottom-sheet"
    >
      <View className="flex-row items-center gap-[12px] w-full">
        <App size="lg" appName={dAppName} favicon={dAppFavicon} />
        <View className="ml-2">
          <Text
            md
            primary
            testID={
              isSignMessage ? "sign-message-title" : "sign-transaction-title"
            }
          >
            {isSignMessage
              ? t("dappRequestBottomSheetContent.signMessage")
              : t("dappRequestBottomSheetContent.confirmTransaction")}
          </Text>
          {dAppDomain && (
            <Text sm secondary>
              {dAppDomain}
            </Text>
          )}
        </View>
      </View>
      {isMemoMissing && (
        <Banner
          variant="error"
          text={t("transactionAmountScreen.errors.memoMissing")}
          onPress={onBannerPress}
        />
      )}
      {(isMalicious || isSuspicious || isUnableToScan) && (
        <Banner
          variant={bannerVariant}
          text={bannerText}
          onPress={securityWarningAction}
        />
      )}
      <View className="gap-[12px]">
        {isSignMessage && messageToSign ? (
          <>
            <MessageDisplay message={messageToSign} />
            <List variant="secondary" items={accountDetailList} />
          </>
        ) : (
          <>
            <List variant="secondary" items={transactionBalanceListItems} />
            <List variant="secondary" items={accountDetailList} />
            {signTransactionDetails && (
              <SignTransactionDetails
                data={signTransactionDetails}
                analyticsEvent={
                  AnalyticsEvent.VIEW_SIGN_DAPP_TRANSACTION_DETAILS
                }
              />
            )}
          </>
        )}
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

export default DappRequestBottomSheetContent;
