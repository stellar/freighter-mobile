import {
  Asset,
  Memo,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import {
  NATIVE_TOKEN_CODE,
  NETWORKS,
  mapNetworkToNetworkDetails,
} from "config/constants";
import { logger } from "config/logger";
import { PricedBalance } from "config/types";
import { xlmToStroop } from "helpers/formatAmount";
import { stellarSdkServer } from "services/stellar";

interface BuildPaymentTransactionParams {
  publicKey: string;
  selectedBalance: PricedBalance;
  tokenValue: string;
  address: string;
  transactionMemo: string;
  transactionFee: string;
  transactionTimeout: number;
  network: NETWORKS;
}

export const useTransactionBuilder = () => {
  /**
   * Builds a payment transaction XDR string
   * @returns The transaction XDR string or throws an error with details
   */
  const buildPaymentTransaction = async ({
    publicKey,
    selectedBalance,
    tokenValue,
    address,
    transactionMemo,
    transactionFee,
    transactionTimeout,
    network,
  }: BuildPaymentTransactionParams): Promise<string> => {
    try {
      // Validate required parameters
      if (!publicKey) throw new Error("Source public key is required");
      if (!selectedBalance) throw new Error("Selected balance is required");
      if (!tokenValue) throw new Error("Token value is required");
      if (!address) throw new Error("Destination address is required");
      if (!network) throw new Error("Network is required");

      const { networkUrl, networkPassphrase } =
        mapNetworkToNetworkDetails(network);
      const server = stellarSdkServer(networkUrl);

      // Load the source account
      try {
        const sourceAccount = await server.loadAccount(publicKey);

        // Create the transaction builder
        const txBuilder = new TransactionBuilder(sourceAccount, {
          fee: xlmToStroop(transactionFee).toFixed(),
          networkPassphrase,
        });

        // Determine if we need to create an account or make a payment
        const isNativeAsset = selectedBalance.tokenCode === NATIVE_TOKEN_CODE;

        // Check if destination account exists (only relevant for XLM sends)
        let isDestinationFunded = true;
        if (isNativeAsset) {
          try {
            await server.loadAccount(address);
          } catch (e) {
            isDestinationFunded = false;
            logger.info(
              "Destination account not found, will create account",
              "creating account",
            );
          }
        }

        // Add the appropriate operation
        if (isNativeAsset && !isDestinationFunded) {
          // Create account operation if sending XLM to a new account
          txBuilder.addOperation(
            Operation.createAccount({
              destination: address,
              startingBalance: tokenValue,
            }),
          );
        } else {
          // Regular payment operation
          let asset;
          if (isNativeAsset) {
            asset = Asset.native();
          } else if (
            "token" in selectedBalance &&
            selectedBalance.token &&
            "issuer" in selectedBalance.token
          ) {
            // Handle non-native asset - check if it's a ClassicBalance or SorobanBalance
            const assetCode =
              selectedBalance.tokenCode || selectedBalance.token.code || "";

            // Get the issuer key from the token property
            const issuerKey =
              selectedBalance.token.issuer && selectedBalance.token.issuer.key;

            if (!assetCode || !issuerKey) {
              throw new Error(
                `Invalid asset data: code=${assetCode}, issuer=${issuerKey}`,
              );
            }

            asset = new Asset(assetCode, issuerKey);
          } else {
            throw new Error("Invalid or unsupported asset structure");
          }

          txBuilder.addOperation(
            Operation.payment({
              destination: address,
              asset,
              amount: tokenValue,
            }),
          );
        }

        // Add memo if provided
        if (transactionMemo) {
          txBuilder.addMemo(Memo.text(transactionMemo));
        }

        // Set timeout
        txBuilder.setTimeout(transactionTimeout);

        // Build the transaction and get XDR
        const builtTransaction = txBuilder.build();
        const xdr = builtTransaction.toXDR();

        return xdr;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        throw new Error(
          `Failed to load account or build transaction: ${errorMessage}`,
        );
      }
    } catch (error) {
      logger.error("Failed to build transaction XDR:", String(error));
      throw error;
    }
  };

  return { buildPaymentTransaction };
};
