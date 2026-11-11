/* eslint-disable no-underscore-dangle */
import axios from "axios";
import { NETWORKS } from "config/constants";
import { logger } from "config/logger";
import { freighterBackendV2 } from "services/backend";
import { fetchTrendingAssets, searchToken } from "services/stellarExpert";

// Override the global jest.setup.js mock so we test the real implementation
// with only the v2 backend client intercepted.
jest.mock("services/stellarExpert", () =>
  jest.requireActual("services/stellarExpert"),
);

jest.mock("services/backend", () => ({
  freighterBackendV2: { get: jest.fn() },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockV2Get = freighterBackendV2.get as jest.MockedFunction<any>;

// A real GET /api/v1/assets/search?network=PUBLIC&search=usdc&limit=1 answer,
// trimmed: v2 returns StellarExpert's /asset body unchanged under `data`.
const STELLAR_EXPERT_BODY = {
  _links: {
    self: { href: "/explorer/public/asset?order=desc&limit=1&cursor=0" },
    prev: { href: "/explorer/public/asset?order=asc&limit=1&cursor=1" },
    next: { href: "/explorer/public/asset?order=desc&limit=1&cursor=1" },
  },
  _embedded: {
    records: [
      {
        asset:
          "USDC-GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN-1",
        price: 1.000031,
        code: "USDC",
        created: 1611161688,
        domain: "centre.io",
        contract: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
        supply: "3266131388065427",
        payments: 123927194,
        trades: 211693941,
        volume7d: 25800031852455550,
        rating: {
          age: 10,
          activity: 10,
          trustlines: 10,
          liquidity: 10,
          volume7d: 10,
          interop: 4,
          average: 9,
        },
        trustlines: { total: 2526314, authorized: 2526313, funded: 723206 },
        tomlInfo: {
          code: "USDC",
          issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
          name: "USD Coin",
          image:
            "https://meta.stellar.expert/k7xcyyv3csv4sy4yfqoxcwpycwlgrsah776drjlys3ykjp73mnaa",
          anchorAssetType: "fiat",
          anchorAsset: "USD",
          orgName: "Centre Consortium LLC dba Centre Consortium",
        },
        score: 10.745302216251911,
        paging_token: 1,
      },
    ],
  },
};

// What freighterBackendV2 rejects with when the backend answers 503
// (StellarExpert rate-limited, down or slow): apiFactory's normalized error.
const BACKEND_UNAVAILABLE = {
  message: "Request failed with status code 503",
  status: 503,
  data: { message: "asset search temporarily unavailable", statusCode: 503 },
  isNetworkError: false,
};

// What it rejects with when the caller's AbortController fires.
const CANCELED = { message: "canceled", status: 0, isNetworkError: true };

describe("stellarExpert service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockV2Get.mockResolvedValue({ data: { data: STELLAR_EXPERT_BODY } });
  });

  describe("fetchTrendingAssets", () => {
    it("asks the v2 backend for Mainnet's top 50 assets by 7-day volume", async () => {
      await fetchTrendingAssets({ network: NETWORKS.PUBLIC });

      expect(mockV2Get).toHaveBeenCalledWith(
        "/assets/search",
        expect.objectContaining({
          params: {
            network: "PUBLIC",
            sort: "volume7d",
            order: "desc",
            limit: 50,
          },
        }),
      );
    });

    it("asks for Testnet's unsorted first page and passes the abort signal", async () => {
      const controller = new AbortController();

      await fetchTrendingAssets({
        network: NETWORKS.TESTNET,
        signal: controller.signal,
      });

      expect(mockV2Get).toHaveBeenCalledWith(
        "/assets/search",
        expect.objectContaining({
          params: { network: "TESTNET", limit: 50 },
          signal: controller.signal,
        }),
      );
    });

    it("asks for Testnet's unsorted first page on Futurenet too", async () => {
      await fetchTrendingAssets({ network: NETWORKS.FUTURENET });

      expect(mockV2Get).toHaveBeenCalledWith(
        "/assets/search",
        expect.objectContaining({
          params: { network: "TESTNET", limit: 50 },
        }),
      );
    });
  });

  describe("searchToken", () => {
    it("sends the search term and network and passes the abort signal", async () => {
      const controller = new AbortController();

      await searchToken("usdc", NETWORKS.TESTNET, controller.signal);

      expect(mockV2Get).toHaveBeenCalledWith(
        "/assets/search",
        expect.objectContaining({
          params: { network: "TESTNET", search: "usdc" },
          signal: controller.signal,
        }),
      );
    });

    it("searches Testnet on Futurenet, which the backend would reject", async () => {
      await searchToken("usdc", NETWORKS.FUTURENET);

      expect(mockV2Get).toHaveBeenCalledWith(
        "/assets/search",
        expect.objectContaining({
          params: { network: "TESTNET", search: "usdc" },
        }),
      );
    });

    it("percent-encodes an apostrophe so Android sends the query the auth JWT signed", async () => {
      await searchToken("it's", NETWORKS.PUBLIC);

      // axios builds this URL both for the signed JWT path and for the request
      // it hands to the native layer. OkHttp re-encodes a raw ' to %27, after
      // which the wire query no longer matches the signed one and v2 401s.
      const [url, config] = mockV2Get.mock.calls[0];
      const uri = axios.getUri({ ...config, url });

      expect(uri).toContain("search=it%27s");
    });
  });

  describe.each([
    [
      "fetchTrendingAssets",
      () => fetchTrendingAssets({ network: NETWORKS.PUBLIC }),
      "Error fetching trending assets",
    ],
    [
      "searchToken",
      () => searchToken("usdc", NETWORKS.PUBLIC),
      "Error searching token",
    ],
  ])("%s response handling", (_name, call, errorMessage) => {
    it("returns StellarExpert's body from the backend's data envelope", async () => {
      await expect(call()).resolves.toEqual(STELLAR_EXPERT_BODY);
    });

    it("returns null and reports the error when the backend fails", async () => {
      mockV2Get.mockRejectedValue(BACKEND_UNAVAILABLE);

      await expect(call()).resolves.toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        "stellarExpert",
        errorMessage,
        BACKEND_UNAVAILABLE,
      );
    });

    it("returns null and reports the error when the body has no records", async () => {
      mockV2Get.mockResolvedValue({
        data: { data: { _links: STELLAR_EXPERT_BODY._links } },
      });

      await expect(call()).resolves.toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        "stellarExpert",
        errorMessage,
        expect.any(Error),
      );
    });

    it("returns null without reporting when the request is aborted", async () => {
      mockV2Get.mockRejectedValue(CANCELED);

      await expect(call()).resolves.toBeNull();
      expect(logger.error).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });
});
