import { BottomSheetModal } from "@gorhom/bottom-sheet";
import AddMemoExplanationBottomSheet from "components/AddMemoExplanationBottomSheet";
import BottomSheet from "components/BottomSheet";
import { RequiredMemoMissingWarning } from "components/RequiredMemoMissingWarning";
import { App } from "components/sds/App";
import Avatar from "components/sds/Avatar";
import { Badge } from "components/sds/Badge";
import { Button, IconPosition } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { ActiveAccount } from "ducks/auth";
import { WalletKitSessionRequest } from "ducks/walletKit";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import { useDappMetadata } from "hooks/useDappMetadata";
import React, { useRef } from "react";
import { TouchableOpacity, View } from "react-native";

/**
 * Props for the DappRequestBottomSheetContent component
 * @interface DappRequestBottomSheetContentProps
 * @property {WalletKitSessionRequest | null} requestEvent - The session request event
 * @property {ActiveAccount | null} account - The active account
 * @property {() => void} onCancel - Function to handle cancellation
 * @property {() => void} onConfirm - Function to handle confirmation
 * @property {boolean} isSigning - Whether a transaction is currently being signed
 */
type DappRequestBottomSheetContentProps = {
  requestEvent: WalletKitSessionRequest | null;
  account: ActiveAccount | null;
  onCancelRequest: () => void;
  onConfirm: () => void;
  isSigning: boolean;
  isMemoMissing: boolean;
  onCancelAddMemo: () => void;
  isValidatingMemo: boolean;
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
> = ({
  requestEvent,
  account,
  onCancelRequest,
  onConfirm,
  isSigning,
  isMemoMissing,
  onCancelAddMemo,
  isValidatingMemo,
}) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
  const { copyToClipboard } = useClipboard();
  const addMemoExplanationBottomSheetModalRef = useRef<BottomSheetModal>(null);

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

  const renderConfirmButton = () => {
    if (isMemoMissing || isValidatingMemo) {
      return (
        <View className="flex-1">
          <Button
            onPress={onConfirm}
            tertiary
            xl
            disabled={!xdr || isValidatingMemo}
          >
            {t("transactionAmountScreen.addMemo")}
          </Button>
        </View>
      );
    }

    return (
      <View className="flex-1">
        <Button
          tertiary
          lg
          isFullWidth
          onPress={onConfirm}
          isLoading={isSigning}
        >
          {t("dappRequestBottomSheetContent.confirm")}
        </Button>
      </View>
    );
  };

  return (
    <View className="flex-1 justify-center items-center mt-2">
      <App size="lg" appName={dAppName} favicon={dAppFavicon} />
      <View className="mt-4" />
      <Text lg primary medium style={{ textAlign: "center" }}>
        {dAppName}
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
        {t("dappRequestBottomSheetContent.transactionRequest")}
      </Badge>
      <View className="flex-row items-center mt-6 p-6 bg-background-tertiary rounded-xl justify-center">
        <View className="flex-row items-center justify-between w-full">
          <View className="flex-row items-center flex-1">
            <Icon.FileCode02 size={16} color={themeColors.foreground.primary} />
            <Text md medium secondary style={{ marginLeft: pxValue(8) }}>
              {t("dappRequestBottomSheetContent.xdrItem")}
            </Text>
          </View>
          <TouchableOpacity
            className="flex-row items-center flex-1 ml-2"
            onPress={() =>
              handleCopy(xdr, t("dappRequestBottomSheetContent.xdrItem"))
            }
          >
            <Icon.Copy01 size={16} color={themeColors.foreground.primary} />
            <Text
              md
              medium
              primary
              style={{ marginLeft: pxValue(8), flex: 1 }}
              numberOfLines={1}
            >
              {xdr}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      {isMemoMissing && <RequiredMemoMissingWarning />}
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
            onPress={onCancelRequest}
            disabled={isSigning}
          >
            {t("dappRequestBottomSheetContent.cancel")}
          </Button>
        </View>
        {renderConfirmButton()}
      </View>
      <BottomSheet
        modalRef={addMemoExplanationBottomSheetModalRef}
        handleCloseModal={onCancelAddMemo}
        customContent={
          <AddMemoExplanationBottomSheet
            modalRef={addMemoExplanationBottomSheetModalRef}
            onAddMemo={onConfirm}
          />
        }
      />
    </View>
  );
};

export default DappRequestBottomSheetContent;
