import { NETWORKS } from "config/constants";
import { fetchSwapQuotes, freighterBackendV2 } from "services/backend";

jest.mock("services/apiFactory", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
  const actual = jest.requireActual("services/apiFactory");
  return {
    ...actual,
    createApiService: jest.fn(() => ({
      get: jest.fn(),
      post: jest.fn(),
    })),
  };
});

jest.mock("config/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
  normalizeError: jest.fn((error) => error),
}));

const USDC = "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const ACCOUNT = "GBTYAFHGNZSTE4VBWZYAGB3SRGJEPTI5I4Y22KZ4JTVAN56LESB6JZOF";

const QUOTES = {
  routes: [
    {
      source: "classic",
      fromAmount: "100",
      toAmount: "17.5450814",
      paths: [
        {
          share: "1",
          hops: [{ venue: "stellar-dex", from: "XLM", to: USDC }],
        },
      ],
      fees: [],
    },
  ],
  unavailable: [{ source: "lifi", reason: "timeout" }],
};

describe("fetchSwapQuotes", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockV2Post: jest.MockedFunction<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockV2Post = freighterBackendV2.post as jest.MockedFunction<any>;
    mockV2Post.mockResolvedValue({ data: { data: QUOTES } });
  });

  it("posts the quote request to the authenticated v2 client with the network query param", async () => {
    await fetchSwapQuotes({
      network: NETWORKS.TESTNET,
      account: ACCOUNT,
      mode: "send",
      fromAsset: "XLM",
      toAsset: USDC,
      amount: "100",
    });

    expect(mockV2Post).toHaveBeenCalledWith(
      "/swap/quotes",
      {
        account: ACCOUNT,
        mode: "send",
        fromAsset: "XLM",
        toAsset: USDC,
        amount: "100",
      },
      { params: { network: "TESTNET" } },
    );
  });

  it("returns the unwrapped routes and unavailable sources", async () => {
    const quotes = await fetchSwapQuotes({
      network: NETWORKS.PUBLIC,
      account: ACCOUNT,
      mode: "send",
      fromAsset: "XLM",
      toAsset: USDC,
      amount: "100",
    });

    expect(quotes).toEqual(QUOTES);
  });

  it("rejects a body without a routes array", async () => {
    mockV2Post.mockResolvedValue({ data: { data: { unavailable: [] } } });

    await expect(
      fetchSwapQuotes({
        network: NETWORKS.PUBLIC,
        account: ACCOUNT,
        mode: "send",
        fromAsset: "XLM",
        toAsset: USDC,
        amount: "100",
      }),
    ).rejects.toThrow(/swap quotes/);
  });
});
