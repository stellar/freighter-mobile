import axios from "axios";
import { NETWORKS } from "config/constants";
import { freighterBackendV1 } from "services/backend";
import { scanBulkTokens, scanToken } from "services/blockaid/api";

jest.mock("services/backend", () => ({
  freighterBackendV1: { get: jest.fn() },
}));
jest.mock("services/analytics", () => ({ analytics: { track: jest.fn() } }));
jest.mock("helpers/networks", () => ({ isMainnet: () => true }));

const mockGet = freighterBackendV1.get as jest.Mock;

describe("scanBulkTokens error handling", () => {
  beforeEach(() => jest.clearAllMocks());

  it("wraps a backend failure with the generic message but preserves the original as cause", async () => {
    const original = new Error("boom");
    mockGet.mockRejectedValue(original);

    await expect(
      scanBulkTokens({
        addressList: ["USDC-GISSUER"],
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
        addressList: ["USDC-GISSUER"],
        network: NETWORKS.PUBLIC,
      }),
    ).rejects.toBe(cancel);
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
