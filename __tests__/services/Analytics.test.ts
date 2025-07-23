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
});
