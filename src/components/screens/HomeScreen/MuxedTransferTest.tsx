import { BigNumber } from "bignumber.js";
import { Button } from "components/sds/Button";
import { Text } from "components/sds/Typography";
import { useAuthenticationStore } from "ducks/auth";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { useToast } from "providers/ToastProvider";
import React, { useState } from "react";
import { View } from "react-native";

/**
 * Test component for muxed address Soroban transfer
 * Hardcoded values:
 * - Source token: LFX (custom) CB7E6QIHUPHUAPYH7KDJDQ6AZ7ESTA7P6HBRW6RIZ574GRW4DYZU3WDE
 * - Destination: GCHA6SN6JCMZRBDOIVMMRSB6BW2DYMT5A4WLDAQVGRTHJAQMDZF2MY6P
 * - Memo: 1234
 */
export const MuxedTransferTest: React.FC = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { account, network } = useAuthenticationStore();
  const { buildTransaction, signTransaction, submitTransaction } =
    useTransactionBuilderStore();
  const { showToast } = useToast();

  // Hardcoded test values
  const CUSTOM_TOKEN_CONTRACT_ID =
    "CB7E6QIHUPHUAPYH7KDJDQ6AZ7ESTA7P6HBRW6RIZ574GRW4DYZU3WDE";
  const DESTINATION_ADDRESS =
    "GCHA6SN6JCMZRBDOIVMMRSB6BW2DYMT5A4WLDAQVGRTHJAQMDZF2MY6P";
  const MEMO = "1234";
  const AMOUNT = "1"; // 1 token
  const TRANSACTION_FEE = "0.00001";
  const TRANSACTION_TIMEOUT = 30;

  const handleTestTransfer = async () => {
    if (!account?.publicKey || !account?.privateKey) {
      showToast({
        variant: "error",
        title: "No account available",
        duration: 3000,
      });
      return;
    }

    setIsProcessing(true);

    try {
      console.log("[MuxedTransferTest] Starting test transfer", {
        contractId: CUSTOM_TOKEN_CONTRACT_ID,
        destination: DESTINATION_ADDRESS,
        memo: MEMO,
        amount: AMOUNT,
        sender: account.publicKey,
        network,
      });

      // Create a mock balance object for the custom token (SorobanBalance)
      const mockBalance = {
        id: CUSTOM_TOKEN_CONTRACT_ID,
        tokenCode: "LFX",
        contractId: CUSTOM_TOKEN_CONTRACT_ID,
        total: BigNumber(AMOUNT),
        available: BigNumber(AMOUNT),
        decimals: 7, // Standard Soroban token decimals
        token: {
          code: "LFX",
          type: "custom",
        },
        name: "LFX",
        symbol: "LFX",
      } as any;

      // Build the transaction using the transaction builder store
      // This will use buildPaymentTransaction which will detect it's a custom token
      // and create the muxed address at the last step
      const xdr = await buildTransaction({
        tokenAmount: AMOUNT,
        selectedBalance: mockBalance,
        recipientAddress: DESTINATION_ADDRESS, // Pass G address, memo will be added separately
        transactionMemo: MEMO, // Pass memo - transaction service will create muxed address
        transactionFee: TRANSACTION_FEE,
        transactionTimeout: TRANSACTION_TIMEOUT,
        network,
        senderAddress: account.publicKey,
      });

      console.log("[MuxedTransferTest] Transaction built", {
        hasXDR: !!xdr,
      });

      if (!xdr) {
        throw new Error("Failed to build transaction");
      }

      // Sign the transaction
      const signedXDR = signTransaction({
        secretKey: account.privateKey,
        network,
      });

      if (!signedXDR) {
        throw new Error("Failed to sign transaction");
      }

      console.log("[MuxedTransferTest] Transaction signed");

      // Submit the transaction
      const hash = await submitTransaction({
        network,
      });

      if (hash) {
        console.log("[MuxedTransferTest] Transaction submitted successfully", {
          hash,
        });
        showToast({
          variant: "success",
          title: "Test transfer successful!",
          message: `Hash: ${hash.substring(0, 8)}...`,
          duration: 5000,
        });
      } else {
        throw new Error("Transaction submission failed");
      }
    } catch (error) {
      console.error("[MuxedTransferTest] Error", error);
      showToast({
        variant: "error",
        title: "Test transfer failed",
        message: error instanceof Error ? error.message : String(error),
        duration: 5000,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <View className="p-4 bg-background-secondary rounded-lg m-4">
      <Text lg medium style={{ marginBottom: 8 }}>
        Muxed Transfer Test
      </Text>
      <Text sm secondary style={{ marginBottom: 16 }}>
        Custom Token: LFX ({CUSTOM_TOKEN_CONTRACT_ID.substring(0, 8)}...)
        {"\n"}
        Destination: {DESTINATION_ADDRESS.substring(0, 8)}...
        {"\n"}
        Memo: {MEMO}
      </Text>
      <Button
        tertiary
        xl
        onPress={handleTestTransfer}
        disabled={isProcessing || !account?.privateKey}
      >
        {isProcessing ? "Processing..." : "Test Muxed Transfer"}
      </Button>
    </View>
  );
};
