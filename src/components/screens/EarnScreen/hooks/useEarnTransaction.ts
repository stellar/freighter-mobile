import { NETWORKS } from "config/constants";
import { logger } from "config/logger";
import { ActiveAccount } from "ducks/auth";
import { useEarnStore } from "ducks/earn";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { isWalletUnlocked } from "hooks/useGetActiveAccount";
import { useCallback, useEffect, useRef, useState } from "react";
import { analytics } from "services/analytics";

export type EarnTransactionStatus = "idle" | "submitting" | "success" | "error";

interface UseEarnTransactionParams {
  account: ActiveAccount | null;
  network: NETWORKS;
}

interface UseEarnTransactionResult {
  status: EarnTransactionStatus;
  transactionHash: string | null;
  error: string | null;
  /**
   * Signs and submits the deposit XDR already staged in `transactionBuilder`
   * (built by `useSimulateEarnDeposit` and confirmed to still match the
   * displayed amount by `EarnAmountScreen`'s CTA handler before Review ever
   * opened — see the INVARIANT comment there). No staleness re-check happens
   * here by design; that invariant is what makes one unnecessary.
   *
   * Setting `status` to "submitting" IS the processing flag:
   * `EarnAmountScreen` renders its inline `EarnProcessingScreen` whenever
   * `status` is "submitting" or "success", so calling `submit()` both flips
   * that flag and kicks off the sign/submit work in a single call.
   */
  submit: () => Promise<void>;
  /**
   * Returns `status` to "idle" without touching the earn duck. This is not
   * part of the brief's literal `{ submit, status, transactionHash, error }`
   * shape, but is needed to drop back to the normal amount screen on
   * failure: without it, `EarnAmountScreen`'s inline gate (`status ===
   * "submitting" || "success"`) would have no way back from "error", where
   * `lastSubmitFailed` (already set by the failed `submit()` below) drives
   * the retry banner. Called automatically by an effect in
   * `EarnAmountScreen` as soon as `status` becomes "error" — the design has
   * no failure screen with a user-facing "back to amount" button for this to
   * live behind.
   *
   * A no-op while `status === "submitting"` — there is no call site that
   * reaches `reset()` mid-submit today (the only caller fires on the
   * "error" transition), but this closes off that class of bug rather than
   * relying on today's single call site staying that way. Abandoning an
   * in-flight submit is `abandon()`'s job, not this one's.
   */
  reset: () => void;
  /**
   * Marks any submit currently in flight as abandoned: when it eventually
   * settles, it will skip writing `status`/`error`/`transactionHash` AND
   * `useEarnStore.setSubmitFailed` — the latter is what makes this
   * necessary. `setSubmitFailed` writes to a store that is global and
   * persists across mounts, so without this guard a submit abandoned by
   * navigating Home mid-flight could resolve later and flip
   * `lastSubmitFailed` out of order, surfacing a misleading retry banner in
   * an unrelated later Earn session.
   *
   * Mirrors the `get().requestId === newRequestId` guard already used
   * around every async write in `ducks/transactionBuilder.ts` (see e.g. its
   * `buildTransaction`/`submitTransaction`), except the comparison lives in
   * a ref here rather than the (also global) transactionBuilder store,
   * since `useEarnTransaction`'s status/hash/error are local to this hook.
   *
   * Called both from this hook's own unmount cleanup (defense in depth —
   * unmount timing during a navigation transition isn't guaranteed to be
   * synchronous) and explicitly by
   * `EarnAmountScreen.handleCloseEarnProcessingWhileSubmitting`, so the
   * abandonment is recorded at the moment the user acts, not only whenever
   * React gets around to tearing the component down.
   */
  abandon: () => void;
}

/**
 * Signs and submits an Earn deposit. Mirrors `useSwapTransaction`'s
 * sign/submit path (biometrics guard, error sourcing from the
 * `transactionBuilder` store) but has no build/scan step of its own — that
 * already happened in `useSimulateEarnDeposit` by the time this runs.
 *
 * Failure is recorded in `useEarnStore.lastSubmitFailed` rather than
 * component state because it is set here, on the processing screen, and
 * read after the stack pops back to `EarnAmountScreen` — component state
 * would be torn down in between. Because that store is global and
 * persistent, `submit()` guards every write to it (and to local state)
 * behind an active-request check — see `abandon()` — so a submit that the
 * user has already closed away from cannot resolve later and corrupt a
 * subsequent session's retry banner.
 */
export const useEarnTransaction = ({
  account,
  network,
}: UseEarnTransactionParams): UseEarnTransactionResult => {
  const [status, setStatus] = useState<EarnTransactionStatus>("idle");
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { signTransaction, submitTransaction } = useTransactionBuilderStore();
  const setSubmitFailed = useEarnStore((state) => state.setSubmitFailed);

  // `nextRequestIdRef` hands out a fresh id per `submit()` call;
  // `activeRequestIdRef` names the id (if any) still allowed to write
  // state. `abandon()` — and this hook's own unmount cleanup below — clear
  // the latter, so a submit whose id no longer matches skips its writes
  // entirely when it settles. Local to this hook (unlike
  // `transactionBuilder.ts`'s equivalent, which lives on its shared store),
  // since nothing outside this hook needs to read it.
  const nextRequestIdRef = useRef(0);
  const activeRequestIdRef = useRef<number | null>(null);

  const abandon = useCallback(() => {
    activeRequestIdRef.current = null;
  }, []);

  // Defense in depth alongside the explicit `abandon()` call from
  // `handleCloseEarnProcessingWhileSubmitting`: if this hook's owning
  // component unmounts for any other reason while a submit is in flight,
  // that submit is abandoned too.
  useEffect(
    () => () => {
      activeRequestIdRef.current = null;
    },
    [],
  );

  const submit = useCallback(async () => {
    if (!account) {
      return;
    }

    nextRequestIdRef.current += 1;
    const requestId = nextRequestIdRef.current;
    activeRequestIdRef.current = requestId;

    setStatus("submitting");
    setError(null);
    setTransactionHash(null);

    try {
      // Abort cleanly if an auto-lock engaged after Review was confirmed.
      // Return (don't throw): being locked isn't a deposit failure, so skip
      // the catch's setSubmitFailed/error path — a hard-coded throw would
      // also surface as a non-localized error message. Verbatim guard from
      // `useSwapTransaction.executeSwap`. No await has happened yet at this
      // point, so there is no abandonment window to check for here.
      if (!isWalletUnlocked()) {
        setStatus("idle");
        return;
      }

      const signedXDR = signTransaction({
        secretKey: account.privateKey,
        network,
      });

      if (!signedXDR) {
        // Read the real reason off the store rather than inventing one.
        const { error: signingError } = useTransactionBuilderStore.getState();
        throw new Error(signingError || "Failed to sign transaction");
      }

      // submitTransaction throws directly for the debug forced-failure
      // override, and returns null for every other recorded failure — both
      // land in this catch block. On null, read the real reason (and result
      // codes) off the store rather than inventing a message.
      const hash = await submitTransaction({ network });

      if (!hash) {
        const { error: submitError } = useTransactionBuilderStore.getState();
        throw new Error(submitError || "Failed to submit transaction");
      }

      // The `await` above is the abandonment window: the user may have
      // closed away from this submit (or, in principle, started another)
      // while it was in flight. Skip every write below — including
      // `setSubmitFailed`, the global/persistent one — if so.
      if (activeRequestIdRef.current !== requestId) {
        return;
      }

      setTransactionHash(hash);
      setSubmitFailed(false);
      setStatus("success");

      // No amount/fiat value on this event by design (product decision,
      // non-negotiable) -- only the identifiers, matching payment.completed /
      // swap.completed's shape.
      const { pool, selectedAssetCode, selectedAssetApy } =
        useEarnStore.getState();
      analytics.trackEarnDepositSuccess({
        assetCode: selectedAssetCode,
        poolId: pool?.id,
        apy: selectedAssetApy,
      });
    } catch (err) {
      if (activeRequestIdRef.current !== requestId) {
        return;
      }

      const message = err instanceof Error ? err.message : String(err);
      logger.error("useEarnTransaction", "Deposit submission failed", err);
      setError(message);
      setSubmitFailed(true);
      setStatus("error");

      // `submitErrorResultCodes` isn't threaded through this hook's own
      // return shape (see the hook doc), so read it directly off the store,
      // same as the sign/submit failure branches above. Null for a signing
      // failure (there's no Horizon result yet) -- reason_code falls back to
      // "unknown" in that case, same as trackTransactionError elsewhere.
      const { pool, selectedAssetCode, selectedAssetApy } =
        useEarnStore.getState();
      const { submitErrorResultCodes } = useTransactionBuilderStore.getState();
      analytics.trackEarnDepositFail({
        assetCode: selectedAssetCode,
        poolId: pool?.id,
        apy: selectedAssetApy,
        errorCode:
          submitErrorResultCodes?.operations?.[0] ||
          submitErrorResultCodes?.transaction,
      });
    }
  }, [account, network, signTransaction, submitTransaction, setSubmitFailed]);

  const reset = useCallback(() => {
    // No call site reaches this mid-submit today (the only caller renders
    // solely in the "error" state), but a no-op here closes off the whole
    // bug class rather than relying on that staying true. Abandoning an
    // in-flight submit is `abandon()`'s job.
    if (status === "submitting") {
      return;
    }

    setStatus("idle");
    setError(null);
  }, [status]);

  return { status, transactionHash, error, submit, reset, abandon };
};
