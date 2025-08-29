/* eslint-disable @fnando/consistent-import/consistent-import */
import { NETWORKS } from "config/constants";
import { logger } from "config/logger";
import { fetchVerifiedTokens } from "services/verified-token-lists";

import { mockApiService } from "../../__mocks__/api-service";
import { MOCK_TOKEN_LIST_RESPONSE } from "../../__mocks__/token-list-response";

describe("Verified Token Lists", () => {
  it("returns a list off verified assets", async () => {
    (mockApiService.get as jest.Mock).mockResolvedValue({
      data: MOCK_TOKEN_LIST_RESPONSE,
      status: 200,
      statusText: "OK",
    });

    const verifiedTokens = await fetchVerifiedTokens({
      tokenListsApiServices: { [NETWORKS.TESTNET]: [mockApiService] },
      network: NETWORKS.TESTNET,
    });

    expect(verifiedTokens).toEqual(MOCK_TOKEN_LIST_RESPONSE.assets);
  });

  it("logs an error when fetching a list fails", async () => {
    const error = new Error("Network error");
    (mockApiService.get as jest.Mock).mockRejectedValue(error);

    const loggerSpy = jest.spyOn(logger, "error").mockImplementation(() => {});

    const verifiedAssets = await fetchVerifiedTokens({
      tokenListsApiServices: { [NETWORKS.TESTNET]: [mockApiService] },
      network: NETWORKS.TESTNET,
    });

    expect(verifiedAssets).toEqual([]);
    expect(loggerSpy).toHaveBeenCalledWith(
      "fetchVerifiedTokens",
      expect.stringContaining("Error retrieving verified tokens"),
      error,
    );

    loggerSpy.mockRestore();
  });
});
