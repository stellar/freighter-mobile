import axios from "axios";
import { NETWORKS } from "config/constants";
import { freighterBackendV1 } from "services/backend";
import { scanBulkTokens } from "services/blockaid/api";

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
