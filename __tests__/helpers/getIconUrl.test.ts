import { NETWORKS } from "config/constants";
import { getIconUrl } from "helpers/getIconUrl";
import * as issuerModule from "helpers/getIconUrlFromIssuer";
import * as tokenListModule from "helpers/getIconUrlFromTokensLists";

describe("getIconUrl", () => {
  const asset = {
    issuer: "GABC123ISSUER",
    contractId: "C123CONTRACT",
    code: "USDC",
  };

  const network = NETWORKS.PUBLIC;

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("returns icon from token lists if available", async () => {
    jest
      .spyOn(tokenListModule, "getIconUrlFromTokensLists")
      .mockResolvedValue("https://token-list-icon.png");

    const result = await getIconUrl({ asset, network });

    expect(result).toBe("https://token-list-icon.png");
    expect(tokenListModule.getIconUrlFromTokensLists).toHaveBeenCalledTimes(1);
  });

  it("falls back to issuer TOML if token lists returns undefined", async () => {
    jest
      .spyOn(tokenListModule, "getIconUrlFromTokensLists")
      .mockResolvedValue(undefined);
    jest
      .spyOn(issuerModule, "getIconUrlFromIssuer")
      .mockResolvedValue("https://issuer-icon.png");

    const result = await getIconUrl({ asset, network });

    expect(result).toBe("https://issuer-icon.png");
    expect(tokenListModule.getIconUrlFromTokensLists).toHaveBeenCalledTimes(1);
    expect(issuerModule.getIconUrlFromIssuer).toHaveBeenCalledTimes(1);
  });

  it("returns undefined if both token lists and issuer TOML fail", async () => {
    jest
      .spyOn(tokenListModule, "getIconUrlFromTokensLists")
      .mockResolvedValue(undefined);
    jest.spyOn(issuerModule, "getIconUrlFromIssuer").mockResolvedValue("");

    const result = await getIconUrl({ asset, network });

    expect(result).toEqual("");
    expect(tokenListModule.getIconUrlFromTokensLists).toHaveBeenCalledTimes(1);
    expect(issuerModule.getIconUrlFromIssuer).toHaveBeenCalledTimes(1);
  });

  it("does not call issuer TOML if asset.issuer or asset.code is missing", async () => {
    const assetMissing = { contractId: "C123" }; // no issuer/code
    jest
      .spyOn(tokenListModule, "getIconUrlFromTokensLists")
      .mockResolvedValue(undefined);

    const result = await getIconUrl({ asset: assetMissing, network });

    expect(result).toEqual("");
    expect(issuerModule.getIconUrlFromIssuer).not.toHaveBeenCalled();
  });
});
