import Blockaid from "@blockaid/client";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { List } from "components/List";
import {
  SignTransactionDetailsButton,
  SignTransactionDetailsSheet,
} from "components/screens/SignTransactionDetails";
import { SignTransactionDetailsInterface } from "components/screens/SignTransactionDetails/types";
import { DappRequestBanners } from "components/screens/WalletKit/DappRequestBanners";
import { DappRequestButtons } from "components/screens/WalletKit/DappRequestButtons";
import { DappRequestUnreadableContent } from "components/screens/WalletKit/DappRequestUnreadableContent";
import { useDappHeader } from "components/screens/WalletKit/useDappHeader";
import { App } from "components/sds/App";
import Avatar from "components/sds/Avatar";
import { Badge, IconPosition } from "components/sds/Badge";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import { NATIVE_TOKEN_CODE, NetworkDetails } from "config/constants";
import { ActiveAccount } from "ducks/auth";
import { WalletKitSessionRequest } from "ducks/walletKit";
import { formatTokenForDisplay } from "helpers/formatAmount";
import { useTransactionBalanceListItems } from "hooks/blockaid/useTransactionBalanceListItems";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useMemo, useRef } from "react";
import { View } from "react-native";

interface DappSignTransactionBottomSheetContentProps {
  requestEvent: WalletKitSessionRequest | null;
  account: ActiveAccount | null;
  networkDetails: NetworkDetails;
  onCancelRequest: () => void;
  onConfirm: () => void;
  isSigning: boolean;
  isMalicious?: boolean;
  isSuspicious?: boolean;
  isUnableToScan?: boolean;
  transactionScanResult?: Blockaid.StellarTransactionScanResponse;
  securityWarningAction?: () => void;
  signTransactionDetails?: SignTransactionDetailsInterface | null;
  isMemoMissing?: boolean;
  isValidatingMemo?: boolean;
  onBannerPress?: () => void;
  /** The request's details can't be displayed, so it can only be rejected. */
  isUndisplayable?: boolean;
  /** Called when the transaction details throw while rendering. */
  onDetailsRenderError?: () => void;
}

const formatFeeAmount = (feeXlm?: string | number) => {
  if (!feeXlm) return "--";
  return formatTokenForDisplay(String(feeXlm), NATIVE_TOKEN_CODE);
};

/**
 * The request sheet's content for a transaction request (`stellar_signXDR` or
 * `stellar_signAndSubmitXDR`): the dApp, any banners, the balance changes, the
 * wallet, network, memo and fee, the transaction details and the request
 * buttons.
 *
 * A request whose details can't be displayed (`isUndisplayable`) fails closed
 * instead: it gets {@link DappRequestUnreadableContent}, with the same header
 * and only Cancel, which is disabled while an approval is in flight
 * (`isSigning`). A render error in the details is reported through
 * `onDetailsRenderError`, which is how the provider makes the request fail
 * closed.
 *
 * The details sheet sits in the same keyed slot in both layouts, so the switch
 * doesn't unmount it: a details sheet that is open when its render error fails
 * the request closed stays open, showing its own notice, until the user closes
 * it on the Cancel-only request.
 */
export const DappSignTransactionBottomSheetContent: React.FC<
  DappSignTransactionBottomSheetContentProps
> = ({
  requestEvent,
  account,
  networkDetails,
  onCancelRequest,
  onConfirm,
  isSigning,
  isMalicious,
  isSuspicious,
  isUnableToScan,
  transactionScanResult,
  securityWarningAction,
  signTransactionDetails,
  isMemoMissing,
  isValidatingMemo,
  onBannerPress,
  isUndisplayable,
  onDetailsRenderError,
}) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
  const detailsSheetModalRef = useRef<BottomSheetModal>(null);

  const memoValue = signTransactionDetails?.summary.memo?.value;

  const transactionBalanceListItems = useTransactionBalanceListItems(
    transactionScanResult,
    signTransactionDetails,
    account?.publicKey,
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
        icon: <Icon.Globe02 size={16} color={themeColors.foreground.primary} />,
        title: t("network"),
        trailingContent: (
          <Text md primary>
            {networkDetails.networkName}
          </Text>
        ),
        titleColor: themeColors.text.secondary,
      },
      ...(isMemoMissing || memoValue
        ? [
            {
              icon: (
                <Icon.Annotation
                  size={16}
                  color={themeColors.foreground.primary}
                />
              ),
              titleComponent: (
                <View className="flex-row items-center gap-[8px]">
                  <Text md secondary>
                    {t("transactionAmountScreen.details.memo")}
                  </Text>
                  {isMemoMissing && (
                    <Badge
                      variant="error"
                      icon={<Icon.AlertTriangle size={14} themeColor="red" />}
                      iconPosition={IconPosition.LEFT}
                    >
                      {t("common.required")}
                    </Badge>
                  )}
                </View>
              ),
              trailingContent: memoValue ? (
                <Text md primary>
                  {String(memoValue)}
                </Text>
              ) : (
                <Text md secondary>
                  {t("transactionAmountScreen.details.none")}
                </Text>
              ),
            },
          ]
        : []),
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
    [
      account,
      themeColors,
      t,
      networkDetails.networkName,
      signTransactionDetails?.summary.feeXlm,
      isMemoMissing,
      memoValue,
    ],
  );

  const header = useDappHeader(requestEvent, account);
  if (!header) return null;
  const { dAppName, dAppFavicon, dAppDomain } = header;

  const headerRow = (
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
  );

  const detailsSheet = signTransactionDetails ? (
    <SignTransactionDetailsSheet
      key="details-sheet"
      modalRef={detailsSheetModalRef}
      data={signTransactionDetails}
      analyticsEvent={AnalyticsEvent.VIEW_SIGN_DAPP_TRANSACTION_DETAILS}
      onRenderError={onDetailsRenderError}
    />
  ) : null;

  if (isUndisplayable) {
    return (
      <>
        <DappRequestUnreadableContent
          key="request"
          header={headerRow}
          onCancelRequest={onCancelRequest}
          isSigning={isSigning}
        />
        {detailsSheet}
      </>
    );
  }

  return (
    <>
      <View
        key="request"
        className="flex-1 justify-center mt-2 gap-[16px]"
        testID="dapp-request-bottom-sheet"
      >
        {headerRow}

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
            <SignTransactionDetailsButton
              onPress={() => detailsSheetModalRef.current?.present()}
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
          />
        </View>
      </View>
      {detailsSheet}
    </>
  );
};
