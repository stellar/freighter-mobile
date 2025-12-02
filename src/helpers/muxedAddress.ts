/**
 * Utility functions for handling muxed addresses and memo logic
 */
import { NetworkDetails } from "config/constants";
import { isContractId } from "helpers/soroban";
import {
  isMuxedAccount,
  isValidStellarAddress,
  createMuxedAccount,
  getBaseAccount,
} from "helpers/stellar";
import { checkContractSupportsMuxed } from "services/backend";

export interface MemoDisabledStateParams {
  targetAddress: string;
  contractId?: string;
  networkDetails?: NetworkDetails;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: any) => string;
}

export interface MemoDisabledState {
  isMemoDisabled: boolean;
  memoDisabledMessage?: string;
}

export async function getMemoDisabledState(
  params: MemoDisabledStateParams,
): Promise<MemoDisabledState> {
  const { targetAddress, contractId, networkDetails, t } = params;

  // Only disable memo for Soroban M addresses (when there's a contractId AND target is M address)
  // Normal transactions support M address + memo
  // Custom tokens to G addresses support memo
  if (isMuxedAccount(targetAddress) && contractId) {
    return {
      isMemoDisabled: true,
      memoDisabledMessage: t(
        "transactionSettings.memoInfo.memoDisabledForTransaction",
      ),
    };
  }

  if (!contractId || !networkDetails) {
    return { isMemoDisabled: false, memoDisabledMessage: undefined };
  }

  if (isContractId(targetAddress)) {
    return {
      isMemoDisabled: true,
      memoDisabledMessage: t(
        "transactionSettings.memoInfo.memoNotSupportedForOperation",
      ),
    };
  }

  if (!isValidStellarAddress(targetAddress) && !isMuxedAccount(targetAddress)) {
    return {
      isMemoDisabled: true,
      memoDisabledMessage: t(
        "transactionSettings.memoInfo.memoNotSupportedForOperation",
      ),
    };
  }

  // For Soroban transactions (custom tokens), memo is supported for G addresses
  // Only disable memo if contract doesn't support muxed AND target is M address
  try {
    const contractSupportsMuxed = await checkContractSupportsMuxed({
      contractId,
      networkDetails,
    });

    // If contract doesn't support muxed and target is M address, disable memo
    // (because we'll need to convert M to G, and memo can't be encoded)
    if (!contractSupportsMuxed && isMuxedAccount(targetAddress)) {
      return {
        isMemoDisabled: true,
        memoDisabledMessage: t(
          "transactionSettings.memoInfo.memoNotSupportedForOperation",
        ),
      };
    }

    // For G addresses in Soroban transactions, memo is always supported
    // For M addresses in Soroban transactions with muxed support, memo is disabled (encoded in address)
    return { isMemoDisabled: false, memoDisabledMessage: undefined };
  } catch (error) {
    // On error, only disable memo if target is M address (to be safe)
    if (isMuxedAccount(targetAddress)) {
      return { isMemoDisabled: true, memoDisabledMessage: undefined };
    }
    return { isMemoDisabled: false, memoDisabledMessage: undefined };
  }
}

export interface CheckContractMuxedSupportParams {
  contractId: string;
  networkDetails: NetworkDetails;
}

export async function checkContractMuxedSupport(
  params: CheckContractMuxedSupportParams,
): Promise<boolean> {
  return checkContractSupportsMuxed(params);
}

export interface DetermineMuxedDestinationParams {
  recipientAddress: string;
  transactionMemo?: string;
  contractSupportsMuxed: boolean;
}

export function determineMuxedDestination(
  params: DetermineMuxedDestinationParams,
): string {
  const { recipientAddress, transactionMemo, contractSupportsMuxed } = params;

  const isRecipientGAddress =
    isValidStellarAddress(recipientAddress) && !isContractId(recipientAddress);
  const isRecipientAlreadyMuxed = isMuxedAccount(recipientAddress);
  const hasValidMemo =
    transactionMemo &&
    typeof transactionMemo === "string" &&
    transactionMemo.length > 0;

  if (contractSupportsMuxed) {
    if (isRecipientGAddress && hasValidMemo) {
      const muxedWithMemo = createMuxedAccount(
        recipientAddress,
        transactionMemo,
      );
      return muxedWithMemo || recipientAddress;
    }

    if (isRecipientGAddress && !hasValidMemo) {
      return recipientAddress;
    }

    if (isRecipientAlreadyMuxed && hasValidMemo) {
      const baseAccount = getBaseAccount(recipientAddress);
      if (
        baseAccount &&
        isValidStellarAddress(baseAccount) &&
        !isContractId(baseAccount)
      ) {
        const muxedWithNewMemo = createMuxedAccount(
          baseAccount,
          transactionMemo,
        );
        return muxedWithNewMemo || recipientAddress;
      }
    }

    if (isRecipientAlreadyMuxed && !hasValidMemo) {
      return recipientAddress;
    }
  } else if (isRecipientAlreadyMuxed) {
    const baseAccount = getBaseAccount(recipientAddress);
    if (
      baseAccount &&
      isValidStellarAddress(baseAccount) &&
      !isContractId(baseAccount)
    ) {
      return baseAccount;
    }
    throw new Error(
      "This contract does not support muxed addresses. Please use a regular address (G... or C...).",
    );
  }

  return recipientAddress;
}
