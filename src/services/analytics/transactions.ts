import { AnalyticsEvent } from "config/analyticsConfig";
import { track } from "services/analytics/core";
import { TransactionOperationType } from "services/analytics/types";
import type {
  SignedTransactionEvent,
  SimulationTransactionType,
  SubmittedTransactionEvent,
  TransactionSuccessEvent,
  SwapSuccessEvent,
  TransactionErrorEvent,
} from "services/analytics/types";

export const trackSignedTransaction = (data: SignedTransactionEvent): void => {
  track(AnalyticsEvent.SIGN_TRANSACTION_SUCCESS, {
    transactionHash: data.transactionHash,
    transactionType: data.transactionType,
    ...(data.dappDomain ? { origin: data.dappDomain } : {}),
  });
};

export const trackSignedMessage = (data: {
  messageLength: number;
  dappDomain?: string;
}): void => {
  // signing.message_approved carries message_type (parity with the
  // extension); mobile signs raw blobs. messageLength dropped. `origin` kept as
  // an RFC-optional extra — the extension lacks it (flagged signing-origin gap).
  track(AnalyticsEvent.SIGN_MESSAGE_SUCCESS, {
    message_type: "blob",
    ...(data.dappDomain ? { origin: data.dappDomain } : {}),
  });
};

export const trackSignedAuthEntry = (data: { dappDomain?: string }): void => {
  track(AnalyticsEvent.SIGN_AUTH_ENTRY_SUCCESS, {
    ...(data.dappDomain ? { origin: data.dappDomain } : {}),
  });
};

export const trackSignedMessageError = (data: {
  error: string;
  dappDomain?: string;
}): void => {
  // This is the runtime signing-failure path (a caught exception while
  // signing), which is distinct from a user rejection. The user-reject case
  // is not currently instrumented on mobile (SIGN_MESSAGE_REJECTED exists in
  // the catalog for parity but has no emit site yet).
  track(AnalyticsEvent.SIGN_MESSAGE_FAIL, {
    message_type: "blob",
    reason_code: data.error,
    ...(data.dappDomain ? { origin: data.dappDomain } : {}),
  });
};

export const trackSignedAuthEntryError = (data: {
  error: string;
  dappDomain?: string;
}): void => {
  // Runtime signing-failure path; see trackSignedMessageError.
  track(AnalyticsEvent.SIGN_AUTH_ENTRY_FAIL, {
    reason_code: data.error,
    ...(data.dappDomain ? { origin: data.dappDomain } : {}),
  });
};

// User-rejection paths (D4) — distinct from the runtime *_FAIL helpers above.
// Fired when the user cancels/dismisses a dApp sign-message / sign-auth-entry
// request. Keeps the rejection vs runtime-failure split on both platforms.
export const trackSignedMessageRejected = (data: {
  dappDomain?: string;
}): void => {
  track(AnalyticsEvent.SIGN_MESSAGE_REJECTED, {
    message_type: "blob",
    ...(data.dappDomain ? { origin: data.dappDomain } : {}),
  });
};

export const trackSignedAuthEntryRejected = (data: {
  dappDomain?: string;
}): void => {
  track(AnalyticsEvent.SIGN_AUTH_ENTRY_REJECTED, {
    ...(data.dappDomain ? { origin: data.dappDomain } : {}),
  });
};

export const trackSubmittedTransaction = (
  data: SubmittedTransactionEvent,
): void => {
  track(AnalyticsEvent.SUBMIT_TRANSACTION_SUCCESS, {
    transactionHash: data.transactionHash,
    transactionType: data.transactionType,
    ...(data.dappDomain ? { origin: data.dappDomain } : {}),
  });
};

export const trackSimulationError = (
  error: string,
  transactionType: SimulationTransactionType,
): void => {
  track(AnalyticsEvent.SIMULATE_TOKEN_PAYMENT_ERROR, {
    reason_code: error,
    transactionType,
  });
};

export const trackSendPaymentSuccess = (
  data: TransactionSuccessEvent,
): void => {
  // Path / routed payment outcomes are reported as swaps (product decision):
  // a path-payment success emits swap.completed, a direct payment emits
  // payment.completed with payment_type=payment.
  if (data.operationType === TransactionOperationType.PathPayment) {
    track(AnalyticsEvent.SWAP_SUCCESS, {
      from_asset_code: data.sourceToken,
      to_asset_code: data.destToken,
    });
    return;
  }

  track(AnalyticsEvent.SEND_PAYMENT_SUCCESS, {
    payment_type: "payment",
    asset_code: data.sourceToken,
  });
};

export const trackSendCollectibleSuccess = (
  data: TransactionSuccessEvent,
): void => {
  track(AnalyticsEvent.SEND_COLLECTIBLE_SUCCESS, {
    collection_address: data.collectionAddress,
    token_id: data.tokenId,
  });
};

export const trackSwapSuccess = (data: SwapSuccessEvent): void => {
  track(AnalyticsEvent.SWAP_SUCCESS, {
    from_asset_code: data.sourceToken,
    to_asset_code: data.destToken,
  });
};

export const trackTransactionError = (data: TransactionErrorEvent): void => {
  // Route the outcome to the right terminal event:
  // - collectible sends -> collectible_send.failed
  // - swaps and path / routed payments -> swap.failed (product decision)
  // - direct payments -> payment.failed
  const isSwapLike =
    data.isSwap ||
    data.operationType === TransactionOperationType.PathPayment ||
    data.operationType === TransactionOperationType.Swap;

  let event = AnalyticsEvent.SEND_PAYMENT_FAIL;
  if (data.operationType === TransactionOperationType.SendCollectible) {
    event = AnalyticsEvent.SEND_COLLECTIBLE_FAIL;
  } else if (isSwapLike) {
    event = AnalyticsEvent.SWAP_FAIL;
  }

  // Shared required sets: payment.failed {payment_type, reason_code};
  // swap.failed {from_asset_code, to_asset_code, reason_code};
  // collectible_send.failed {reason_code}. Legacy extras (errorCode,
  // operationType, isSwap, amounts) dropped for cross-platform parity.
  let props: Record<string, unknown> = { reason_code: data.error };
  if (event === AnalyticsEvent.SWAP_FAIL) {
    props = {
      from_asset_code: data.sourceToken,
      to_asset_code: data.destToken,
      reason_code: data.error,
    };
  } else if (event === AnalyticsEvent.SEND_PAYMENT_FAIL) {
    props.payment_type = "payment";
  }

  track(event, props);
};

export const trackAddTokenConfirmed = (token?: string): void => {
  track(AnalyticsEvent.ASSET_ADD_RESPONDED, {
    decision: "confirm",
    asset: token,
  });
};

export const trackAddTokenRejected = (token?: string): void => {
  track(AnalyticsEvent.ASSET_ADD_RESPONDED, {
    decision: "reject",
    asset: token,
  });
};

export const trackRemoveTokenConfirmed = (token?: string): void => {
  track(AnalyticsEvent.ASSET_REMOVE_RESPONDED, {
    decision: "confirm",
    asset: token,
  });
};

export const trackRemoveTokenRejected = (token?: string): void => {
  track(AnalyticsEvent.ASSET_REMOVE_RESPONDED, {
    decision: "reject",
    asset: token,
  });
};

export const trackAccountScreenImportAccountFail = (error: string): void => {
  // Failure reason is carried on `reason_code` per the shared failure grammar
  // (matches the catalog note and the extension `account.import_failed` shape).
  // account.import_failed carries import_method. This helper is the
  // secret-key import path (mnemonic restore emits account_recovery.* instead).
  track(AnalyticsEvent.ACCOUNT_SCREEN_IMPORT_ACCOUNT_FAIL, {
    import_method: "secret_key",
    reason_code: error,
  });
};

export const trackViewPublicKeyAccountRenamed = (): void => {
  // account.renamed carries `source`, never the account labels.
  // Mobile only renames from the manage-accounts list.
  track(AnalyticsEvent.VIEW_PUBLIC_KEY_ACCOUNT_RENAMED, {
    source: "wallets",
  });
};

export const trackGrantAccessSuccess = (domain?: string): void => {
  track(AnalyticsEvent.GRANT_DAPP_ACCESS_SUCCESS, { origin: domain });
};

export const trackGrantAccessFail = (
  domain?: string,
  reason?: string,
): void => {
  track(AnalyticsEvent.GRANT_DAPP_ACCESS_FAIL, {
    origin: domain,
    reason_code: reason,
  });
};

export const trackHistoryOpenItem = (source: string): void => {
  // history.item_opened carries `source` (not the tx hash).
  track(AnalyticsEvent.HISTORY_OPEN_ITEM, { source });
};

/**
 * Generic helper for authentication events.
 */
const trackAuthEvent = (
  event: AnalyticsEvent,
  additional?: Record<string, unknown>,
): void => {
  // reauth.* is not in the shared cross-platform catalog (documented deviation). Dropping
  // the constant context/method for parity with the extension's {} / {reason_code}.
  track(event, { ...additional });
};

export const trackReAuthSuccess = (): void => {
  trackAuthEvent(AnalyticsEvent.RE_AUTH_SUCCESS);
};

export const trackReAuthFail = (): void => {
  trackAuthEvent(AnalyticsEvent.RE_AUTH_FAIL);
};

export const trackCopyPublicKey = (): void => {
  // account.public_key_copied carries no source and never the key.
  track(AnalyticsEvent.COPY_PUBLIC_KEY);
};

export const trackCopyBackupPhrase = (): void => {
  // recovery_phrase.copied carries only schema_version (via context).
  track(AnalyticsEvent.COPY_BACKUP_PHRASE);
};

export const trackQRScanSuccess = (
  context: string,
  timeToScan?: number,
): void => {
  track(AnalyticsEvent.QR_SCAN_SUCCESS, { context, timeToScan });
};

export const trackQRScanError = (context: string, error: string): void => {
  track(AnalyticsEvent.QR_SCAN_ERROR, { context, reason_code: error });
};
