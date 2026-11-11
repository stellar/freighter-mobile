import Blockaid from "@blockaid/client";
import { SignTransactionDetailsInterface } from "components/screens/SignTransactionDetails/types";
import { DappSignAuthEntryBottomSheetContent } from "components/screens/WalletKit/DappSignAuthEntryBottomSheetContent";
import { DappSignMessageBottomSheetContent } from "components/screens/WalletKit/DappSignMessageBottomSheetContent";
import { DappSignTransactionBottomSheetContent } from "components/screens/WalletKit/DappSignTransactionBottomSheetContent";
import { NetworkDetails } from "config/constants";
import { ActiveAccount } from "ducks/auth";
import {
  StellarRpcMethods,
  StellarSignAuthEntryParams,
  StellarSignMessageParams,
  WalletKitSessionRequest,
} from "ducks/walletKit";
import React from "react";

interface DappRequestBottomSheetContentProps {
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
  /** Called when the request's details throw while rendering. */
  onDetailsRenderError?: () => void;
}

/**
 * The dApp request sheet's content. It picks the sheet for the request's
 * method (sign message, sign auth entry, or a transaction for anything else)
 * and hands it every prop.
 */
const DappRequestBottomSheetContent: React.FC<
  DappRequestBottomSheetContentProps
> = (props) => {
  const { requestEvent } = props;
  const requestMethod = requestEvent?.params?.request
    ?.method as StellarRpcMethods;
  const requestParams = requestEvent?.params?.request?.params;

  if (requestMethod === StellarRpcMethods.SIGN_MESSAGE) {
    const message = (requestParams as StellarSignMessageParams)?.message;
    if (message) {
      return <DappSignMessageBottomSheetContent {...props} message={message} />;
    }
    return null;
  }

  if (requestMethod === StellarRpcMethods.SIGN_AUTH_ENTRY) {
    const entryXdr = (requestParams as StellarSignAuthEntryParams)?.entryXdr;
    if (entryXdr) {
      return (
        <DappSignAuthEntryBottomSheetContent {...props} entryXdr={entryXdr} />
      );
    }
    return null;
  }

  return <DappSignTransactionBottomSheetContent {...props} />;
};

export default DappRequestBottomSheetContent;
