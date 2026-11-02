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
} from "helpers/stellar";
// Aliased so it doesn't clash with the `t` that getMemoDisabledState takes
import { t as translate } from "i18next";
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
 * Picks the address a Soroban transfer is sent to, or refuses the transfer.
 *
 * A Soroban transaction carries no memo, so the only id a transfer can carry
 * is the one in a muxed destination. When the recipient or the memo can't
 * arrive as entered, this throws instead of sending to a different address
 * or without the memo.
 *
 * - A muxed contract (`W...`) is returned unchanged, before anything else: the
 *   mux id is already in the address, so it is never re-encoded, stripped to
 *   its `C...` or rebuilt as an `M...`, and the memo and
 *   `contractSupportsMuxed` are ignored for it.
 * - An `M...` is returned unchanged when the contract supports muxed
 *   addresses, and refused when it doesn't. A memo for it is refused: the
 *   `M...`'s own id is the only one the transfer can carry.
 * - Any other recipient without a memo is returned unchanged.
 * - A `G...` with a memo becomes an `M...` carrying the memo as its id. The
 *   memo is refused when the contract doesn't support muxed addresses, when
 *   the recipient isn't a `G...`, or when the memo isn't a decimal uint64.
 *
 * @param params The recipient, the memo, and whether the contract supports muxed
 * @returns The address to send to
 * @throws Error with a translated message when the recipient or the memo
 * can't be carried
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

  const hasMemo =
    typeof transactionMemo === "string" && transactionMemo.length > 0;

  if (isMuxedAccount(recipientAddress)) {
    if (!contractSupportsMuxed) {
      throw new Error(translate("transaction.errors.muxedAddressNotSupported"));
    }

    if (hasMemo) {
      throw new Error(
        translate("transactionSettings.memoInfo.memoDisabledForTransaction"),
      );
    }

    return recipientAddress;
  }

  if (!hasMemo) {
    return recipientAddress;
  }

  const isRecipientGAddress =
    isValidStellarAddress(recipientAddress) && !isContractId(recipientAddress);

  if (!contractSupportsMuxed || !isRecipientGAddress) {
    throw new Error(
      translate("transactionSettings.memoInfo.memoNotSupportedForOperation"),
    );
  }

  const muxedWithMemo = createMuxedAccount(recipientAddress, transactionMemo);

  if (!muxedWithMemo) {
    throw new Error(translate("transaction.errors.nonNumericMemoNotSupported"));
  }

  return muxedWithMemo;
}
