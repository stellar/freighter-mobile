/**
 * Tests for stellar service, focusing on submitTx retry logic with exponential backoff
 * and buildChangeTrustOperation helper.
 * This test uses the actual functions from stellar.ts
 */
import { Asset as SdkToken, Operation } from "@stellar/stellar-sdk";
import {
  buildChangeTrustOperation,
  calculateBackoffDelay,
  isHorizonError,
} from "services/stellar";

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

describe("buildChangeTrustOperation", () => {
  const ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

  it("returns a changeTrust operation for the requested asset with no explicit limit", () => {
    const op = buildChangeTrustOperation({ tokenCode: "USDC", issuer: ISSUER });
    const decoded = Operation.fromXDRObject(op);

    expect(decoded.type).toBe("changeTrust");
    expect((decoded as any).line).toBeInstanceOf(SdkToken);
    expect((decoded as any).line.code).toBe("USDC");
    expect((decoded as any).line.issuer).toBe(ISSUER);
    // No `limit` argument was passed — SDK defaults to the max trustline limit.
    // We don't pin that string here, but we assert the limit is not 0,
    // which is the remove-path sentinel.
    expect(parseFloat((decoded as any).limit)).toBeGreaterThan(0);
  });

  it("sets limit to '0' when isRemove is true (remove-trustline op)", () => {
    const op = buildChangeTrustOperation({
      tokenCode: "USDC",
      issuer: ISSUER,
      isRemove: true,
    });
    const decoded = Operation.fromXDRObject(op);

    expect(decoded.type).toBe("changeTrust");
    // The Stellar SDK normalizes the limit to 7 decimal places on decode.
    expect(parseFloat((decoded as any).limit)).toBe(0);
    expect((decoded as any).line.code).toBe("USDC");
    expect((decoded as any).line.issuer).toBe(ISSUER);
  });
});
