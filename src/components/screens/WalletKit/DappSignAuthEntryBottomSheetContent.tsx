import { List } from "components/List";
import DappAuthEntryDetails from "components/screens/WalletKit/DappAuthEntryDetails";
import { DappRequestBanners } from "components/screens/WalletKit/DappRequestBanners";
import { DappRequestButtons } from "components/screens/WalletKit/DappRequestButtons";
import { useDappHeader } from "components/screens/WalletKit/useDappHeader";
import { App } from "components/sds/App";
import Avatar from "components/sds/Avatar";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { NetworkDetails } from "config/constants";
import { ActiveAccount } from "ducks/auth";
import { WalletKitSessionRequest } from "ducks/walletKit";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import React, { useMemo } from "react";
import { Dimensions, ScrollView, View } from "react-native";

interface DappSignAuthEntryBottomSheetContentProps {
  requestEvent: WalletKitSessionRequest | null;
  account: ActiveAccount | null;
  networkDetails: NetworkDetails;
  entryXdr: string;
  onCancelRequest: () => void;
  onConfirm: () => void;
  isSigning: boolean;
  isMalicious?: boolean;
  isSuspicious?: boolean;
  isUnableToScan?: boolean;
  securityWarningAction?: () => void;
  proceedAnywayAction?: () => void;
}

export const DappSignAuthEntryBottomSheetContent: React.FC<
  DappSignAuthEntryBottomSheetContentProps
> = ({
  requestEvent,
  account,
  networkDetails,
  entryXdr,
  onCancelRequest,
  onConfirm,
  isSigning,
  isMalicious,
  isSuspicious,
  isUnableToScan,
  securityWarningAction,
  proceedAnywayAction,
}) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
  const { copyToClipboard } = useClipboard();

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
    ],
    [account, themeColors, t, networkDetails.networkName],
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
          <Text md primary testID="sign-auth-entry-title">
            {t("dappRequestBottomSheetContent.signAuthEntry")}
          </Text>
          {dAppDomain && (
            <Text sm secondary>
              {dAppDomain}
            </Text>
          )}
        </View>
      </View>

      <DappRequestBanners
        isMalicious={isMalicious}
        isSuspicious={isSuspicious}
        isUnableToScan={isUnableToScan}
        securityWarningAction={securityWarningAction}
      />

      <View className="gap-[12px]">
        <View
          className="rounded-[16px] p-[16px] gap-[12px]"
          style={{ backgroundColor: themeColors.background.secondary }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-[8px]">
              <Icon.Key01 size={16} color={themeColors.text.secondary} />
              <Text sm secondary>
                {t("signTransactionDetails.authorizations.title")}
              </Text>
            </View>
            <Icon.Copy01
              size={14}
              themeColor="gray"
              onPress={() => copyToClipboard(entryXdr)}
            />
          </View>
          <ScrollView
            style={{
              maxHeight: Dimensions.get("window").height * 0.2,
            }}
            showsVerticalScrollIndicator={false}
          >
            <Text
              sm
              primary
              style={{ fontFamily: "monospace" }}
              testID="auth-entry-xdr"
            >
              {entryXdr}
            </Text>
          </ScrollView>
        </View>
        <List variant="secondary" items={accountList} />
        <DappAuthEntryDetails
          entryXdr={entryXdr}
          isMalicious={isMalicious}
          isSuspicious={isSuspicious}
          isUnableToScan={isUnableToScan}
          securityWarningAction={securityWarningAction}
        />
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
          onCancelRequest={onCancelRequest}
          onConfirm={onConfirm}
          proceedAnywayAction={proceedAnywayAction}
        />
      </View>
    </View>
  );
};
