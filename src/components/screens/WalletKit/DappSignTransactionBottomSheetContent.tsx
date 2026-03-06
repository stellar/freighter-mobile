import Blockaid from "@blockaid/client";
import { List } from "components/List";
import SignTransactionDetails from "components/screens/SignTransactionDetails";
import { SignTransactionDetailsInterface } from "components/screens/SignTransactionDetails/types";
import { DappRequestBanners } from "components/screens/WalletKit/DappRequestBanners";
import { DappRequestButtons } from "components/screens/WalletKit/DappRequestButtons";
import { useDappHeader } from "components/screens/WalletKit/useDappHeader";
import { App } from "components/sds/App";
import Avatar from "components/sds/Avatar";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { ActiveAccount } from "ducks/auth";
import { WalletKitSessionRequest } from "ducks/walletKit";
import { formatTokenForDisplay } from "helpers/formatAmount";
import { useTransactionBalanceListItems } from "hooks/blockaid/useTransactionBalanceListItems";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useMemo } from "react";
import { View } from "react-native";

interface DappSignTransactionBottomSheetContentProps {
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

const formatFeeAmount = (feeXlm?: string | number) => {
  if (!feeXlm) return "--";
  return formatTokenForDisplay(String(feeXlm), NATIVE_TOKEN_CODE);
};

export const DappSignTransactionBottomSheetContent: React.FC<
  DappSignTransactionBottomSheetContentProps
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

  const transactionBalanceListItems = useTransactionBalanceListItems(
    transactionScanResult,
    signTransactionDetails,
  );

  const accountList = useMemo(
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
      {
        icon: <Icon.Route size={16} color={themeColors.foreground.primary} />,
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
    ],
    [account, themeColors, t, signTransactionDetails?.summary.feeXlm],
  );

  const header = useDappHeader(requestEvent, account);
  if (!header) return null;
  const { dAppName, dAppFavicon, dAppDomain } = header;

  return (
    <View
      className="flex-1 justify-center mt-2 gap-[16px]"
      testID="dapp-request-bottom-sheet"
    >
      <View className="flex-row items-center gap-[12px] w-full">
        <App size="lg" appName={dAppName} favicon={dAppFavicon} />
        <View className="ml-2">
          <Text md primary testID="sign-transaction-title">
            {t("dappRequestBottomSheetContent.confirmTransaction")}
          </Text>
          {dAppDomain && (
            <Text sm secondary>
              {dAppDomain}
            </Text>
          )}
        </View>
      </View>

      <DappRequestBanners
        isMemoMissing={isMemoMissing}
        onBannerPress={onBannerPress}
        isMalicious={isMalicious}
        isSuspicious={isSuspicious}
        isUnableToScan={isUnableToScan}
        securityWarningAction={securityWarningAction}
      />

      <View className="gap-[12px]">
        <List variant="secondary" items={transactionBalanceListItems} />
        <List variant="secondary" items={accountList} />
        {signTransactionDetails && (
          <SignTransactionDetails
            data={signTransactionDetails}
            analyticsEvent={AnalyticsEvent.VIEW_SIGN_DAPP_TRANSACTION_DETAILS}
          />
        )}
      </View>

      {!isMalicious && !isSuspicious && !isUnableToScan && (
        <Text sm secondary textAlign="center">
          {t("blockaid.security.site.confirmTrust")}
        </Text>
      )}

      <View className="w-full">
        <DappRequestButtons
          isMalicious={isMalicious}
          isSuspicious={isSuspicious}
          isUnableToScan={isUnableToScan}
          isSigning={isSigning}
          isValidatingMemo={isValidatingMemo}
          isMemoMissing={isMemoMissing}
          onCancelRequest={onCancelRequest}
          onConfirm={onConfirm}
          proceedAnywayAction={proceedAnywayAction}
        />
      </View>
    </View>
  );
};
