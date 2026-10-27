import { Keypair, StrKey } from "@stellar/stellar-sdk";
import axios from "axios";
import { AnalyticsEvent } from "config/analyticsConfig";
import { NETWORKS } from "config/constants";
import { analytics } from "services/analytics";
import { freighterBackendV1 } from "services/backend";
import {
  scanBulkTokens,
  scanToken,
  scanTransaction,
} from "services/blockaid/api";

jest.mock("services/backend", () => ({
  freighterBackendV1: { get: jest.fn(), post: jest.fn() },
}));
jest.mock("services/analytics", () => ({ analytics: { track: jest.fn() } }));
jest.mock("helpers/networks", () => ({ isMainnet: () => true }));

const mockGet = freighterBackendV1.get as jest.Mock;
const mockPost = freighterBackendV1.post as jest.Mock;
const mockTrack = analytics.track as jest.Mock;

const ISSUER = Keypair.random().publicKey();
const CONTRACT = StrKey.encodeContract(Buffer.alloc(32, 1));

describe("scanBulkTokens error handling", () => {
  beforeEach(() => jest.clearAllMocks());

  it("wraps a backend failure with the generic message but preserves the original as cause", async () => {
    const original = new Error("boom");
    mockGet.mockRejectedValue(original);

    await expect(
      scanBulkTokens({
        addressList: [`USDC-${ISSUER}`],
        network: NETWORKS.PUBLIC,
      }),
    ).rejects.toMatchObject({
      message: "Failed to bulk scan tokens",
      cause: original,
    });
  });

  it("rethrows an aborted request untouched so callers can detect the cancellation", async () => {
    const cancel = new axios.CanceledError("canceled");
    mockGet.mockRejectedValue(cancel);

    await expect(
      scanBulkTokens({
        addressList: [`USDC-${ISSUER}`],
        network: NETWORKS.PUBLIC,
      }),
    ).rejects.toBe(cancel);
  });
});

describe("scanBulkTokens id validation", () => {
  beforeEach(() => jest.clearAllMocks());

  // freighter-backend reads each id's key as split("-")[1] and rejects the
  // whole batch if any one fails, so a SEP-41 symbol like "USDC-SEAV" would
  // cost every other token in the request its verdict.
  it("leaves out ids whose code contains a hyphen so the rest of the batch is still scanned", async () => {
    mockGet.mockResolvedValue({
      data: {
        data: { results: { [`USDC-${ISSUER}`]: { result_type: "Benign" } } },
      },
    });

    await scanBulkTokens({
      addressList: [`USDC-${ISSUER}`, `USDC-SEAV-${CONTRACT}`],
      network: NETWORKS.PUBLIC,
    });

    expect(mockGet).toHaveBeenCalledWith(
      `/scan-asset-bulk?asset_ids=USDC-${ISSUER}`,
      expect.anything(),
    );
  });

  // A symbol "SC:AM" gives the balance key "SC:AM:C…", which maps to
  // "SC-AM:C…": one hyphen, but the backend reads "AM:C…" as the key.
  it("leaves out ids whose code contains a colon so the rest of the batch is still scanned", async () => {
    mockGet.mockResolvedValue({ data: { data: { results: {} } } });

    await scanBulkTokens({
      addressList: [`USDC-${ISSUER}`, `SC-AM:${CONTRACT}`],
      network: NETWORKS.PUBLIC,
    });

    expect(mockGet).toHaveBeenCalledWith(
      `/scan-asset-bulk?asset_ids=USDC-${ISSUER}`,
      expect.anything(),
    );
  });

  // Blockaid fails the whole batch on a code longer than 12 characters, and
  // the app uses the contract id as the code of a token without a symbol.
  it("leaves out ids whose code is longer than 12 characters so the rest of the batch is still scanned", async () => {
    mockGet.mockResolvedValue({ data: { data: { results: {} } } });

    await scanBulkTokens({
      addressList: [`USDC-${ISSUER}`, `${CONTRACT}-${CONTRACT}`],
      network: NETWORKS.PUBLIC,
    });

    expect(mockGet).toHaveBeenCalledWith(
      `/scan-asset-bulk?asset_ids=USDC-${ISSUER}`,
      expect.anything(),
    );
  });

  it("leaves out ids whose code has a character Blockaid rejects so the rest of the batch is still scanned", async () => {
    mockGet.mockResolvedValue({ data: { data: { results: {} } } });

    await scanBulkTokens({
      addressList: [`USDC-${ISSUER}`, `USDC.e-${CONTRACT}`, `🚀-${CONTRACT}`],
      network: NETWORKS.PUBLIC,
    });

    expect(mockGet).toHaveBeenCalledWith(
      `/scan-asset-bulk?asset_ids=USDC-${ISSUER}`,
      expect.anything(),
    );
  });

  // Blockaid scans symbols in any script, so a lookalike such as "USDС"
  // (Cyrillic С) must still be sent for its impersonation verdict.
  it("keeps ids whose code is letters in any script, digits or underscores", async () => {
    mockGet.mockResolvedValue({ data: { data: { results: {} } } });

    await scanBulkTokens({
      addressList: [`decaf_usdc-${CONTRACT}`, `USDС-${CONTRACT}`],
      network: NETWORKS.PUBLIC,
    });

    expect(mockGet).toHaveBeenCalledWith(
      `/scan-asset-bulk?asset_ids=${encodeURIComponent(
        `decaf_usdc-${CONTRACT}`,
      )}&asset_ids=${encodeURIComponent(`USDС-${CONTRACT}`)}`,
      expect.anything(),
    );
  });

  it("returns no results without calling the backend when every id is left out", async () => {
    const result = await scanBulkTokens({
      addressList: [`USDC-SEAV-${CONTRACT}`],
      network: NETWORKS.PUBLIC,
    });

    expect(mockGet).not.toHaveBeenCalled();
    expect(result).toEqual({ results: {} });
  });
});

describe("scanToken native XLM handling", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns a benign result for native XLM without calling the backend", async () => {
    const result = await scanToken({
      tokenCode: "XLM",
      network: NETWORKS.PUBLIC,
    });

    expect(mockGet).not.toHaveBeenCalled();
    expect(result.result_type).toBe("Benign");
  });

  it("still scans a token coded XLM that carries an issuer (a non-native imposter)", async () => {
    mockGet.mockResolvedValue({ data: { data: { result_type: "Benign" } } });

    await scanToken({
      tokenCode: "XLM",
      tokenIssuer: "GISSUER",
      network: NETWORKS.PUBLIC,
    });

    expect(mockGet).toHaveBeenCalled();
  });
});

describe("blockaid scan analytics (#2883 consolidation)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("emits the consolidated scan_completed event with scan_target=asset + result", async () => {
    mockGet.mockResolvedValue({
      data: { data: { result_type: "Malicious" } },
    });

    await scanToken({
      tokenCode: "USDC",
      tokenIssuer: "GISSUER",
      network: NETWORKS.PUBLIC,
    });

    expect(mockTrack).toHaveBeenCalledWith(
      AnalyticsEvent.BLOCKAID_SCAN_COMPLETED,
      expect.objectContaining({ scan_target: "asset", result: "block" }),
    );
  });

  it("emits the consolidated scan_completed event with scan_target=asset_bulk", async () => {
    mockGet.mockResolvedValue({
      data: {
        data: { results: { [`USDC-${ISSUER}`]: { result_type: "Benign" } } },
      },
    });

    await scanBulkTokens({
      addressList: [`USDC-${ISSUER}`],
      network: NETWORKS.PUBLIC,
    });

    expect(mockTrack).toHaveBeenCalledWith(
      AnalyticsEvent.BLOCKAID_SCAN_COMPLETED,
      expect.objectContaining({ scan_target: "asset_bulk" }),
    );
  });

  // D2 parity: an unclassifiable token (missing/unrecognized result_type) must
  // report result:"unknown", NOT "safe". The UI SecurityLevel defaults such
  // tokens to SAFE, but the analytics result is derived from the raw
  // result_type so it buckets identically to the extension.
  it("reports result=unknown for a token with no result_type (not safe)", async () => {
    mockGet.mockResolvedValue({ data: { data: {} } });

    await scanToken({
      tokenCode: "NOVEL",
      tokenIssuer: "GISSUER",
      network: NETWORKS.PUBLIC,
    });

    expect(mockTrack).toHaveBeenCalledWith(
      AnalyticsEvent.BLOCKAID_SCAN_COMPLETED,
      expect.objectContaining({ scan_target: "asset", result: "unknown" }),
    );
  });

  it("reports result=unknown for an unrecognized result_type on a bulk scan", async () => {
    mockGet.mockResolvedValue({
      data: {
        data: { results: { [`NOVEL-${ISSUER}`]: { result_type: "Weird" } } },
      },
    });

    await scanBulkTokens({
      addressList: [`NOVEL-${ISSUER}`],
      network: NETWORKS.PUBLIC,
    });

    expect(mockTrack).toHaveBeenCalledWith(
      AnalyticsEvent.BLOCKAID_SCAN_COMPLETED,
      expect.objectContaining({ scan_target: "asset_bulk", result: "unknown" }),
    );
  });

  // D1 parity: transaction-scan result must derive from the raw
  // validation.result_type (matching the extension + mobile's token path), NOT
  // the UI security model that defaults unclassifiable -> safe and
  // simulation.error -> warn.
  it("transaction scan maps a recognized validation.result_type", async () => {
    mockPost.mockResolvedValue({
      data: { data: { validation: { result_type: "Malicious" } } },
    });

    await scanTransaction({
      xdr: "AAAA",
      url: "https://dapp.example",
      network: NETWORKS.PUBLIC,
    });

    expect(mockTrack).toHaveBeenCalledWith(
      AnalyticsEvent.BLOCKAID_SCAN_COMPLETED,
      expect.objectContaining({ scan_target: "transaction", result: "block" }),
    );
  });

  it("transaction scan reports unknown for missing/unrecognized validation (not safe)", async () => {
    mockPost.mockResolvedValue({ data: { data: { simulation: {} } } });

    await scanTransaction({
      xdr: "AAAA",
      url: "https://dapp.example",
      network: NETWORKS.PUBLIC,
    });

    expect(mockTrack).toHaveBeenCalledWith(
      AnalyticsEvent.BLOCKAID_SCAN_COMPLETED,
      expect.objectContaining({
        scan_target: "transaction",
        result: "unknown",
      }),
    );
  });

  it("transaction scan ignores simulation.error — a benign validation stays safe (not warn)", async () => {
    mockPost.mockResolvedValue({
      data: {
        data: {
          validation: { result_type: "Benign" },
          simulation: { error: "simulation blew up" },
        },
      },
    });

    await scanTransaction({
      xdr: "AAAA",
      url: "https://dapp.example",
      network: NETWORKS.PUBLIC,
    });

    expect(mockTrack).toHaveBeenCalledWith(
      AnalyticsEvent.BLOCKAID_SCAN_COMPLETED,
      expect.objectContaining({ scan_target: "transaction", result: "safe" }),
    );
  });

  it("emits the added scan_failed event when a scan throws", async () => {
    mockGet.mockRejectedValue(new Error("backend down"));

    await expect(
      scanToken({
        tokenCode: "USDC",
        tokenIssuer: "GISSUER",
        network: NETWORKS.PUBLIC,
      }),
    ).rejects.toThrow();

    expect(mockTrack).toHaveBeenCalledWith(
      AnalyticsEvent.BLOCKAID_SCAN_FAILED,
      expect.objectContaining({ scan_target: "asset" }),
    );
  });
});
