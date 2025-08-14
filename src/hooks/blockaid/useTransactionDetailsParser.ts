import { TransactionBuilder } from "@stellar/stellar-sdk";
import { mapNetworkToNetworkDetails } from "config/constants";
import { logger } from "config/logger";
import { useAuthenticationStore } from "ducks/auth";
import { WalletKitSessionRequest } from "ducks/walletKit";
import { stroopToXlm } from "helpers/formatAmount";

interface TransactionDetailsParser {
  requestEvent: WalletKitSessionRequest | null;
}

export const useTransactionDetailsParser = ({requestEvent}: TransactionDetailsParser) => {
  const { network } = useAuthenticationStore();
  const networkDetails = mapNetworkToNetworkDetails(network);
  const sessionRequest = requestEvent?.params;

  if (!sessionRequest) {
    return null;
  }

  const { request } = sessionRequest;
  const { params } = request;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const xdr = params?.xdr as string;

  const transactionData = TransactionBuilder.fromXDR(xdr, networkDetails.networkPassphrase);

  const feeStroops = transactionData.fee; // string from XDR

  const transactionDetails = {
    fee: stroopToXlm(feeStroops),
  };
  logger.info("transactionDetails", JSON.stringify(transactionData));

  return {
    transactionDetails,
  };
};