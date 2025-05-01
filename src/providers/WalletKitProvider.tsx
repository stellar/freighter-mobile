import { BottomSheetModal } from "@gorhom/bottom-sheet";
import BottomSheet from "components/BottomSheet";
import DappConnectionBottomSheetContent from "components/screens/WalletKit/DappConnectionBottomSheetContent";
import {
  useWalletKitStore,
  SessionProposal,
  WalletKitEventTypes,
} from "ducks/walletKit";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { ReactNode, useEffect, useRef, useState } from "react";
import { View } from "react-native";

interface WalletKitProviderProps {
  children: ReactNode;
}

/**
 * Provider component that monitors WalletConnect connection and requests proposals
 */
export const WalletKitProvider: React.FC<WalletKitProviderProps> = ({
  children,
}) => {
  const { account } = useGetActiveAccount();
  const { event, clearEvent } = useWalletKitStore();
  const [isConnecting, setIsConnecting] = useState(false);
  const [sessionProposal, setSessionProposal] =
    useState<SessionProposal | null>(null);

  const dappConnectionBottomSheetModalRef = useRef<BottomSheetModal>(null);

  useEffect(() => {
    if (event.type === WalletKitEventTypes.SESSION_PROPOSAL) {
      setSessionProposal(event.params);
      dappConnectionBottomSheetModalRef.current?.present();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.type]);

  const handleDappConnection = () => {
    // TODO: Handle dapp connection
    setIsConnecting(true);
    new Promise((resolve) => {
      setTimeout(resolve, 1000);
    }).finally(() => {
      setIsConnecting(false);
      dappConnectionBottomSheetModalRef.current?.dismiss();
      clearEvent();
    });
  };

  const handleCancelDappConnection = () => {
    dappConnectionBottomSheetModalRef.current?.dismiss();
    clearEvent();
  };

  return (
    <View className="flex-1">
      <BottomSheet
        modalRef={dappConnectionBottomSheetModalRef}
        handleCloseModal={() =>
          dappConnectionBottomSheetModalRef.current?.dismiss()
        }
        customContent={
          <DappConnectionBottomSheetContent
            account={account}
            sessionProposal={sessionProposal}
            onCancel={handleCancelDappConnection}
            onConnection={handleDappConnection}
            isConnecting={isConnecting}
          />
        }
      />
      {children}
    </View>
  );
};
