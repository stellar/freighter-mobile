import BigNumber from "bignumber.js";
import { AWAITED_DEPOSIT_MS } from "components/screens/PositionsScreen/helpers/awaitedDeposit";
import { NETWORKS, mapNetworkToNetworkDetails } from "config/constants";
import { logger } from "config/logger";
import { PricedBalance } from "config/types";
import { ActiveAccount } from "ducks/auth";
import { useBalancesStore } from "ducks/balances";
import { useEarnStore } from "ducks/earn";
import { usePositionsStore } from "ducks/positions";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { formatTokenIdentifier, getTokenIdentifier } from "helpers/balances";
import { startConfirmationPriceSnapshot } from "helpers/confirmationPriceSnapshot";
import {
  canonicalIdFromIdentity,
  classifyAssetIdentity,
  deriveLegUsd,
  getFailureCategory,
  pickReasonCode,
} from "helpers/usdVolume";
import { isWalletUnlocked } from "hooks/useGetActiveAccount";
import { useCallback, useEffect, useRef, useState } from "react";
import { analytics } from "services/analytics";
import { PaymentVolume } from "services/analytics/types";

export type EarnTransactionStatus = "idle" | "submitting" | "success" | "error";

/** What Confirm deposits, as Review showed it. */
export interface EarnDepositSubmission {
  /** The amount the staged deposit was built with. */
  amount: string;
  /**
   * The balance being deposited. Its price is the one Review showed, which
   * the deposit's USD value falls back to.
   */
  balance: PricedBalance | undefined;
}

/**
 * Starts measuring a deposit's USD volume the way Send measures a payment's:
 * one price fetch, begun once signing has succeeded and right before the
 * submit, falling back to the price Review showed. `resolve()` freezes the
 * volume for the outcome event; `cancel()` drops the fetch of a deposit that
 * never reached the network. Null when the deposited balance is missing.
 */
const startDepositVolume = (
  { amount, balance }: EarnDepositSubmission,
  network: NETWORKS,
) => {
  if (!balance) {
    return null;
  }

  const { tokenCode, issuer } = formatTokenIdentifier(
    getTokenIdentifier(balance),
  );
  // The balance is the held token the reserve's contract wraps, so a deposit
  // is reported under the identity a payment of that token would have.
  const identity = classifyAssetIdentity(
    tokenCode,
    issuer || undefined,
    mapNetworkToNetworkDetails(network),
    Object.values(useBalancesStore.getState().balances),
  );
  const canonicalId = canonicalIdFromIdentity(identity);
  const snapshotHandle = startConfirmationPriceSnapshot({
    canonicalIds: [canonicalId],
    network,
    cachedDisplayPrices: {
      [canonicalId]: { currentPrice: balance.currentPrice ?? null },
    },
  });

  return {
    resolve: (): PaymentVolume => {
      const snapshot = snapshotHandle.resolve();
      return {
        identity,
        amount: new BigNumber(amount || 0).toNumber(),
        sourceLeg: deriveLegUsd(
          amount,
          snapshot.pricesById?.[canonicalId]?.currentPrice,
        ),
        priceSource: snapshot.source,
        priceFreshness: snapshot.freshness,
      };
    },
    cancel: () => snapshotHandle.cancel(),
  };
};

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
   *
   * `submission` is what Review showed: the outcome events report its
   * amount and USD value as the deposit's volume.
   */
  submit: (submission: EarnDepositSubmission) => Promise<void>;
  /**
   * Returns `status` to "idle". This is not part of the brief's literal
   * `{ submit, status, transactionHash, error }` shape, but is needed to
   * drop back to the normal amount screen on failure: without it,
   * `EarnAmountScreen`'s inline gate (`status === "submitting" ||
   * "success"`) would have no way back from "error". Called automatically by
   * an effect in `EarnAmountScreen` as soon as `status` becomes "error",
   * which also shows the failure's toast — the design has no failure screen
   * with a user-facing "back to amount" button for this to live behind.
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
   * settles, it will skip writing `status`/`error`/`transactionHash`, so a
   * submit abandoned by navigating Home mid-flight can't resolve later into
   * a failure toast the user has left behind. Its outcome is still reported
   * to analytics, as the extension does.
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
 * `submit()` guards every state write behind an active-request check — see
 * `abandon()` — so a submit the user has already closed away from cannot
 * resolve later and report a failure they never see the context of.
 */
export const useEarnTransaction = ({
  account,
  network,
}: UseEarnTransactionParams): UseEarnTransactionResult => {
  const [status, setStatus] = useState<EarnTransactionStatus>("idle");
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { signTransaction, submitTransaction } = useTransactionBuilderStore();

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

  const submit = useCallback(
    async (submission: EarnDepositSubmission) => {
      if (!account) {
        return;
      }

      nextRequestIdRef.current += 1;
      const requestId = nextRequestIdRef.current;
      activeRequestIdRef.current = requestId;

      // The outcome is reported even when the user closes before it settles,
      // and leaving Earn resets the earn duck, so read what the deposit is
      // about now.
      const {
        pool,
        selectedAssetId,
        selectedAssetCode,
        selectedAssetApy,
        selectedAssetDecimals,
        currentPositionTokens,
        didSwapInFlow,
        source,
      } = useEarnStore.getState();
      const depositIdentifiers = {
        assetCode: selectedAssetCode,
        poolId: pool?.id,
        source,
      };

      setStatus("submitting");
      setError(null);
      setTransactionHash(null);

      // Declared outside the try so the catch can drop the price fetch of a
      // deposit that never reached the network.
      let depositVolume: ReturnType<typeof startDepositVolume> = null;
      try {
        // Abort cleanly if an auto-lock engaged after Review was confirmed.
        // Return (don't throw): being locked isn't a deposit failure, so skip
        // the catch's error path — a hard-coded throw would
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
          // The signing action failed after the user approved at Review: a
          // fault, not a decision. Reported as Send and Swap report it.
          analytics.trackInternalSignedTransactionError(signingError);
          throw new Error(signingError || "Failed to sign transaction");
        }

        // A signature exists, so the signing action succeeded.
        analytics.trackInternalSignedTransaction();

        depositVolume = startDepositVolume(submission, network);

        // submitTransaction throws only for the debug forced-failure override;
        // otherwise it resolves with this attempt's own outcome. Read the
        // reason and result codes off that outcome, never off the store: a
        // mid-submit Close resets the store, so it may not hold this attempt's
        // result.
        const submitOutcome = await submitTransaction({ network });
        const volume = depositVolume?.resolve();
        const { hash } = submitOutcome;

        if (!hash) {
          // The first result code that explains the failure, as on
          // payment.failed.
          const reasonCode = pickReasonCode(submitOutcome.resultCodes);
          analytics.trackEarnDepositFail({
            ...depositIdentifiers,
            errorCode: reasonCode,
            volume: volume && {
              ...volume,
              reasonCode,
              failureCategory: getFailureCategory(
                submitOutcome.isProtocolAnswer,
                submitOutcome.httpStatus,
                reasonCode,
              ),
            },
          });

          // The `await` above is the abandonment window (see below).
          if (activeRequestIdRef.current !== requestId) {
            return;
          }

          // As in Swap: the transaction builder store logs a failed submit at
          // the right level, so it isn't logged again here.
          setError(submitOutcome.error || "Failed to submit transaction");
          setStatus("error");
          return;
        }

        // Only the success carries the APY, as in the extension.
        analytics.trackEarnDepositSuccess({
          ...depositIdentifiers,
          apy: selectedAssetApy,
          viaSwap: didSwapInFlow,
          volume,
        });

        // The positions indexer can lag a landed deposit, so Home's Positions
        // re-reads until the row shows it (see AwaitedDeposit). Recorded even
        // when the user closed away, which is when Home needs it most, and
        // never allowed to turn a landed deposit into a failure.
        if (pool) {
          try {
            usePositionsStore.getState().setAwaitedDeposit({
              publicKey: account.publicKey,
              network,
              poolId: pool.id,
              assetId: selectedAssetId,
              minTokens: new BigNumber(currentPositionTokens || "0")
                .shiftedBy(-selectedAssetDecimals)
                .plus(new BigNumber(submission.amount).dividedBy(2))
                .toFixed(),
              expiresAt: Date.now() + AWAITED_DEPOSIT_MS,
            });
          } catch (awaitError) {
            logger.error(
              "useEarnTransaction",
              "Failed to record the awaited deposit",
              awaitError,
            );
          }
        }

        // The `await` above is the abandonment window: the user may have
        // closed away from this submit (or, in principle, started another)
        // while it was in flight. Skip every write below if so.
        if (activeRequestIdRef.current !== requestId) {
          return;
        }

        setTransactionHash(hash);
        setStatus("success");
      } catch (err) {
        // Signing failed, or the debug override threw: the deposit never
        // reached the network, so there's no volume and no result code to
        // report (reason_code falls back to "unknown", as on Send), and its
        // price fetch is dropped.
        depositVolume?.cancel();
        analytics.trackEarnDepositFail(depositIdentifiers);

        if (activeRequestIdRef.current !== requestId) {
          return;
        }

        const message = err instanceof Error ? err.message : String(err);
        // As in Swap: the transaction builder store logs signing and submit
        // failures at the right level (a network rejection with result codes
        // is a warn breadcrumb, anything else an error). Logging again here
        // would send each one to Sentry twice. The amount screen shows the
        // user a plain error toast.
        setError(message);
        setStatus("error");
      }
    },
    [account, network, signTransaction, submitTransaction],
  );

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
