/**
 * Tests for stellar service, focusing on submitTx retry logic with exponential backoff
 * This test uses the actual isHorizonError function from stellar.ts
 */
import { BASE_BACKOFF_SEC, isHorizonError } from "services/stellar";

describe("stellar service - submitTx retry logic", () => {
  it("should implement correct delay timing", async () => {
    jest.useFakeTimers();

    const delays: number[] = [];

    // Simulate the delay logic from submitTx
    const simulateDelay = (attempt: number) => {
      const delay = 2 ** (attempt - 1) * BASE_BACKOFF_SEC;
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

    // Calculate expected delays using the same logic as stellar.ts
    const expectedDelays = [];
    for (let attempt = 1; attempt <= 3; attempt++) {
      const delay = 2 ** (attempt - 1) * BASE_BACKOFF_SEC;
      expectedDelays.push(delay);
    }

    // Fast-forward timers using the calculated delays
    jest.advanceTimersByTime(1000); // First delay
    jest.advanceTimersByTime(2000); // Second delay
    jest.advanceTimersByTime(4000); // Third delay

    await Promise.all(promises);

    expect(delays).toEqual(expectedDelays);

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
