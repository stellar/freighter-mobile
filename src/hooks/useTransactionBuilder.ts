import {
  Asset,
  Memo,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { BigNumber } from "bignumber.js";
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
   * Validates if a string can be parsed as a valid number
   */
  const isValidNumber = (value: string): boolean => {
    try {
      const num = new BigNumber(value);
      return !num.isNaN() && num.isFinite() && num.isPositive();
    } catch (e) {
      return false;
    }
  };

  /**
   * Validates all transaction parameters
   * Returns an error message if any validation fails
   */
  const validateTransactionParams = (
    params: BuildPaymentTransactionParams,
  ): string | null => {
    const {
      publicKey,
      selectedBalance,
      tokenValue,
      address,
      transactionFee,
      transactionTimeout,
      network,
    } = params;

    if (
      !publicKey ||
      typeof publicKey !== "string" ||
      publicKey.trim() === ""
    ) {
      return "Invalid source public key";
    }

    if (!selectedBalance) {
      return "Selected balance is required";
    }

    if (!tokenValue || !isValidNumber(tokenValue)) {
      return "Invalid token amount";
    }

    if (!address || typeof address !== "string" || address.trim() === "") {
      return "Invalid destination address";
    }

    if (address === publicKey) {
      return "Cannot send to the same account";
    }

    if (!network) {
      return "Network is required";
    }

    if (!isValidNumber(transactionFee)) {
      return "Invalid transaction fee";
    }

    if (!Number.isInteger(transactionTimeout) || transactionTimeout <= 0) {
      return "Invalid transaction timeout";
    }

    // Validate amount doesn't exceed balance
    if (
      selectedBalance.total &&
      new BigNumber(tokenValue).isGreaterThan(selectedBalance.total)
    ) {
      return "Amount exceeds available balance";
    }

    return null;
  };

  /**
   * Helper function to get the correct asset based on the selected balance
   */
  const getAssetForPayment = (
    selectedBalance: PricedBalance,
    isNativeAsset: boolean,
  ): Asset => {
    if (isNativeAsset) {
      return Asset.native();
    }

    if (
      "token" in selectedBalance &&
      selectedBalance.token &&
      "issuer" in selectedBalance.token
    ) {
      // Handle non-native asset
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

      // Length validation for assetCode (stellar limits)
      if (assetCode.length > 12) {
        throw new Error("Asset code exceeds maximum length of 12 characters");
      }

      return new Asset(assetCode, issuerKey);
    }

    throw new Error("Invalid or unsupported asset structure");
  };

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
      // Validate all input parameters
      const validationError = validateTransactionParams({
        publicKey,
        selectedBalance,
        tokenValue,
        address,
        transactionMemo,
        transactionFee,
        transactionTimeout,
        network,
      });

      if (validationError) {
        throw new Error(validationError);
      }

      const { networkUrl, networkPassphrase } =
        mapNetworkToNetworkDetails(network);
      const server = stellarSdkServer(networkUrl);

      // Load the source account
      const sourceAccount = await server.loadAccount(publicKey);

      // Create the transaction builder with validated parameters
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

          // Validate minimum starting balance for account creation (1 XLM)
          if (new BigNumber(tokenValue).isLessThan(1)) {
            throw new Error("Minimum of 1 XLM required to create an account");
          }
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
        const asset = getAssetForPayment(selectedBalance, isNativeAsset);

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
      logger.error("TransactionBuilder", "Transaction builder error", {
        error: errorMessage,
      });
      throw error;
    }
  };

  return { buildPaymentTransaction };
};
