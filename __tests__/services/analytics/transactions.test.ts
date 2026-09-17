import { AnalyticsEvent } from "config/analyticsConfig";
import {
  trackSignedAuthEntryError,
  trackSignedMessageError,
  trackSwapSuccess,
  trackTransactionError,
} from "services/analytics/transactions";
import { TransactionOperationType } from "services/analytics/types";

// Section refs (§N) below are to the token-price-graphs design doc:
// wallet-eng-monorepo/design-docs/token-price-graphs/token-price-graphs-design.md

jest.mock("services/analytics/core", () => ({
  track: jest.fn(),
}));

const { track } = jest.requireMock("services/analytics/core");

describe("trackTransactionError reason_code (D1 cross-platform parity)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("uses the Horizon result code as reason_code when present", () => {
    trackTransactionError({
      error: "GADEADBEEF... op failed: some free text",
      errorCode: "op_underfunded",
      isSwap: true,
      sourceToken: "XLM",
      destToken: "USDC",
    });

    expect(track).toHaveBeenCalledWith(
      AnalyticsEvent.SWAP_FAIL,
      expect.objectContaining({ reason_code: "op_underfunded" }),
    );
  });

  it("falls back to unknown — NOT the free-text message — when no result code is present", () => {
    // Matches the extension's `resultCodes... || "unknown"`. The free-text
    // message (which could carry a StrKey and blows up cardinality) must never
    // become reason_code.
    const freeText = "Signing failed for GABC12345... unexpected error";

    trackTransactionError({
      error: freeText,
      operationType: TransactionOperationType.Payment,
    });

    expect(track).toHaveBeenCalledWith(
      AnalyticsEvent.SEND_PAYMENT_FAIL,
      expect.objectContaining({
        reason_code: "unknown",
        payment_type: "payment",
      }),
    );
    // Explicitly assert the free-text never leaks into reason_code.
    const props = track.mock.calls[0][1];
    expect(props.reason_code).not.toContain(freeText);
  });
});

describe("signing-failure reason_code scrubbing (D2 security hygiene)", () => {
  beforeEach(() => jest.clearAllMocks());

  // A 56-char G-StrKey (G + 55 base32 chars) that scrubStrKeys must redact
  // before reason_code reaches Amplitude (a third-party sink).
  const STRKEY = `G${"A".repeat(55)}`;

  it("scrubs StrKeys from signing.message_failed reason_code", () => {
    trackSignedMessageError({ error: `signMessage failed for ${STRKEY}` });

    const props = track.mock.calls[0][1];
    expect(props.reason_code).toBe("signMessage failed for G***");
    expect(props.reason_code).not.toContain(STRKEY);
  });

  it("scrubs StrKeys from signing.auth_entry_failed reason_code", () => {
    trackSignedAuthEntryError({ error: `signAuthEntry failed for ${STRKEY}` });

    const props = track.mock.calls[0][1];
    expect(props.reason_code).toBe("signAuthEntry failed for G***");
    expect(props.reason_code).not.toContain(STRKEY);
  });
});

describe("trackSwapSuccess entry source (design §7.5)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("carries source: token_details when the swap was entered from the detail view", () => {
    trackSwapSuccess({
      sourceToken: "XLM",
      destToken: "USDC",
      isSwap: true,
      source: "token_details",
    });

    expect(track).toHaveBeenCalledWith(AnalyticsEvent.SWAP_SUCCESS, {
      from_asset_code: "XLM",
      to_asset_code: "USDC",
      source: "token_details",
    });
  });

  it("omits source entirely for other entries (historical payload unchanged)", () => {
    trackSwapSuccess({
      sourceToken: "XLM",
      destToken: "USDC",
      isSwap: true,
    });

    const [event, props] = track.mock.calls[0];
    expect(event).toBe(AnalyticsEvent.SWAP_SUCCESS);
    expect(props).toStrictEqual({
      from_asset_code: "XLM",
      to_asset_code: "USDC",
    });
  });
});
