/**
 * Tests for stellar service, focusing on submitTx retry logic with exponential backoff
 * This test uses the actual isHorizonError function from stellar.ts
 */
import { DEFAULT_RECOMMENDED_STELLAR_FEE } from "config/constants";
import { FeePriority, NetworkCongestion } from "config/types";
import {
  calculateBackoffDelay,
  getNetworkFees,
  isHorizonError,
} from "services/stellar";

type FeeStatsServer = Parameters<typeof getNetworkFees>[0];

const buildFeeStatsServer = (
  feeStats: () => Promise<unknown>,
): FeeStatsServer => ({ feeStats }) as unknown as FeeStatsServer;

describe("stellar service - submitTx retry logic", () => {
  it("should implement correct delay timing", async () => {
    jest.useFakeTimers();

    const delays: number[] = [];

    // Simulate the delay logic from submitTx using the extracted function
    const simulateDelay = (attempt: number) => {
      const delay = calculateBackoffDelay(attempt);
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          delays.push(delay);
          resolve();
        }, delay);
      });
    };

    // Simulate 3 retry attempts
    const promises = [];
    for (let attempt = 1; attempt <= 3; attempt++) {
      promises.push(simulateDelay(attempt));
    }

    // Fast-forward timers using the calculated delays
    jest.advanceTimersByTime(1000); // First delay
    jest.advanceTimersByTime(2000); // Second delay
    jest.advanceTimersByTime(4000); // Third delay

    await Promise.all(promises);

    expect(delays).toEqual([1000, 2000, 4000]);

    jest.useRealTimers();
  });

  it("should verify retry condition logic", () => {
    // Test the retry condition that matches submitTx implementation
    // This tests the logic: isHorizonError(e) && e.response.status === 504

    const shouldRetry = (error: any) =>
      isHorizonError(error) && error.response.status === 504;

    // Test cases using the actual isHorizonError function from stellar.ts
    const horizon504Error = { response: { status: 504 } };
    const horizon400Error = { response: { status: 400 } };
    const nonHorizonError = new Error("Network error");

    expect(shouldRetry(horizon504Error)).toBe(true);
    expect(shouldRetry(horizon400Error)).toBe(false);
    expect(shouldRetry(nonHorizonError)).toBe(false);
  });
});

describe("stellar service - getNetworkFees", () => {
  const buildFeeDistribution = (overrides = {}) => ({
    max: "20000",
    min: "100",
    mode: "100",
    p10: "100",
    p20: "200",
    p30: "300",
    p40: "400",
    p50: "1000",
    p60: "2000",
    p70: "3000",
    p80: "5000",
    p90: "10000",
    p95: "15000",
    p99: "20000",
    ...overrides,
  });

  it("maps max_fee p10/p50/p90 (stroops) to Low/Med/High presets in XLM", async () => {
    const server = buildFeeStatsServer(() =>
      Promise.resolve({
        ledger_capacity_usage: "0.2",
        max_fee: buildFeeDistribution(),
      }),
    );

    const { recommendedFee, networkCongestion, feePresets } =
      await getNetworkFees(server);

    expect(networkCongestion).toBe(NetworkCongestion.LOW);
    expect(feePresets[FeePriority.LOW]).toBe("0.00001"); // p10 = 100
    expect(feePresets[FeePriority.MEDIUM]).toBe("0.0001"); // p50 = 1000
    expect(feePresets[FeePriority.HIGH]).toBe("0.001"); // p90 = 10000
    // The recommended (default) fee matches the Medium preset.
    expect(recommendedFee).toBe(feePresets[FeePriority.MEDIUM]);
  });

  it("derives congestion level from ledger capacity usage", async () => {
    const mediumServer = buildFeeStatsServer(() =>
      Promise.resolve({
        ledger_capacity_usage: "0.6",
        max_fee: buildFeeDistribution(),
      }),
    );
    const highServer = buildFeeStatsServer(() =>
      Promise.resolve({
        ledger_capacity_usage: "0.9",
        max_fee: buildFeeDistribution(),
      }),
    );

    expect((await getNetworkFees(mediumServer)).networkCongestion).toBe(
      NetworkCongestion.MEDIUM,
    );
    expect((await getNetworkFees(highServer)).networkCongestion).toBe(
      NetworkCongestion.HIGH,
    );
  });

  it("falls back to defaults when feeStats fails", async () => {
    const server = buildFeeStatsServer(() =>
      Promise.reject(new Error("network error")),
    );

    const { recommendedFee, networkCongestion, feePresets } =
      await getNetworkFees(server);

    expect(recommendedFee).toBe(DEFAULT_RECOMMENDED_STELLAR_FEE);
    expect(networkCongestion).toBe(NetworkCongestion.LOW);
    expect(feePresets[FeePriority.LOW]).toBe(DEFAULT_RECOMMENDED_STELLAR_FEE);
    expect(feePresets[FeePriority.MEDIUM]).toBe(
      DEFAULT_RECOMMENDED_STELLAR_FEE,
    );
    expect(feePresets[FeePriority.HIGH]).toBe(DEFAULT_RECOMMENDED_STELLAR_FEE);
  });
});
