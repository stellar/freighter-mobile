import { AnalyticsEvent } from "config/analyticsConfig";
import { trackTransactionError } from "services/analytics/transactions";
import { TransactionOperationType } from "services/analytics/types";

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
