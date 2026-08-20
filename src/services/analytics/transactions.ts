import { AnalyticsEvent } from "config/analyticsConfig";
import { getDisplayHost } from "helpers/protocols";
import { scrubStrKeys } from "helpers/stellarStrKey";
import { track } from "services/analytics/core";
import { TransactionOperationType } from "services/analytics/types";
import type {
  SignedTransactionEvent,
  SimulationTransactionType,
  SubmittedTransactionEvent,
  TransactionSuccessEvent,
  SwapSuccessEvent,
  TransactionErrorEvent,
  EarnDepositSuccessEvent,
  EarnDepositErrorEvent,
} from "services/analytics/types";

// `origin` is the bare dApp hostname (never a full URL) — matches the
// extension's getUrlHostname-based origin so cross-platform funnels merge.
const originProps = (url?: string): { origin?: string } => {
  const host = url ? getDisplayHost(url) : null;
  return host ? { origin: host } : {};
};

export const trackSignedTransaction = (data: SignedTransactionEvent): void => {
  track(AnalyticsEvent.SIGN_TRANSACTION_SUCCESS, {
    ...originProps(data.dappDomain),
  });
};

export const trackSignedMessage = (data: {
  messageLength: number;
  dappDomain?: string;
}): void => {
  // signing.message_approved carries message_type (parity with the
  // extension); mobile signs raw blobs. messageLength dropped. `origin` matches
  // the extension's hostname-based origin.
  track(AnalyticsEvent.SIGN_MESSAGE_SUCCESS, {
    message_type: "blob",
    ...originProps(data.dappDomain),
  });
};

export const trackSignedAuthEntry = (data: { dappDomain?: string }): void => {
  track(AnalyticsEvent.SIGN_AUTH_ENTRY_SUCCESS, {
    ...originProps(data.dappDomain),
  });
};

export const trackSignedMessageError = (data: {
  error: string;
  dappDomain?: string;
}): void => {
  // This is the runtime signing-failure path (a caught exception while
  // signing), distinct from a user rejection. The user-reject case is
  // instrumented separately (trackSignedMessageRejected, below).
  track(AnalyticsEvent.SIGN_MESSAGE_FAIL, {
    message_type: "blob",
    // Scrub Stellar StrKeys — a signing exception's message can embed a G…/S…
    // key, and Amplitude is a third-party sink not covered by Sentry. Matches
    // the extension's signBlob.rejected handler.
    reason_code: scrubStrKeys(data.error) ?? data.error,
    ...originProps(data.dappDomain),
  });
};

export const trackSignedAuthEntryError = (data: {
  error: string;
  dappDomain?: string;
}): void => {
  // Runtime signing-failure path; see trackSignedMessageError.
  track(AnalyticsEvent.SIGN_AUTH_ENTRY_FAIL, {
    // Scrub StrKeys before this reaches Amplitude (see trackSignedMessageError).
    reason_code: scrubStrKeys(data.error) ?? data.error,
    ...originProps(data.dappDomain),
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
    ...originProps(data.dappDomain),
  });
};

export const trackSignedAuthEntryRejected = (data: {
  dappDomain?: string;
}): void => {
  track(AnalyticsEvent.SIGN_AUTH_ENTRY_REJECTED, {
    ...originProps(data.dappDomain),
  });
};

export const trackSignedTransactionRejected = (data: {
  dappDomain?: string;
}): void => {
  // Mirrors the approve side (trackSignedTransaction) for the tx-signing methods
  // (SIGN_XDR / SIGN_AND_SUBMIT_XDR); parity with the extension's
  // signing.transaction_rejected.
  track(AnalyticsEvent.SIGN_TRANSACTION_FAIL, {
    ...originProps(data.dappDomain),
  });
};

export const trackSubmittedTransaction = (
  data: SubmittedTransactionEvent,
): void => {
  track(AnalyticsEvent.SUBMIT_TRANSACTION_SUCCESS, {
    ...originProps(data.dappDomain),
  });
};

export const trackSimulationError = (
  error: string,
  transactionType: SimulationTransactionType,
): void => {
  track(AnalyticsEvent.SIMULATE_TOKEN_PAYMENT_ERROR, {
    // Scrub Stellar StrKeys — simulation errors are free-text and Amplitude is
    // a third-party sink not covered by Sentry's beforeSend.
    reason_code: scrubStrKeys(error) ?? error,
    transaction_type: transactionType,
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
  // collectible_send.failed {reason_code}. operationType/isSwap/amounts dropped
  // for cross-platform parity. reason_code is the machine-readable Horizon
  // result code (op_underfunded, tx_insufficient_balance, ...), falling back to
  // the literal "unknown" — IDENTICAL to the extension's SubmitFail derivation
  // (`resultCodes.operations?.[0] || resultCodes.transaction || "unknown"`). We
  // deliberately do NOT fall back to the free-text error message: it produces
  // unbounded reason_code cardinality the extension never emits, poisoning a
  // shared payment/swap/collectible failure breakdown. The full message is still
  // captured by the logger / Sentry for debugging.
  const reasonCode = data.errorCode ?? "unknown";
  let props: Record<string, unknown> = { reason_code: reasonCode };
  if (event === AnalyticsEvent.SWAP_FAIL) {
    props = {
      from_asset_code: data.sourceToken,
      to_asset_code: data.destToken,
      reason_code: reasonCode,
    };
  } else if (event === AnalyticsEvent.SEND_PAYMENT_FAIL) {
    props.payment_type = "payment";
  }

  track(event, props);
};

// Mobile add/remove-token responses originate from the in-app manage-assets UI
// (there is no dApp add-token RPC on mobile), so source is fixed. The extension
// emits the same events with source:"dapp_api" for its injected-API prompt.
export const trackAddTokenConfirmed = (token?: string): void => {
  track(AnalyticsEvent.ASSET_ADD_RESPONDED, {
    decision: "confirm",
    asset_code: token,
    source: "manage_assets",
  });
};

export const trackAddTokenRejected = (token?: string): void => {
  track(AnalyticsEvent.ASSET_ADD_RESPONDED, {
    decision: "reject",
    asset_code: token,
    source: "manage_assets",
  });
};

export const trackRemoveTokenConfirmed = (token?: string): void => {
  track(AnalyticsEvent.ASSET_REMOVE_RESPONDED, {
    decision: "confirm",
    asset_code: token,
    source: "manage_assets",
  });
};

export const trackRemoveTokenRejected = (token?: string): void => {
  track(AnalyticsEvent.ASSET_REMOVE_RESPONDED, {
    decision: "reject",
    asset_code: token,
    source: "manage_assets",
  });
};

export const trackAccountScreenImportAccountFail = (error: string): void => {
  // Failure reason is carried on `reason_code` per the shared failure grammar
  // (matches the catalog note and the extension `account.import_failed` shape).
  // account.import_failed carries import_method. This helper is the
  // secret-key import path (mnemonic restore emits account_recovery.* instead).
  track(AnalyticsEvent.ACCOUNT_SCREEN_IMPORT_ACCOUNT_FAIL, {
    import_method: "secret_key",
    // Scrub inside the helper (not just at the caller): this is the secret-key
    // import path, so a failure message is the likeliest place to embed an S…
    // seed. Matches the other track*Error helpers.
    reason_code: scrubStrKeys(error) ?? error,
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
  track(AnalyticsEvent.GRANT_DAPP_ACCESS_SUCCESS, originProps(domain));
};

// User declined the connection prompt. dapp_access.rejected carries origin
// only — a user rejection has no failure reason_code (matches the extension).
export const trackGrantAccessFail = (domain?: string): void => {
  track(AnalyticsEvent.GRANT_DAPP_ACCESS_FAIL, originProps(domain));
};

// System auto-declined a connection (e.g. wallet not authenticated) — NOT a
// user decision, so it's a distinct event carrying the block reason_code.
export const trackGrantAccessBlocked = (
  domain?: string,
  reason?: string,
): void => {
  track(AnalyticsEvent.GRANT_DAPP_ACCESS_BLOCKED, {
    ...originProps(domain),
    reason_code: reason,
  });
};

// earn_deposit.completed carries asset_code + pool_id + apy. NO amount/fiat
// value -- product decision (matches payment.completed / swap.completed's
// no-amount shape), non-negotiable per the cross-platform funnel agreement.
export const trackEarnDepositSuccess = (
  data: EarnDepositSuccessEvent,
): void => {
  track(AnalyticsEvent.EARN_DEPOSIT_SUCCESS, {
    asset_code: data.assetCode,
    pool_id: data.poolId,
    apy: data.apy,
  });
};

// earn_deposit.failed carries the same identifiers plus reason_code. Like
// trackTransactionError, reason_code is the machine-readable Horizon result
// code (falling back to "unknown") -- never the free-text error message, to
// avoid unbounded reason_code cardinality.
export const trackEarnDepositFail = (data: EarnDepositErrorEvent): void => {
  track(AnalyticsEvent.EARN_DEPOSIT_FAIL, {
    asset_code: data.assetCode,
    pool_id: data.poolId,
    apy: data.apy,
    reason_code: data.errorCode ?? "unknown",
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

export const trackReAuthFail = (reasonCode?: string): void => {
  // reason_code parity with the extension's reauth.failed; callers must scrub
  // StrKeys before passing native error text.
  trackAuthEvent(
    AnalyticsEvent.RE_AUTH_FAIL,
    reasonCode ? { reason_code: reasonCode } : undefined,
  );
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
  // Scrub StrKeys — QR payloads routinely carry G…/S… keys, so a scan-error
  // message can echo one into Amplitude (a third-party sink).
  track(AnalyticsEvent.QR_SCAN_ERROR, {
    context,
    reason_code: scrubStrKeys(error) ?? error,
  });
};
