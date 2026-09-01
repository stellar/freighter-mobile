import { AnalyticsEvent } from "config/analyticsConfig";
import { getDisplayHost } from "helpers/protocols";
import { scrubStrKeys } from "helpers/stellarStrKey";
import {
  AssetKind,
  buildSourceLegUsdProps,
  LegUsdStatus,
} from "helpers/usdVolume";
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

/** Flattens an `AssetIdentity` under the given property prefix (e.g. `asset_` -> `asset_issuer`/`asset_type`, `from_` -> `from_asset_issuer`/`from_asset_type`). Issuer omitted for native XLM. */
const assetIdentityProps = (
  prefix: string,
  identity: { issuer?: string; type: AssetKind },
): Record<string, unknown> => ({
  ...(identity.issuer ? { [`${prefix}asset_issuer`]: identity.issuer } : {}),
  [`${prefix}asset_type`]: identity.type,
});

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

  const { volume } = data;
  track(AnalyticsEvent.SEND_PAYMENT_SUCCESS, {
    payment_type: "payment",
    asset_code: data.sourceToken,
    ...(volume
      ? {
          ...assetIdentityProps("", volume.identity),
          amount: volume.amount,
          ...buildSourceLegUsdProps(
            volume.sourceLeg,
            volume.priceSource,
            volume.priceFreshness,
          ),
        }
      : {}),
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
  const { volume } = data;
  track(AnalyticsEvent.SWAP_SUCCESS, {
    from_asset_code: data.sourceToken,
    to_asset_code: data.destToken,
    ...(volume
      ? {
          ...assetIdentityProps("from_", volume.identity),
          ...assetIdentityProps("to_", volume.toIdentity),
          from_amount: volume.amount,
          ...(volume.toAmountQuoted !== undefined
            ? { to_amount_quoted: volume.toAmountQuoted }
            : {}),
          ...(volume.toAmount !== undefined
            ? { to_amount: volume.toAmount }
            : {}),
          to_amount_usd_status: volume.toAmountUsdStatus,
          ...(volume.toAmountUsdStatus === LegUsdStatus.OK
            ? {
                to_amount_usd: volume.toAmountUsd,
                to_amount_usd_rate: volume.toAmountUsdRate,
              }
            : {}),
          ...(volume.usdSlippagePct !== undefined
            ? { usd_slippage_pct: volume.usdSlippagePct }
            : {}),
          ...(volume.executionSlippagePct !== undefined
            ? { execution_slippage_pct: volume.executionSlippagePct }
            : {}),
          ...buildSourceLegUsdProps(
            volume.sourceLeg,
            volume.priceSource,
            volume.priceFreshness,
          ),
        }
      : {}),
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
  // collectible_send.failed {reason_code}. operationType/isSwap dropped for
  // cross-platform parity. reason_code is the machine-readable Horizon result
  // code (op_underfunded, tx_insufficient_balance, ...), falling back to the
  // literal "unknown" — IDENTICAL to the extension's derivation, and (via
  // `data.volume.reasonCode`, `usdVolume.pickReasonCode`) picking the first
  // code that isn't a changeTrust no-op marker rather than always index 0. We
  // deliberately do NOT fall back to the free-text error message: it produces
  // unbounded reason_code cardinality the extension never emits, poisoning a
  // shared payment/swap/collectible failure breakdown. The full message is still
  // captured by the logger / Sentry for debugging.
  const { volume } = data;
  const reasonCode = volume?.reasonCode ?? data.errorCode ?? "unknown";
  let props: Record<string, unknown> = { reason_code: reasonCode };
  if (event === AnalyticsEvent.SWAP_FAIL) {
    props = {
      from_asset_code: data.sourceToken,
      to_asset_code: data.destToken,
      reason_code: reasonCode,
      ...(volume
        ? {
            ...assetIdentityProps("from_", volume.identity),
            ...(volume.toIdentity
              ? assetIdentityProps("to_", volume.toIdentity)
              : {}),
            // swap.failed carries the source token amount only — no
            // destination amount/USD, since nothing settled to measure.
            from_amount: volume.amount,
            failure_category: volume.failureCategory,
            ...buildSourceLegUsdProps(
              volume.sourceLeg,
              volume.priceSource,
              volume.priceFreshness,
            ),
          }
        : {}),
    };
  } else if (event === AnalyticsEvent.SEND_PAYMENT_FAIL) {
    props.payment_type = "payment";
    // asset_code is known even when there is no volume data (a pre-submit
    // failure), and it is the property payment.failed shares with
    // payment.completed — keep it outside the volume gate.
    if (data.sourceToken) {
      props.asset_code = data.sourceToken;
    }
    if (volume) {
      props = {
        ...props,
        ...assetIdentityProps("", volume.identity),
        amount: volume.amount,
        failure_category: volume.failureCategory,
        ...buildSourceLegUsdProps(
          volume.sourceLeg,
          volume.priceSource,
          volume.priceFreshness,
        ),
      };
    }
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
