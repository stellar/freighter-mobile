import { AnalyticsEvent } from "config/analyticsConfig";
import { TransactionType } from "services/analytics/types";

describe("Analytics Service", () => {
  it("should export TransactionType enum", () => {
    expect(TransactionType.Classic).toBe("classic");
    expect(TransactionType.Soroban).toBe("soroban");
  });

  it("should have all required AnalyticsEvent enum values", () => {
    expect(AnalyticsEvent.VIEW_HOME).toBeDefined();
    expect(AnalyticsEvent.APP_OPENED).toBeDefined();
    expect(AnalyticsEvent.SEND_PAYMENT_SUCCESS).toBeDefined();
    expect(AnalyticsEvent.SEND_PAYMENT_FAIL).toBeDefined();
    expect(AnalyticsEvent.RE_AUTH_SUCCESS).toBeDefined();
  });

  it("maps domain events to the shared cross-platform wire strings (#2883)", () => {
    // A representative slice of the renamed / consolidated catalog. These are
    // the values sent to Amplitude and are a dashboard contract; changing one
    // requires coordinating with analytics.
    expect(AnalyticsEvent.SEND_PAYMENT_SUCCESS).toBe("payment.completed");
    expect(AnalyticsEvent.SEND_PAYMENT_FAIL).toBe("payment.failed");
    expect(AnalyticsEvent.SWAP_SUCCESS).toBe("swap.completed");
    expect(AnalyticsEvent.SWAP_PICKER_OPENED).toBe("swap.picker_opened");
    expect(AnalyticsEvent.SIGN_TRANSACTION_SUCCESS).toBe(
      "signing.transaction_approved",
    );
    expect(AnalyticsEvent.SIGN_TRANSACTION_FAIL).toBe(
      "signing.transaction_rejected",
    );
    expect(AnalyticsEvent.BLOCKAID_SCAN_COMPLETED).toBe(
      "blockaid.scan_completed",
    );
    expect(AnalyticsEvent.BLOCKAID_SCAN_FAILED).toBe("blockaid.scan_failed");
    expect(AnalyticsEvent.ASSET_ADD_RESPONDED).toBe("asset_add.responded");
    expect(AnalyticsEvent.APP_UPDATE_STORE_OPENED).toBe(
      "app_update.store_opened",
    );
  });
});
