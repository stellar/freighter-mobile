import { withTokenDecimals } from "components/screens/SwapScreen/helpers/tokenDecimals";
import { NETWORKS } from "config/constants";
import { logger } from "config/logger";
import {
  FormattedSearchTokenRecord,
  TokenTypeWithCustomToken,
} from "config/types";
import { getTokenDetails } from "services/backend";

jest.mock("services/backend", () => ({ getTokenDetails: jest.fn() }));
jest.mock("config/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn() },
}));

const CONTRACT = "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";
const ACCOUNT = "GBTYAFHGNZSTE4VBWZYAGB3SRGJEPTI5I4Y22KZ4JTVAN56LESB6JZOF";
const soroban: FormattedSearchTokenRecord = {
  tokenCode: "TKN",
  issuer: CONTRACT,
  domain: "",
  hasTrustline: false,
  isNative: false,
  tokenType: TokenTypeWithCustomToken.CUSTOM_TOKEN,
};
const ctx = { publicKey: ACCOUNT, network: NETWORKS.PUBLIC };
const flush = () =>
  new Promise((r) => {
    setImmediate(r);
  });

describe("withTokenDecimals", () => {
  beforeEach(() => jest.clearAllMocks());

  it("applies a record whose decimals are known without a lookup", () => {
    const apply = jest.fn();

    withTokenDecimals({ ...soroban, decimals: 9 }, ctx, apply, jest.fn());

    expect(apply).toHaveBeenCalledWith({ ...soroban, decimals: 9 });
    expect(getTokenDetails).not.toHaveBeenCalled();
  });

  it("reads a contract token's decimals through /token-details", async () => {
    (getTokenDetails as jest.Mock).mockResolvedValue({
      name: "Token",
      symbol: "TKN",
      decimals: 18,
    });
    const apply = jest.fn();

    withTokenDecimals(soroban, ctx, apply, jest.fn());
    await flush();

    expect(getTokenDetails).toHaveBeenCalledWith({
      contractId: CONTRACT,
      publicKey: ACCOUNT,
      network: NETWORKS.PUBLIC,
    });
    expect(apply).toHaveBeenCalledWith({ ...soroban, decimals: 18 });
  });

  it("refuses the token and reports it when its decimals stay unknown", async () => {
    (getTokenDetails as jest.Mock).mockResolvedValue(null);
    const apply = jest.fn();
    const fail = jest.fn();

    withTokenDecimals(soroban, ctx, apply, fail);
    await flush();

    expect(apply).not.toHaveBeenCalled();
    expect(fail).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });
});
