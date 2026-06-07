/* eslint-disable @fnando/consistent-import/consistent-import */
import { renderHook } from "@testing-library/react-hooks";
import { useSwapSecurityAssessments } from "components/screens/SwapScreen/hooks/useSwapSecurityAssessments";
import { NATIVE_TOKEN_CODE } from "config/constants";
import { TokenTypeWithCustomToken } from "config/types";
import { SecurityLevel } from "services/blockaid/constants";

// Stable t-function reference (defined INSIDE the factory to survive
// jest.mock hoisting — see useSwapAmountError.test.ts for the long form).
jest.mock("hooks/useAppTranslation", () => {
  const stableT = (key: string) => key;
  const stableTranslation = { t: stableT };
  return {
    __esModule: true,
    default: () => stableTranslation,
  };
});

// We DON'T mock the blockaid helper itself — its logic IS the contract
// we're verifying (synthesizeScanFromLevel fallback, isUnableToScan
// classification, extractSecurityWarnings flattening). Using the real
// helper makes these tests sensitive to real regressions, which is
// what we want for a security-critical hook.

// Hoisted stable references so the hook's useMemo deps stay stable
// across renders.
const baseSourceBalance = {
  id: "USDC:GA5",
  tokenCode: "USDC",
  tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
} as never;

const xlmSourceBalance = {
  id: NATIVE_TOKEN_CODE,
  tokenCode: NATIVE_TOKEN_CODE,
  tokenType: TokenTypeWithCustomToken.NATIVE,
} as never;

const baseDestinationDescriptor = {
  id: "AQUA:GBNZIL",
  tokenCode: "AQUA",
  decimals: 7,
  tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
  isNew: false,
};

const xlmDestinationDescriptor = {
  id: NATIVE_TOKEN_CODE,
  tokenCode: NATIVE_TOKEN_CODE,
  decimals: 7,
  tokenType: TokenTypeWithCustomToken.NATIVE,
  isNew: false,
};

const EMPTY_SCAN_RESULTS = {};

type HookProps = Parameters<typeof useSwapSecurityAssessments>[0];

const baseProps: HookProps = {
  transactionScanResult: undefined,
  overriddenBlockaidResponse: null,
  sourceBalance: baseSourceBalance,
  destinationBalance: undefined,
  destinationTokenDescriptor: baseDestinationDescriptor,
  scanResults: EMPTY_SCAN_RESULTS,
  sourceTokenId: "USDC",
};

describe("useSwapSecurityAssessments", () => {
  describe("synthesizeScanFromLevel fallback for non-held destinations", () => {
    it("falls back to descriptor.securityLevel=MALICIOUS when destination is non-held", () => {
      const { result } = renderHook(() =>
        useSwapSecurityAssessments({
          ...baseProps,
          destinationBalance: undefined,
          destinationTokenDescriptor: {
            ...baseDestinationDescriptor,
            securityLevel: SecurityLevel.MALICIOUS,
          },
        }),
      );

      expect(result.current.destBalanceSecurityAssessment.isMalicious).toBe(
        true,
      );
      expect(result.current.isMalicious).toBe(true);
      expect(result.current.securityWarnings.length).toBeGreaterThanOrEqual(0);
    });

    it("falls back to descriptor.securityLevel=SUSPICIOUS when destination is non-held", () => {
      const { result } = renderHook(() =>
        useSwapSecurityAssessments({
          ...baseProps,
          destinationBalance: undefined,
          destinationTokenDescriptor: {
            ...baseDestinationDescriptor,
            securityLevel: SecurityLevel.SUSPICIOUS,
          },
        }),
      );

      expect(result.current.destBalanceSecurityAssessment.isSuspicious).toBe(
        true,
      );
      expect(result.current.isSuspicious).toBe(true);
    });

    it("treats non-held destination as UNABLE_TO_SCAN when descriptor has no securityLevel (synthesize returns undefined)", () => {
      const { result } = renderHook(() =>
        useSwapSecurityAssessments({
          ...baseProps,
          destinationBalance: undefined,
          destinationTokenDescriptor: {
            ...baseDestinationDescriptor,
            // no securityLevel
          },
        }),
      );

      // Missing scanResult → UNABLE_TO_SCAN per assessTokenSecurity contract.
      expect(result.current.destBalanceSecurityAssessment.isUnableToScan).toBe(
        true,
      );
    });
  });

  describe("native-XLM exclusion from showSecurityWarning*", () => {
    it("suppresses showSecurityWarningForSource when sourceTokenId === NATIVE_TOKEN_CODE", () => {
      const { result } = renderHook(() =>
        useSwapSecurityAssessments({
          ...baseProps,
          sourceBalance: xlmSourceBalance,
          sourceTokenId: NATIVE_TOKEN_CODE,
        }),
      );

      // XLM has no scanResult entry → assessTokenSecurity returns
      // isUnableToScan=true. But the hook suppresses the gate.
      expect(
        result.current.sourceBalanceSecurityAssessment.isUnableToScan,
      ).toBe(true);
      expect(result.current.showSecurityWarningForSource).toBe(false);
    });

    it("suppresses showSecurityWarningForDestination when descriptor.id === NATIVE_TOKEN_CODE", () => {
      const { result } = renderHook(() =>
        useSwapSecurityAssessments({
          ...baseProps,
          destinationTokenDescriptor: xlmDestinationDescriptor,
        }),
      );

      expect(result.current.destBalanceSecurityAssessment.isUnableToScan).toBe(
        true,
      );
      expect(result.current.showSecurityWarningForDestination).toBe(false);
    });

    it("isUnableToScan is false when both sides are XLM", () => {
      const { result } = renderHook(() =>
        useSwapSecurityAssessments({
          ...baseProps,
          sourceBalance: xlmSourceBalance,
          sourceTokenId: NATIVE_TOKEN_CODE,
          destinationTokenDescriptor: xlmDestinationDescriptor,
        }),
      );

      expect(result.current.isUnableToScan).toBe(false);
    });

    it("isUnableToScan stays true for a non-XLM unscannable side even when the other is XLM", () => {
      const { result } = renderHook(() =>
        useSwapSecurityAssessments({
          ...baseProps,
          sourceBalance: xlmSourceBalance,
          sourceTokenId: NATIVE_TOKEN_CODE,
          // destination is non-held + no securityLevel → unable-to-scan
          destinationTokenDescriptor: { ...baseDestinationDescriptor },
        }),
      );

      expect(result.current.showSecurityWarningForSource).toBe(false);
      expect(result.current.showSecurityWarningForDestination).toBe(true);
      expect(result.current.isUnableToScan).toBe(true);
    });
  });

  describe("securityWarnings aggregation across scanResults", () => {
    it("includes a warning per unable-to-scan side", () => {
      const { result } = renderHook(() =>
        useSwapSecurityAssessments({
          ...baseProps,
          // Both sides unscannable + not XLM
          sourceBalance: baseSourceBalance, // not in scanResults
          sourceTokenId: "USDC",
          destinationTokenDescriptor: { ...baseDestinationDescriptor },
        }),
      );

      const ids = result.current.securityWarnings.map((w) => w.id);
      expect(ids).toContain("unable-to-scan-source");
      expect(ids).toContain("unable-to-scan-destination");
    });

    it("returns empty warnings when both sides are XLM and there's no transaction scan", () => {
      const { result } = renderHook(() =>
        useSwapSecurityAssessments({
          ...baseProps,
          sourceBalance: xlmSourceBalance,
          sourceTokenId: NATIVE_TOKEN_CODE,
          destinationTokenDescriptor: xlmDestinationDescriptor,
        }),
      );

      expect(result.current.securityWarnings).toEqual([]);
    });

    it("does NOT include warnings from non-source/non-dest held tokens (over-aggregation regression)", () => {
      // This locks in the fix for the original bug:
      // `Object.values(scanResults).map(extractSecurityWarnings)` used to
      // dump warnings from EVERY held token's scan, so a swap with a
      // malicious destination would surface every other held token's
      // benign features. The fix scopes extraction to source + dest only.
      const otherHeldTokenScan = {
        result_type: "Malicious",
        features: [
          {
            feature_id: "KNOWN_MALICIOUS",
            type: "Malicious",
            description: "OTHER HELD TOKEN — must not appear in swap warnings",
          },
        ],
      } as never;

      const maliciousDestScan = {
        result_type: "Malicious",
        features: [
          {
            feature_id: "KNOWN_MALICIOUS",
            type: "Malicious",
            description:
              "An identified malicious address is associated with the token.",
          },
        ],
      } as never;

      const destDescriptor = {
        ...baseDestinationDescriptor,
        id: "XRP:GBXRPL45",
      };
      const destBalance = {
        id: "XRP:GBXRPL45",
        tokenCode: "XRP",
        tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
      } as never;

      const { result } = renderHook(() =>
        useSwapSecurityAssessments({
          ...baseProps,
          sourceBalance: xlmSourceBalance,
          sourceTokenId: NATIVE_TOKEN_CODE,
          destinationBalance: destBalance,
          destinationTokenDescriptor: destDescriptor,
          scanResults: {
            // Scan keyed exactly like balances.ts produces — id.replace(":", "-")
            "XRP-GBXRPL45": maliciousDestScan,
            "USDC-GA5": otherHeldTokenScan,
            "AQUA-GBNZIL": otherHeldTokenScan,
            "EURC-GDABC": otherHeldTokenScan,
          },
        }),
      );

      const descriptions = result.current.securityWarnings.map(
        (w) => w.description,
      );
      // Only the destination's malicious reason should appear; the
      // other-held-token reasons must be filtered out.
      expect(descriptions).toEqual([
        "An identified malicious address is associated with the token.",
      ]);
    });

    it("dedupes by warning id when source and dest yield the same feature_id (keeps malicious over warning on collision)", () => {
      const sourceScan = {
        result_type: "Warning",
        features: [
          {
            feature_id: "HIGH_TRANSFER_FEE",
            type: "Warning",
            description: "Transfer fee is unusually high",
          },
        ],
      } as never;
      const destScan = {
        result_type: "Malicious",
        features: [
          {
            feature_id: "HIGH_TRANSFER_FEE",
            type: "Malicious",
            description: "Transfer fee is unusually high",
          },
        ],
      } as never;

      const sourceBalance = {
        id: "USDC:GA5",
        tokenCode: "USDC",
        tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
      } as never;
      const destBalance = {
        id: "XRP:GBXRPL45",
        tokenCode: "XRP",
        tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
      } as never;
      const destDescriptor = {
        ...baseDestinationDescriptor,
        id: "XRP:GBXRPL45",
      };

      const { result } = renderHook(() =>
        useSwapSecurityAssessments({
          ...baseProps,
          sourceBalance,
          sourceTokenId: "USDC",
          destinationBalance: destBalance,
          destinationTokenDescriptor: destDescriptor,
          scanResults: {
            "USDC-GA5": sourceScan,
            "XRP-GBXRPL45": destScan,
          },
        }),
      );

      const ids = result.current.securityWarnings.map((w) => w.id);
      expect(ids).toEqual(["HIGH_TRANSFER_FEE"]);
      // Malicious wins over Warning on collision (worst-of-N).
      expect(result.current.securityWarnings[0].severity).toBe("malicious");
    });

    it('stamps severity="warning" on synthetic unable-to-scan-* warnings', () => {
      const { result } = renderHook(() =>
        useSwapSecurityAssessments({
          ...baseProps,
          sourceBalance: baseSourceBalance,
          sourceTokenId: "USDC",
          destinationTokenDescriptor: { ...baseDestinationDescriptor },
        }),
      );

      const synthetic = result.current.securityWarnings.filter((w) =>
        w.id.startsWith("unable-to-scan-"),
      );
      expect(synthetic.length).toBe(2);
      synthetic.forEach((w) => {
        expect(w.severity).toBe("warning");
      });
    });
  });

  describe("transactionSecuritySeverity", () => {
    it("returns undefined when none of the gates trip", () => {
      const { result } = renderHook(() =>
        useSwapSecurityAssessments({
          ...baseProps,
          sourceBalance: xlmSourceBalance,
          sourceTokenId: NATIVE_TOKEN_CODE,
          destinationTokenDescriptor: xlmDestinationDescriptor,
        }),
      );

      expect(result.current.transactionSecuritySeverity).toBeUndefined();
    });

    it("returns UNABLE_TO_SCAN when isUnableToScan but tx-level assessment is unable-to-scan (no tx scan)", () => {
      const { result } = renderHook(() =>
        useSwapSecurityAssessments({
          ...baseProps,
          // dest non-held + no securityLevel → unable
          destinationTokenDescriptor: { ...baseDestinationDescriptor },
        }),
      );

      // tx severity is derived: malicious > suspicious > unable.
      // No transactionScanResult → assessTransactionSecurity returns
      // isMalicious=false, isSuspicious=false, so it falls through to
      // the UNABLE_TO_SCAN branch driven by token-side isUnableToScan.
      expect(result.current.transactionSecuritySeverity).toBe(
        SecurityLevel.UNABLE_TO_SCAN,
      );
    });

    it("prefers MALICIOUS over SUSPICIOUS / UNABLE_TO_SCAN", () => {
      const { result } = renderHook(() =>
        useSwapSecurityAssessments({
          ...baseProps,
          overriddenBlockaidResponse: SecurityLevel.MALICIOUS,
        }),
      );

      // Override drives BOTH tx + token assessments to MALICIOUS.
      expect(result.current.transactionSecuritySeverity).toBe(
        SecurityLevel.MALICIOUS,
      );
    });
  });
});
