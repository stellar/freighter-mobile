/**
 * Muxed Address Helper Functions
 * @fileoverview Utility functions for handling muxed addresses and memo logic
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

/**
 * Parameters for determining memo disabled state
 */
export interface MemoDisabledStateParams {
  /** Target address (recipient) */
  targetAddress: string;
  /** Contract ID if this is a Soroban transaction (custom token or collectible) */
  contractId?: string;
  /** Network details for contract spec lookup */
  networkDetails?: NetworkDetails;
  /** Translation function */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: any) => string;
}

/**
 * Result of memo disabled state check
 */
export interface MemoDisabledState {
  /** Whether memo input should be disabled */
  isMemoDisabled: boolean;
  /** Message to display when memo is disabled (if any) */
  memoDisabledMessage?: string;
}

/**
 * Determines if memo should be disabled and what message to show
 * @param params - Parameters including source, target, contract info, and translation function
 * @returns Promise resolving to memo disabled state
 */
export async function getMemoDisabledState(
  params: MemoDisabledStateParams,
): Promise<MemoDisabledState> {
  const { targetAddress, contractId, networkDetails, t } = params;

  // If destination is M address, memo is embedded in the address
  // This applies to both classic and Soroban transactions
  if (isMuxedAccount(targetAddress)) {
    return {
      isMemoDisabled: true,
      memoDisabledMessage: t(
        "transactionSettings.memoInfo.memoDisabledForTransaction",
      ),
    };
  }

  // For classic transactions (no contract), memo is allowed
  if (!contractId || !networkDetails) {
    return { isMemoDisabled: false, memoDisabledMessage: undefined };
  }

  // Check if target is a contract address (C address)
  // C addresses cannot be muxed
  if (isContractId(targetAddress)) {
    return {
      isMemoDisabled: true,
      memoDisabledMessage: t(
        "transactionSettings.memoInfo.memoNotSupportedForOperation",
      ),
    };
  }

  // Check if target is a valid G or M address
  // If not, disable memo for safety
  if (!isValidStellarAddress(targetAddress) && !isMuxedAccount(targetAddress)) {
    return {
      isMemoDisabled: true,
      memoDisabledMessage: t(
        "transactionSettings.memoInfo.memoNotSupportedForOperation",
      ),
    };
  }

  // Check contract muxed support
  try {
    const contractSupportsMuxed = await checkContractSupportsMuxed({
      contractId,
      networkDetails,
    });

    // Contract doesn't support muxed - disable memo
    if (!contractSupportsMuxed) {
      return {
        isMemoDisabled: true,
        memoDisabledMessage: t(
          "transactionSettings.memoInfo.memoNotSupportedForOperation",
        ),
      };
    }

    // Contract supports muxed, enable memo
    return { isMemoDisabled: false, memoDisabledMessage: undefined };
  } catch (error) {
    // If we can't check the contract, disable memo to be safe
    return { isMemoDisabled: true, memoDisabledMessage: undefined };
  }
}

/**
 * Parameters for checking contract muxed support
 */
export interface CheckContractMuxedSupportParams {
  /** Contract ID to check */
  contractId: string;
  /** Network details */
  networkDetails: NetworkDetails;
}

/**
 * Unified function to check if a contract supports muxed addresses
 * Works for both custom tokens and collectibles
 * @param params - Contract ID and network details
 * @returns Promise resolving to true if contract supports muxed addresses, false otherwise
 */
export async function checkContractMuxedSupport(
  params: CheckContractMuxedSupportParams,
): Promise<boolean> {
  return checkContractSupportsMuxed(params);
}

/**
 * Parameters for determining final destination with muxed address handling
 */
export interface DetermineMuxedDestinationParams {
  /** Recipient address (can be G, M, or C address) */
  recipientAddress: string;
  /** Transaction memo (if any) */
  transactionMemo?: string;
  /** Whether the contract supports muxed addresses */
  contractSupportsMuxed: boolean;
}

/**
 * Determines the final destination address based on muxed address support and memo
 * Handles all cases from the behavior matrix:
 * - ✅ Yes + G/C + ✅ Yes → Create muxed with memo
 * - ✅ Yes + G/C + ❌ No → Use G/C as-is
 * - ✅ Yes + M + ✅ Yes → Extract base G, create new muxed with new memo
 * - ✅ Yes + M + ❌ No → Use M address as-is
 * - ❌ No + M → Extract base G (or throw error)
 * - ❌ No + G/C → Use G/C as-is (memo disabled in UI)
 * @param params - Parameters including recipient, memo, and contract support
 * @returns Final destination address
 * @throws Error if contract doesn't support muxed and recipient is M address with invalid base
 */
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
    // Contract supports muxed addresses
    if (isRecipientGAddress && hasValidMemo) {
      // ✅ Yes + G/C + ✅ Yes → Create muxed with memo
      const muxedWithMemo = createMuxedAccount(
        recipientAddress,
        transactionMemo,
      );
      return muxedWithMemo || recipientAddress;
    }

    if (isRecipientGAddress && !hasValidMemo) {
      // ✅ Yes + G/C + ❌ No → Use G/C as-is
      return recipientAddress;
    }

    if (isRecipientAlreadyMuxed && hasValidMemo) {
      // ✅ Yes + M + ✅ Yes → Extract base G, create new muxed with new memo
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
      // ✅ Yes + M + ❌ No → Use M address as-is
      return recipientAddress;
    }
  } else if (isRecipientAlreadyMuxed) {
    // Contract doesn't support muxed addresses
    // ❌ No + M → Extract base G (or error)
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

  // ❌ No + G/C → Use G/C as-is (memo disabled in UI)
  return recipientAddress;
}
