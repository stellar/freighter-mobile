import { NETWORKS } from "config/constants";
import { buildSwapTx, freighterBackendV2 } from "services/backend";

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

const REQUEST = {
  network: NETWORKS.PUBLIC,
  account: ACCOUNT,
  source: "classic",
  fromAsset: "XLM",
  toAsset: USDC,
  amount: "100",
  minOut: "17.1941798",
  slippage: "2",
  timeout: 180,
  fee: "0.00001",
  paths: [
    { share: "1", hops: [{ venue: "stellar-dex", from: "XLM", to: USDC }] },
  ],
};

describe("buildSwapTx", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockV2Post: jest.MockedFunction<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockV2Post = freighterBackendV2.post as jest.MockedFunction<any>;
    mockV2Post.mockResolvedValue({
      data: { data: { xdr: "AAAA", addsTrustline: true } },
    });
  });

  it("posts the route to the authenticated v2 client with the network query param", async () => {
    await buildSwapTx(REQUEST);

    const { network, ...body } = REQUEST;
    expect(mockV2Post).toHaveBeenCalledWith("/swap/tx", body, {
      params: { network: "PUBLIC" },
    });
  });

  it("returns the unwrapped transaction", async () => {
    await expect(buildSwapTx(REQUEST)).resolves.toEqual({
      xdr: "AAAA",
      addsTrustline: true,
    });
  });

  it("rejects a body without a transaction", async () => {
    mockV2Post.mockResolvedValue({ data: { data: { addsTrustline: false } } });

    await expect(buildSwapTx(REQUEST)).rejects.toThrow(/swap tx/);
  });

  it("passes an HTTP failure through with its status", async () => {
    mockV2Post.mockRejectedValue({
      message: "quote_moved",
      status: 409,
      isNetworkError: false,
    });

    await expect(buildSwapTx(REQUEST)).rejects.toMatchObject({ status: 409 });
  });
});
