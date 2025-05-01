import { BottomSheetModal } from "@gorhom/bottom-sheet";
import BottomSheet from "components/BottomSheet";
import DappConnectionBottomSheetContent from "components/screens/WalletKit/DappConnectionBottomSheetContent";
import DappRequestBottomSheetContent from "components/screens/WalletKit/DappRequestBottomSheetContent";
import {
  useWalletKitStore,
  SessionProposal,
  WalletKitEventTypes,
  SessionRequest,
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
  const [isSigning, setIsSigning] = useState(false);

  const [sessionProposal, setSessionProposal] =
    useState<SessionProposal | null>(null);
  const [sessionRequest, setSessionRequest] = useState<SessionRequest | null>(
    null,
  );

  const dappConnectionBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const dappRequestBottomSheetModalRef = useRef<BottomSheetModal>(null);

  const handleResetDappConnection = () => {
    // TODO: Handle cancel connection
    dappConnectionBottomSheetModalRef.current?.dismiss();
    setTimeout(() => {
      setIsConnecting(false);
      setSessionProposal(null);
      clearEvent();
    }, 200);
  };

  const handleResetDappRequest = () => {
    // TODO: Handle cancel request
    dappRequestBottomSheetModalRef.current?.dismiss();
    setTimeout(() => {
      setIsSigning(false);
      setSessionRequest(null);
      clearEvent();
    }, 200);
  };

  const handleDappConnection = () => {
    // TODO: Handle dapp connection
    setIsConnecting(true);
    new Promise((resolve) => {
      setTimeout(resolve, 1000);
    }).finally(() => {
      handleResetDappConnection();
    });
  };

  const handleDappRequest = () => {
    // TODO: Handle dapp request
    setIsSigning(true);
    new Promise((resolve) => {
      setTimeout(resolve, 1000);
    }).finally(() => {
      handleResetDappRequest();
    });
  };

  useEffect(() => {
    if (event.type === WalletKitEventTypes.SESSION_PROPOSAL) {
      handleResetDappRequest();

      setSessionProposal(event.params);
      dappConnectionBottomSheetModalRef.current?.present();
    }

    if (event.type === WalletKitEventTypes.SESSION_REQUEST) {
      handleResetDappConnection();

      setSessionRequest(event.params);
      dappRequestBottomSheetModalRef.current?.present();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.type]);

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
            onCancel={handleResetDappConnection}
            onConnection={handleDappConnection}
            isConnecting={isConnecting}
          />
        }
      />
      <BottomSheet
        modalRef={dappRequestBottomSheetModalRef}
        handleCloseModal={() =>
          dappRequestBottomSheetModalRef.current?.dismiss()
        }
        customContent={
          <DappRequestBottomSheetContent
            account={account}
            sessionRequest={sessionRequest}
            onCancel={handleResetDappRequest}
            onConfirm={handleDappRequest}
            isSigning={isSigning}
          />
        }
      />
      {children}
    </View>
  );
};
