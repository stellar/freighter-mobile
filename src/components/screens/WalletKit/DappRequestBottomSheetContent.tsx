import Blockaid from "@blockaid/client";
import { List } from "components/List";
import { TokenIcon } from "components/TokenIcon";
import SignTransactionDetails from "components/screens/SignTransactionDetails";
import { SignTransactionDetailsInterface } from "components/screens/SignTransactionDetails/types";
import { App } from "components/sds/App";
import Avatar from "components/sds/Avatar";
import { Banner } from "components/sds/Banner";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { TextButton } from "components/sds/TextButton";
import { Text } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { ActiveAccount } from "ducks/auth";
import { WalletKitSessionRequest } from "ducks/walletKit";
import { formatTokenAmount } from "helpers/formatAmount";
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
  transactionScanResult?: Blockaid.StellarTransactionScanResponse;
  securityWarningAction?: () => void;
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
  transactionScanResult,
  securityWarningAction,
  signTransactionDetails,
  isMemoMissing,
  isValidatingMemo,
  onBannerPress,
}) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
  const transactionBalanceListItems = useTransactionBalanceListItems(
    transactionScanResult,
  );

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
        icon: <Icon.Route size={16} color={themeColors.foreground.primary} />,
        title: t("transactionAmountScreen.details.fee"),
        trailingContent: (
          <View className="flex-row items-center gap-2">
            <Text md primary>
              {formatTokenAmount(
                String(signTransactionDetails?.summary.feeXlm ?? "0"),
                NATIVE_TOKEN_CODE,
              )}
            </Text>
          </View>
        ),
        titleColor: themeColors.text.secondary,
      },
    ],
    [account, themeColors, t, signTransactionDetails?.summary.feeXlm],
  );

  const changeTrustTokenList = useMemo(() => {
    const changeTrustOp = signTransactionDetails?.operations.find(
      (op) => op.type === "changeTrust",
    ) as
      | { type: "changeTrust"; line?: { code?: string; issuer?: string } }
      | undefined;

    const assetCode = changeTrustOp?.line?.code;
    const issuerKey = changeTrustOp?.line?.issuer;

    if (!assetCode || !issuerKey) {
      return [] as { key?: string; icon: React.ReactNode; title: string }[];
    }

    const token = { code: assetCode, issuer: { key: issuerKey } } as never;

    return [
      {
        key: `${assetCode}:${issuerKey}`,
        icon: <TokenIcon token={token} size="sm" />,
        title: assetCode,
        trailingContent: (
          <View className="flex-row items-center gap-2">
            <Icon.PlusCircle size={14} themeColor="gray" />
            <Text>{t("addTokenScreen.addToken")}</Text>
          </View>
        ),
      },
    ];
  }, [signTransactionDetails?.operations, t]);

  const dappMetadata = useDappMetadata(requestEvent);

  const sessionRequest = requestEvent?.params;

  if (!dappMetadata || !account || !sessionRequest) {
    return null;
  }

  const dAppDomain = dappMetadata.url?.split("://")?.[1]?.split("/")?.[0];
  const dAppName = dappMetadata.name;
  const dAppFavicon = dappMetadata.icons[0];

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
          onPress={onCancelRequest}
          disabled={isSigning}
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
            text={t("dappRequestBottomSheetContent.confirmAnyway")}
            onPress={onConfirm}
            isLoading={isSigning}
            disabled={isSigning}
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
            isFullWidth
            onPress={onConfirm}
            isLoading={isSigning || !!isValidatingMemo}
            disabled={!!isMemoMissing || isSigning || !!isValidatingMemo}
          >
            {t("dappRequestBottomSheetContent.confirm")}
          </Button>
        </View>
      </>
    );
  };

  return (
    <View className="flex-1 justify-center mt-2 gap-[16px]">
      <View className="flex-row items-center gap-[12px] w-full">
        <App size="lg" appName={dAppName} favicon={dAppFavicon} />
        <View className="ml-2">
          <Text md primary>
            {t("dappRequestBottomSheetContent.confirmTransaction")}
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
      <View className="gap-[12px]">
        {changeTrustTokenList.length > 0 ? (
          <List variant="secondary" items={changeTrustTokenList} />
        ) : (
          <List variant="secondary" items={transactionBalanceListItems} />
        )}
        <List variant="secondary" items={accountDetailList} />
        {signTransactionDetails && (
          <SignTransactionDetails data={signTransactionDetails} />
        )}
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

export default DappRequestBottomSheetContent;
