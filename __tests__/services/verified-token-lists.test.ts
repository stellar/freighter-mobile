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

  it("logs an error with the URL as a structured arg (not interpolated into the message)", async () => {
    // The URL must NOT be in the message string - interpolating it
    // would fragment Sentry grouping into one issue per token-list
    // URL. It belongs in the args extras, where Sentry can show it
    // per-event without splitting the issue.
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
      "Error retrieving verified tokens from token list",
      error,
      { url: "mock://uri" },
    );

    loggerSpy.mockRestore();
  });

  it("logs a warning (not error) when the failure is a connectivity error from apiFactory", async () => {
    // apiFactory throws a plain ApiError object (not an Error instance) when
    // axios sees no response - offline, DNS, TLS, captive portal, etc.
    // The catch in fetchVerifiedTokens should branch on isApiNetworkError
    // and demote to logger.warn so we don't generate Sentry errors for
    // every offline user. URL goes in the args extras, not the message.
    const networkError = {
      message: "Network Error",
      status: 0,
      isNetworkError: true,
    };
    (mockApiService.get as jest.Mock).mockRejectedValue(networkError);

    const errorSpy = jest.spyOn(logger, "error").mockImplementation(() => {});
    const warnSpy = jest.spyOn(logger, "warn").mockImplementation(() => {});

    const verifiedAssets = await fetchVerifiedTokens({
      tokenListsApiServices: { [NETWORKS.TESTNET]: [mockApiService] },
      network: NETWORKS.TESTNET,
    });

    expect(verifiedAssets).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      "fetchVerifiedTokens",
      "Network unreachable for token list",
      networkError,
      { url: "mock://uri" },
    );
    expect(errorSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
