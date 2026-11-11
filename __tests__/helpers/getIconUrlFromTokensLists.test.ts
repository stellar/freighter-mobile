import { NETWORKS } from "config/constants";
import { useVerifiedTokensStore } from "ducks/verifiedTokens";
import { getIconUrlFromTokensLists } from "helpers/getIconUrlFromTokensLists";

jest.mock("ducks/verifiedTokens");

const ISSUER_REAL = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const CONTRACT_A = "CC64WBDGS6QQP22QTTIACYIXT3WF7BBQEYOQPLTP7GTKYY7PZ74QYGSL";

describe("getIconUrlFromTokensLists", () => {
  const mockGetVerifiedTokens = jest.fn();
  const mockTokens = [
    { contract: "ABC123", issuer: "issuer1", icon: "icon-url-1", code: "AAA" },
    { contract: "DEF456", issuer: "issuer2", icon: "icon-url-2", code: "BBB" },
    { contract: "GHI789", issuer: "issuer3" },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (useVerifiedTokensStore.getState as jest.Mock) = jest.fn(() => ({
      getVerifiedTokens: mockGetVerifiedTokens,
    }));
    mockGetVerifiedTokens.mockResolvedValue(mockTokens);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns the icon when contractId matches", async () => {
    const icon = await getIconUrlFromTokensLists({
      asset: { contractId: "abc123" },
      network: NETWORKS.PUBLIC,
    });
    expect(icon).toBe("icon-url-1");
    expect(mockGetVerifiedTokens).toHaveBeenCalledWith({
      network: NETWORKS.PUBLIC,
    });
  });

  it("returns the icon when both code and issuer match", async () => {
    const icon = await getIconUrlFromTokensLists({
      asset: { issuer: "ISSUER2", code: "BBB" }, // issuer match is case-insensitive
      network: NETWORKS.PUBLIC,
    });
    expect(icon).toBe("icon-url-2");
    expect(mockGetVerifiedTokens).toHaveBeenCalledWith({
      network: NETWORKS.PUBLIC,
    });
  });

  it("does not return an icon for a different code from the same issuer", async () => {
    await expect(
      getIconUrlFromTokensLists({
        asset: { issuer: "issuer2", code: "ZZZ" },
        network: NETWORKS.PUBLIC,
      }),
    ).resolves.toBeUndefined();
  });

  it("returns undefined when no match is found", async () => {
    const icon = await getIconUrlFromTokensLists({
      asset: { contractId: "notfound" },
      network: NETWORKS.PUBLIC,
    });
    expect(icon).toBeUndefined();
  });

  it("returns undefined when token has no icon", async () => {
    const icon = await getIconUrlFromTokensLists({
      asset: { contractId: "GHI789" },
      network: NETWORKS.PUBLIC,
    });
    expect(icon).toBeUndefined();
  });

  it("handles asset with no contractId or issuer gracefully", async () => {
    const icon = await getIconUrlFromTokensLists({
      asset: {},
      network: NETWORKS.PUBLIC,
    });
    expect(icon).toBeUndefined();
  });

  describe("with a USDC-shaped verified list", () => {
    beforeEach(() => {
      mockGetVerifiedTokens.mockResolvedValue([
        {
          code: "USDC",
          issuer: ISSUER_REAL,
          icon: "usdc.png",
          contract: CONTRACT_A,
        },
      ]);
    });

    it("does not return an icon for a different code from the same issuer", async () => {
      await expect(
        getIconUrlFromTokensLists({
          asset: { code: "USDX", issuer: ISSUER_REAL },
          network: NETWORKS.PUBLIC,
        }),
      ).resolves.toBeUndefined();
    });

    it("matches when both code and issuer match", async () => {
      await expect(
        getIconUrlFromTokensLists({
          asset: { code: "USDC", issuer: ISSUER_REAL },
          network: NETWORKS.PUBLIC,
        }),
      ).resolves.toBe("usdc.png");
    });

    it("still matches by exact contract id", async () => {
      await expect(
        getIconUrlFromTokensLists({
          asset: { contractId: CONTRACT_A },
          network: NETWORKS.PUBLIC,
        }),
      ).resolves.toBe("usdc.png");
    });
  });
});
