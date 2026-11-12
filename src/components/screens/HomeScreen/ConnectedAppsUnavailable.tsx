import { BottomSheetModal } from "@gorhom/bottom-sheet";
import BottomSheet from "components/BottomSheet";
import { PinnedBottomSheetHeader } from "components/BottomSheetHeader";
import { Button } from "components/sds/Button";
import { Text } from "components/sds/Typography";
import { DEFAULT_PADDING } from "config/constants";
import { useAuthenticationStore } from "ducks/auth";
import { useWalletKitStore } from "ducks/walletKit";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useToast } from "providers/ToastProvider";
import React, { useCallback, useState } from "react";
import { View } from "react-native";

/** The message shown when the connected dApps can't be listed. */
export const ConnectedAppsLoadFailed: React.FC = () => {
  const { t } = useAppTranslation();

  return (
    <View className="w-full px-4" style={{ paddingBottom: pxValue(16) }}>
      <Text md secondary regular textAlign="center">
        {t("connectedApps.loadFailed")}
      </Text>
    </View>
  );
};

interface ConnectedAppsUnavailableProps {
  bottomSheetRef: React.RefObject<BottomSheetModal | null>;
}

/**
 * Stands in for the Connected Apps sheet when it fails to render: says the
 * dApps can't be listed and keeps "Disconnect all" within reach, so a dApp
 * that breaks the list can still be disconnected.
 */
const ConnectedAppsUnavailable: React.FC<ConnectedAppsUnavailableProps> = ({
  bottomSheetRef,
}) => {
  const { t } = useAppTranslation();
  const { showToast } = useToast();
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();
  const { disconnectAllSessions } = useWalletKitStore();
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const handleClose = useCallback(() => {
    bottomSheetRef.current?.dismiss();
  }, [bottomSheetRef]);

  const handleDisconnectAll = useCallback(async () => {
    setIsDisconnecting(true);
    try {
      await disconnectAllSessions(account?.publicKey || "", network);
      showToast({
        variant: "success",
        title: t("connectedApps.allAppsDisconnected"),
        toastId: "all-apps-disconnected",
      });
      handleClose();
    } finally {
      setIsDisconnecting(false);
    }
  }, [account, disconnectAllSessions, handleClose, network, showToast, t]);

  const renderSheetHeader = useCallback(
    () => (
      <PinnedBottomSheetHeader
        title={t("connectedApps.title")}
        layout="centered"
        onClose={handleClose}
        closeTestID="connected-apps-close-button"
      />
    ),
    [handleClose, t],
  );

  const renderFooter = useCallback(
    () => (
      <View
        className="w-full px-6 pt-[24px] bg-background-primary"
        style={{ paddingBottom: pxValue(DEFAULT_PADDING) }}
      >
        <Button
          xl
          error
          isFullWidth
          isLoading={isDisconnecting}
          onPress={handleDisconnectAll}
        >
          {t("connectedApps.disconnectAllSessions")}
        </Button>
      </View>
    ),
    [handleDisconnectAll, isDisconnecting, t],
  );

  return (
    <BottomSheet
      modalRef={bottomSheetRef}
      scrollable
      scrollViewHeaderComponent={renderSheetHeader}
      scrollViewFooterComponent={renderFooter}
      customContent={<ConnectedAppsLoadFailed />}
    />
  );
};

export default ConnectedAppsUnavailable;
