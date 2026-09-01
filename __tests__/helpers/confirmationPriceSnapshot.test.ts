import BigNumber from "bignumber.js";
import { NETWORKS } from "config/constants";
import { TokenPricesMap } from "config/types";
import { startConfirmationPriceSnapshot } from "helpers/confirmationPriceSnapshot";
import * as backendService from "services/backend";

const flushMicrotasks = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

describe("startConfirmationPriceSnapshot", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("uses the freshly fetched prices once the fetch has settled (confirmation_fetch)", async () => {
    jest.spyOn(backendService, "fetchTokenPrices").mockResolvedValue({
      XLM: { currentPrice: new BigNumber(0.5) },
    } as never);

    const handle = startConfirmationPriceSnapshot({
      canonicalIds: ["XLM"],
      network: NETWORKS.TESTNET,
      useV2: true,
      cachedDisplayPrices: {
        XLM: { currentPrice: new BigNumber(0.1) },
      } as TokenPricesMap,
    });

    await flushMicrotasks();

    expect(handle.resolve()).toEqual({
      pricesById: { XLM: { currentPrice: new BigNumber(0.5) } },
      freshness: "confirmation_fetch",
      source: "token_prices_v2",
    });
  });

  it("falls back to the cached display prices when the fetch hasn't settled yet (cached_display)", () => {
    // Never resolves within this test — resolve() is called before any await.
    jest
      .spyOn(backendService, "fetchTokenPrices")
      .mockImplementation(() => new Promise(() => {}));

    const handle = startConfirmationPriceSnapshot({
      canonicalIds: ["XLM"],
      network: NETWORKS.TESTNET,
      useV2: false,
      cachedDisplayPrices: {
        XLM: { currentPrice: new BigNumber(0.1) },
      } as TokenPricesMap,
    });

    expect(handle.resolve()).toEqual({
      pricesById: { XLM: { currentPrice: new BigNumber(0.1) } },
      freshness: "cached_display",
      source: "token_prices_v1",
    });
  });

  it("falls back to the cached display prices when the fetch rejects", async () => {
    jest
      .spyOn(backendService, "fetchTokenPrices")
      .mockRejectedValue(new Error("network down"));

    const handle = startConfirmationPriceSnapshot({
      canonicalIds: ["XLM"],
      network: NETWORKS.TESTNET,
      useV2: true,
      cachedDisplayPrices: {
        XLM: { currentPrice: new BigNumber(0.1) },
      } as TokenPricesMap,
    });

    await flushMicrotasks();

    // A rejected fetch degrades exactly like a still-pending one: coverage
    // takes priority over freshness, and the degradation is visible via
    // `cached_display` rather than reported as unpriced legs.
    expect(handle.resolve()).toEqual({
      pricesById: { XLM: { currentPrice: new BigNumber(0.1) } },
      freshness: "cached_display",
      source: "token_prices_v2",
    });
  });

  it("degrades to a null snapshot (not a throw) when the fetch rejects and no display price is cached", async () => {
    jest
      .spyOn(backendService, "fetchTokenPrices")
      .mockRejectedValue(new Error("network down"));

    const handle = startConfirmationPriceSnapshot({
      canonicalIds: ["XLM"],
      network: NETWORKS.TESTNET,
      useV2: true,
      cachedDisplayPrices: null,
    });

    await flushMicrotasks();

    expect(handle.resolve()).toEqual({
      pricesById: null,
      freshness: "cached_display",
      source: "token_prices_v2",
    });
  });

  it("aborts a still-pending fetch at resolve() so the request cannot outlive the flow", () => {
    let capturedSignal: AbortSignal | undefined;
    jest
      .spyOn(backendService, "fetchTokenPrices")
      .mockImplementation(({ signal }) => {
        capturedSignal = signal;
        return new Promise(() => {});
      });

    const handle = startConfirmationPriceSnapshot({
      canonicalIds: ["XLM"],
      network: NETWORKS.TESTNET,
      useV2: false,
      cachedDisplayPrices: null,
    });

    expect(capturedSignal?.aborted).toBe(false);
    handle.resolve();
    expect(capturedSignal?.aborted).toBe(true);
  });

  it("cancel() aborts the fetch without producing a snapshot (pre-submission failure)", () => {
    let capturedSignal: AbortSignal | undefined;
    jest
      .spyOn(backendService, "fetchTokenPrices")
      .mockImplementation(({ signal }) => {
        capturedSignal = signal;
        return new Promise(() => {});
      });

    const handle = startConfirmationPriceSnapshot({
      canonicalIds: ["XLM"],
      network: NETWORKS.TESTNET,
      useV2: false,
      cachedDisplayPrices: null,
    });

    handle.cancel();
    expect(capturedSignal?.aborted).toBe(true);
    // Idempotent, and safe to combine with a later resolve().
    handle.cancel();
    expect(handle.resolve().freshness).toBe("cached_display");
  });

  it("never consults a late-arriving result after resolve() already ran", async () => {
    let resolveFetch!: (value: TokenPricesMap) => void;
    jest.spyOn(backendService, "fetchTokenPrices").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const handle = startConfirmationPriceSnapshot({
      canonicalIds: ["XLM"],
      network: NETWORKS.TESTNET,
      useV2: true,
      cachedDisplayPrices: {
        XLM: { currentPrice: new BigNumber(0.2) },
      } as TokenPricesMap,
    });

    // Not settled yet — this is the snapshot the terminal event uses.
    const frozen = handle.resolve();
    expect(frozen.freshness).toBe("cached_display");

    // The fetch resolves only after the snapshot was already frozen.
    resolveFetch({ XLM: { currentPrice: new BigNumber(999) } } as never);
    await flushMicrotasks();

    // Calling resolve() again would now see it as settled — proving the
    // *first* frozen snapshot (already returned above) never changes.
    expect(frozen).toEqual({
      pricesById: { XLM: { currentPrice: new BigNumber(0.2) } },
      freshness: "cached_display",
      source: "token_prices_v2",
    });
  });
});
