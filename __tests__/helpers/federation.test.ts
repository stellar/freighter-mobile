import { Federation } from "@stellar/stellar-sdk";
import { resolveFederationAddress } from "helpers/contactList";

jest.mock("@stellar/stellar-sdk", () => ({
  Federation: { Server: { resolve: jest.fn() } },
}));

// Use real implementation — we're testing the helper itself

describe("resolveFederationAddress", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("resolves a federation address successfully", async () => {
    const expected = { account_id: "GABC..." };
    (Federation.Server.resolve as jest.Mock).mockResolvedValue(expected);

    const result = await resolveFederationAddress("alice*stellar.org");

    expect(result).toBe(expected);
    expect(Federation.Server.resolve).toHaveBeenCalledWith("alice*stellar.org");
  });

  it("rejects when the server does not respond within the timeout", async () => {
    // Never resolves
    (Federation.Server.resolve as jest.Mock).mockReturnValue(
      new Promise(() => {}),
    );

    const promise = resolveFederationAddress("alice*stellar.org");

    jest.advanceTimersByTime(10_000);

    await expect(promise).rejects.toThrow("Federation resolution timed out");
  });

  it("rejects when the abort signal fires before resolution", async () => {
    (Federation.Server.resolve as jest.Mock).mockReturnValue(
      new Promise(() => {}),
    );

    const controller = new AbortController();
    const promise = resolveFederationAddress(
      "alice*stellar.org",
      controller.signal,
    );

    controller.abort();

    await expect(promise).rejects.toThrow("Aborted");
  });

  it("clears the timeout timer when aborted", async () => {
    (Federation.Server.resolve as jest.Mock).mockReturnValue(
      new Promise(() => {}),
    );

    const controller = new AbortController();
    const promise = resolveFederationAddress(
      "alice*stellar.org",
      controller.signal,
    );

    controller.abort();

    await expect(promise).rejects.toThrow("Aborted");

    // Advancing timers should not cause an additional rejection
    jest.advanceTimersByTime(10_000);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("propagates server errors", async () => {
    (Federation.Server.resolve as jest.Mock).mockRejectedValue(
      new Error("Not found"),
    );

    await expect(
      resolveFederationAddress("unknown*stellar.org"),
    ).rejects.toThrow("Not found");
  });

  it("rejects immediately when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      resolveFederationAddress("alice*stellar.org", controller.signal),
    ).rejects.toThrow("Aborted");

    expect(Federation.Server.resolve).not.toHaveBeenCalled();
  });

  it("clears the timeout timer on successful resolution", async () => {
    const expected = { account_id: "GABC..." };
    (Federation.Server.resolve as jest.Mock).mockResolvedValue(expected);

    await resolveFederationAddress("alice*stellar.org");

    // No pending timers should remain after successful resolution
    expect(jest.getTimerCount()).toBe(0);
  });
});
