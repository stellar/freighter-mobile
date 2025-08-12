import { List, ListItemProps } from "components/List";
import { App } from "components/sds/App";
import Avatar from "components/sds/Avatar";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { ActiveAccount } from "ducks/auth";
import { WalletKitSessionRequest } from "ducks/walletKit";
import { pxValue } from "helpers/dimensions";
import { formatAssetAmount, stroopToXlm } from "helpers/formatAmount";
import { useTransactionDetailsParser } from "hooks/blockaid/useTransactionDetailsParser";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import { useDappMetadata } from "hooks/useDappMetadata";
import React, { useMemo } from "react";
import { TouchableOpacity, View } from "react-native";

/**
 * Props for the DappRequestBottomSheetContent component
 * @interface DappRequestBottomSheetContentProps
 * @property {WalletKitSessionRequest | null} requestEvent - The session request event
 * @property {ActiveAccount | null} account - The active account
 * @property {() => void} onCancel - Function to handle cancellation
 * @property {() => void} onConfirm - Function to handle confirmation
 * @property {boolean} isSigning - Whether a transaction is currently being signed
 * @property {boolean} isMalicious - Whether the transaction is malicious
 * @property {boolean} isSuspicious - Whether the transaction is suspicious
 * @property {ListItemProps[]} transactionBalanceListItems - The list of transaction balance items
 */
type DappRequestBottomSheetContentProps = {
  requestEvent: WalletKitSessionRequest | null;
  account: ActiveAccount | null;
  onCancel: () => void;
  onConfirm: () => void;
  isSigning: boolean;
  isMalicious?: boolean;
  isSuspicious?: boolean;
  transactionBalanceListItems?: ListItemProps[];
};

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
> = ({ requestEvent, account, onCancel, onConfirm, isSigning, isMalicious, isSuspicious, transactionBalanceListItems }) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
  const { copyToClipboard } = useClipboard();
  const { transactionDetails } = useTransactionDetailsParser({ requestEvent });
  const accountDetailList = useMemo(() => 
    [
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
        icon: <Icon.Route size={16} color={themeColors.foreground.primary} />,
        title: t("transactionAmountScreen.details.fee"),
        trailingContent: (
          <View className="flex-row items-center gap-2">
            <Text md primary>
              {formatAssetAmount(String(transactionDetails?.fee) ?? "0", NATIVE_TOKEN_CODE)}
            </Text>
          </View>
        ),
        titleColor: themeColors.text.secondary,
      }
    ], 
  [account, themeColors, t]);

  const dappMetadata = useDappMetadata(requestEvent);

  const sessionRequest = requestEvent?.params;

  if (!dappMetadata || !account || !sessionRequest) {
    return null;
  }

  const { request } = sessionRequest;
  const { params } = request;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const xdr = params?.xdr as string;

  const dAppDomain = dappMetadata.url?.split("://")?.[1]?.split("/")?.[0];
  const dAppName = dappMetadata.name;
  const dAppFavicon = dappMetadata.icons[0];

  const handleCopy = (item: string, itemName: string) => {
    copyToClipboard(item, {
      notificationMessage: t("dappRequestBottomSheetContent.itemCopied", {
        itemName,
      }),
    });
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
      <View className="gap-[12px]">
        <List variant="secondary" items={transactionBalanceListItems || []} />
        <List variant="secondary" items={accountDetailList} />
        <TouchableOpacity className="flex-row items-center gap-[8px] rounded-[16px] bg-background-tertiary px-[16px] py-[12px]" onPress={() => {}}>
          <Icon.List size={16} themeColor="lilac" />
          <Text color={themeColors.lilac[11]}>
            {t("dappRequestBottomSheetContent.transactionDetails")}
          </Text>
        </TouchableOpacity>
      </View>
      <View className="items-center">
        <Text sm secondary>{t("blockaid.security.site.confirmTrust")}</Text>
      </View>
      <View className="flex-row justify-between w-full gap-3">
        <View className="flex-1">
          <Button
            secondary
            xl
            isFullWidth
            onPress={onCancel}
            disabled={isSigning}
          >
            {t("dappRequestBottomSheetContent.cancel")}
          </Button>
        </View>
        <View className="flex-1">
          <Button
            tertiary
            xl
            isFullWidth
            onPress={onConfirm}
            isLoading={isSigning}
          >
            {t("dappRequestBottomSheetContent.confirm")}
          </Button>
        </View>
      </View>
    </View>
  );
};

export default DappRequestBottomSheetContent;
