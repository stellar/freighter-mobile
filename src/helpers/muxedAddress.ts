/**
 * Utility functions for handling muxed addresses and memo logic
 */
import { NetworkDetails } from "config/constants";
import { isMuxedContract } from "helpers/muxedContract";
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

/**
 * Works out whether the memo field is disabled for a send, and why.
 *
 * - `M...` and `W...` destinations: always disabled, because the mux id is
 *   already in the address. This is decided first, so no contract lookup runs.
 * - Classic sends (no `contractId` or network): enabled.
 * - Soroban sends: disabled for a `C...` or an invalid destination. For a
 *   `G...`, enabled only when the token contract supports muxed addresses
 *   (CAP-67); a failed lookup counts as unsupported.
 *
 * @param params The destination, the token contract and network (Soroban sends
 * only), and the translation function
 * @returns Whether the memo is disabled, with the message to show when it is
 */
export async function getMemoDisabledState(
  params: MemoDisabledStateParams,
): Promise<MemoDisabledState> {
  const { targetAddress, contractId, networkDetails, t } = params;

  // Disable memo for all M and W addresses (memo is encoded in the address)
  if (isMuxedAccount(targetAddress) || isMuxedContract(targetAddress)) {
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

  // For Soroban transactions (custom tokens/collectibles) with G addresses:
  // Memo is only supported if the contract supports muxed (has to_muxed property)
  try {
    const contractSupportsMuxed = await checkContractSupportsMuxed({
      contractId,
      networkDetails,
    });

    if (!contractSupportsMuxed) {
      return {
        isMemoDisabled: true,
        memoDisabledMessage: t(
          "transactionSettings.memoInfo.memoNotSupportedForOperation",
        ),
      };
    }

    return { isMemoDisabled: false, memoDisabledMessage: undefined };
  } catch (error) {
    // On error, disable memo for safety (assume contract doesn't support muxed)
    return {
      isMemoDisabled: true,
      memoDisabledMessage: t(
        "transactionSettings.memoInfo.memoNotSupportedForOperation",
      ),
    };
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

/**
 * Picks the address a Soroban transfer is sent to.
 *
 * A muxed contract (`W...`) is returned unchanged, before anything else: the
 * mux id is already in the address, so it is never re-encoded, stripped to its
 * `C...` or rebuilt as an `M...`, and the memo and `contractSupportsMuxed` are
 * ignored for it.
 *
 * Every other recipient follows the existing rules:
 * - Contract supports muxed: a `G...` with a memo becomes an `M...` carrying
 *   the memo as its id. Anything else is kept as is, including an `M...` with
 *   a memo: `isValidStellarAddress` accepts an `M...`, so it takes the `G...`
 *   branch, where `createMuxedAccount` returns null for it. The branch that
 *   would re-mux an `M...` onto its base `G...` is never reached for a real
 *   `M...`.
 * - Contract does not support muxed: an `M...` falls back to its base `G...`,
 *   and anything else is kept as is.
 *
 * @param params The recipient, the memo, and whether the contract supports muxed
 * @returns The address to send to
 * @throws Error if the contract does not support muxed and an `M...` recipient
 * has no valid base `G...`
 */
export function determineMuxedDestination(
  params: DetermineMuxedDestinationParams,
): string {
  const { recipientAddress, transactionMemo, contractSupportsMuxed } = params;

  // A W already carries its own mux id: pass it through before any G/M logic
  // can validate, rebuild or unwrap it.
  if (isMuxedContract(recipientAddress)) {
    return recipientAddress;
  }

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
