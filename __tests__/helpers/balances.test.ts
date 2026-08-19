import { Asset, Networks } from "@stellar/stellar-sdk";
import { BigNumber } from "bignumber.js";
import { NATIVE_TOKEN_CODE, NETWORKS } from "config/constants";
import {
  ClassicBalance,
  NonNativeToken,
  Balance,
  LiquidityPoolBalance,
  NativeBalance,
  NativeToken,
} from "config/types";
import {
  getLPShareCode,
  isLiquidityPool,
  getTokenIdentifier,
  getTokenIdentifiersFromBalances,
  getTokenPriceFromBalance,
  calculateSpendableAmount,
  isAmountSpendable,
  getIssuerFromIdentifier,
  getBalanceByContractId,
} from "helpers/balances";

describe("balances helpers", () => {
  // Sample test data
  const nativeBalance: NativeBalance = {
    token: {
      code: "XLM",
      issuer: null,
      type: "native",
    } as NativeToken,
    total: new BigNumber("100.5"),
    available: new BigNumber("100.5"),
    minimumBalance: new BigNumber("1"),
    buyingLiabilities: "0",
    sellingLiabilities: "0",
  };

  const tokenBalance: ClassicBalance = {
    token: {
      code: "USDC",
      issuer: {
        key: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      },
      type: "credit_alphanum4",
    } as NonNativeToken,
    total: new BigNumber("200"),
    available: new BigNumber("200"),
    limit: new BigNumber("1000"),
    buyingLiabilities: "0",
    sellingLiabilities: "0",
  };

  const liquidityPoolBalance: LiquidityPoolBalance = {
    total: new BigNumber("1472.6043561"),
    limit: new BigNumber("100000"),
    liquidityPoolId:
      "4ac86c65b9f7b175ae0493da0d36cc5bc88b72677ca69fce8fe374233983d8e7",
    reserves: [
      {
        asset: "native",
        amount: "5061.4450626",
      },
      {
        asset: "USDC:GBUNQWSNHUCOCUDRESGNY5SIS2CXILTWHZV5VARUP47G44NRUOOEYICX",
        amount: "44166.9752644",
      },
    ],
  };

  const balances = {
    native: nativeBalance,
    "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN":
      tokenBalance,
    "4ac86c65b9f7b175ae0493da0d36cc5bc88b72677ca69fce8fe374233983d8e7:lp":
      liquidityPoolBalance,
  };

  const prices = {
    XLM: {
      currentPrice: new BigNumber(0.5),
      percentagePriceChange24h: new BigNumber(0.02),
    },
    "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN": {
      currentPrice: new BigNumber(1),
      percentagePriceChange24h: new BigNumber(-0.01),
    },
  };

  describe("getLPShareCode", () => {
    it("should return formatted share code for liquidity pool", () => {
      const result = getLPShareCode(liquidityPoolBalance as Balance);
      expect(result).toBe("XLM / USDC");
    });

    it("should handle missing reserves gracefully", () => {
      const incompleteLP = {
        ...liquidityPoolBalance,
        reserves: [],
      };
      const result = getLPShareCode(incompleteLP as Balance);
      expect(result).toBe("");
    });

    it("should handle incomplete reserves", () => {
      const incompleteLP = {
        ...liquidityPoolBalance,
        reserves: [{ asset: "native", amount: "100" }],
      };
      const result = getLPShareCode(incompleteLP as Balance);
      expect(result).toBe("");
    });

    it("should substitute 'XLM' for native token code", () => {
      const lpWithNative = {
        ...liquidityPoolBalance,
        reserves: [
          { asset: "native", amount: "100" },
          {
            asset:
              "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
            amount: "100",
          },
        ],
      };
      const result = getLPShareCode(lpWithNative as Balance);
      expect(result).toBe("XLM / USDC");
    });
  });

  describe("isLiquidityPool", () => {
    it("should return true for liquidity pool balances", () => {
      expect(isLiquidityPool(liquidityPoolBalance as Balance)).toBe(true);
    });

    it("should return false for native token balances", () => {
      expect(isLiquidityPool(nativeBalance as Balance)).toBe(false);
    });

    it("should return false for non-native token balances", () => {
      expect(isLiquidityPool(tokenBalance as Balance)).toBe(false);
    });

    it("should check for required properties", () => {
      // Create an object that's completely missing the liquidityPoolId property
      // The type cast is necessary to get around TypeScript checks
      const missingProperties = {
        token: {
          code: "TEST",
          issuer: { key: "GABCDEFGHIJKLMNOPQRSTUVWXYZ01234567890ABCDEFGH" },
          type: "credit_alphanum4" as const,
        },
        total: new BigNumber("100"),
        available: new BigNumber("100"),
        limit: new BigNumber("1000"),
        // No liquidityPoolId or reserves
      };

      expect(isLiquidityPool(missingProperties as Balance)).toBe(false);
    });
  });

  describe("getTokenIdentifier", () => {
    it("should return 'XLM' for native token balances", () => {
      expect(getTokenIdentifier(nativeBalance as Balance)).toBe("XLM");
    });

    it("should return CODE:ISSUER for non-native token balances", () => {
      expect(getTokenIdentifier(tokenBalance as Balance)).toBe(
        "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      );
    });

    it("should return empty string for liquidity pool balances", () => {
      expect(getTokenIdentifier(liquidityPoolBalance as Balance)).toBe("");
    });

    it("should work directly with token objects", () => {
      expect(getTokenIdentifier(nativeBalance.token)).toBe("XLM");
      expect(getTokenIdentifier(tokenBalance.token)).toBe(
        "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      );
    });

    it("should return empty string for unrecognized token types", () => {
      const unknownToken = {
        token: {
          code: "UNKNOWN",
          // Missing type and issuer
        },
        total: new BigNumber("100"),
        available: new BigNumber("100"),
      };
      expect(getTokenIdentifier(unknownToken as Balance)).toBe("");
    });
  });

  describe("getTokenIdentifiersFromBalances", () => {
    it("should extract all token identifiers from balances", () => {
      const result = getTokenIdentifiersFromBalances(
        balances as Record<string, Balance>,
      );
      expect(result).toContain("XLM");
      expect(result).toContain(
        "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      );
      expect(result).toHaveLength(2); // Should not include LP token
    });

    it("should return empty array for empty balances", () => {
      const result = getTokenIdentifiersFromBalances({});
      expect(result).toEqual([]);
    });

    it("should handle balances with no valid token identifiers", () => {
      const invalidBalances = {
        invalid: {
          token: {
            // Missing required properties
          },
          total: new BigNumber("100"),
          available: new BigNumber("100"),
        } as Balance,
      };
      const result = getTokenIdentifiersFromBalances(invalidBalances);
      expect(result).toEqual([]);
    });

    it("should remove duplicate token identifiers", () => {
      const duplicateBalances = {
        ...balances,
        "XLM:duplicate": nativeBalance, // Add duplicate XLM balance
      };
      const result = getTokenIdentifiersFromBalances(
        duplicateBalances as Record<string, Balance>,
      );
      expect(result).toContain("XLM");
      expect(result).toContain(
        "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      );
      expect(result).toHaveLength(2); // Should deduplicate
    });
  });

  describe("getTokenPriceFromBalance", () => {
    it("should return price data for native token", () => {
      const priceData = getTokenPriceFromBalance({
        prices,
        balance: nativeBalance as Balance,
      });
      expect(priceData).toBeDefined();
      expect(priceData?.currentPrice?.toString()).toBe("0.5");
      expect(priceData?.percentagePriceChange24h?.toString()).toBe("0.02");
    });

    it("should return price data for non-native token", () => {
      const priceData = getTokenPriceFromBalance({
        prices,
        balance: tokenBalance as Balance,
      });
      expect(priceData).toBeDefined();
      expect(priceData?.currentPrice?.toString()).toBe("1");
      expect(priceData?.percentagePriceChange24h?.toString()).toBe("-0.01");
    });

    it("should return null for liquidity pool tokens", () => {
      const priceData = getTokenPriceFromBalance({
        prices,
        balance: liquidityPoolBalance as Balance,
      });
      expect(priceData).toBeNull();
    });

    it("should return null for tokens without price data", () => {
      const unknownToken = {
        token: {
          code: "UNKNOWN",
          issuer: { key: "GABCDEFGHIJKLMNOPQRSTUVWXYZ01234567890ABCDEFGH" },
          type: "credit_alphanum4" as const,
        } as NonNativeToken,
        total: new BigNumber("100"),
        available: new BigNumber("100"),
        limit: new BigNumber("1000"), // Required for AssetBalance
      };
      const priceData = getTokenPriceFromBalance({
        prices,
        balance: unknownToken as Balance,
      });
      expect(priceData).toBeNull();
    });

    it("should handle empty prices object", () => {
      const priceData = getTokenPriceFromBalance({
        prices: {},
        balance: nativeBalance as Balance,
      });
      expect(priceData).toBeNull();
    });
  });

  describe("calculateSpendableAmount", () => {
    it("should calculate spendable amount for XLM correctly", () => {
      const xlmBalance: NativeBalance = {
        token: {
          code: "XLM",
          issuer: null,
          type: "native",
        } as NativeToken,
        total: new BigNumber("10"),
        available: new BigNumber("9.5"),
        minimumBalance: new BigNumber("1"),
        buyingLiabilities: "0",
        sellingLiabilities: "0",
      };

      // subentryCount = 3, so minimum balance = (2 + 3) * 0.5 = 2.5 XLM
      // spendable = 10 - 2.5 - 0.00001 = 7.49999 XLM
      const spendable = calculateSpendableAmount({
        balance: xlmBalance,
        subentryCount: 3,
        transactionFee: "0.00001",
      });
      expect(spendable.toString()).toBe("7.49999");
    });

    it("should return zero for XLM when balance is insufficient", () => {
      const xlmBalance: NativeBalance = {
        token: {
          code: "XLM",
          issuer: null,
          type: "native",
        } as NativeToken,
        total: new BigNumber("1"),
        available: new BigNumber("1"),
        minimumBalance: new BigNumber("1"),
        buyingLiabilities: "0",
        sellingLiabilities: "0",
      };

      // subentryCount = 0, so minimum balance = (2 + 0) * 0.5 = 1 XLM
      // spendable = 1 - 1 - 0.00001 = -0.00001, should return 0
      const spendable = calculateSpendableAmount({
        balance: xlmBalance,
        subentryCount: 0,
        transactionFee: "0.00001",
      });
      expect(spendable.toString()).toBe("0");
    });

    it("should calculate spendable amount for non-native tokens correctly", () => {
      const usdcBalance: ClassicBalance = {
        token: {
          code: "USDC",
          issuer: {
            key: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
          },
          type: "credit_alphanum4",
        } as NonNativeToken,
        total: new BigNumber("1000"),
        available: new BigNumber("950"),
        limit: new BigNumber("10000"),
        buyingLiabilities: "0",
        sellingLiabilities: "50",
      };

      // For non-native tokens, use available balance (no fee subtraction since fees are paid in XLM)
      // spendable = 950 (available balance)
      const spendable = calculateSpendableAmount({
        balance: usdcBalance,
        subentryCount: 0,
        transactionFee: "0.00001",
      });
      expect(spendable.toString()).toBe("950");
    });

    it("should handle liquidity pool balances correctly", () => {
      const spendable = calculateSpendableAmount({
        balance: liquidityPoolBalance,
        subentryCount: 0,
        transactionFee: "0.00001",
      });
      expect(spendable.toString()).toBe("1472.6043561");
    });
  });

  describe("isAmountSpendable", () => {
    it("should return true for valid amounts", () => {
      const xlmBalance: NativeBalance = {
        token: {
          code: "XLM",
          issuer: null,
          type: "native",
        } as NativeToken,
        total: new BigNumber("10"),
        available: new BigNumber("9.5"),
        minimumBalance: new BigNumber("1"),
        buyingLiabilities: "0",
        sellingLiabilities: "0",
      };

      const isValid = isAmountSpendable({
        amount: "5",
        balance: xlmBalance,
        subentryCount: 3,
        transactionFee: "0.00001",
      });
      expect(isValid).toBe(true);
    });

    it("should return false for excessive amounts", () => {
      const xlmBalance: NativeBalance = {
        token: {
          code: "XLM",
          issuer: null,
          type: "native",
        } as NativeToken,
        total: new BigNumber("10"),
        available: new BigNumber("9.5"),
        minimumBalance: new BigNumber("1"),
        buyingLiabilities: "0",
        sellingLiabilities: "0",
      };

      const isValid = isAmountSpendable({
        amount: "8",
        balance: xlmBalance,
        subentryCount: 3,
        transactionFee: "0.00001",
      });
      expect(isValid).toBe(false);
    });
  });

  describe("getIssuerFromIdentifier", () => {
    it("should return empty string for native token identifier", () => {
      const identifier = NATIVE_TOKEN_CODE;
      const issuer = getIssuerFromIdentifier(identifier);
      expect(issuer).toBe("");
    });

    it("should return the issuer for non-native token identifier", () => {
      const identifier =
        "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
      const issuer = getIssuerFromIdentifier(identifier);
      expect(issuer).toBe(
        "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      );
    });

    it("should return empty string for empty identifier", () => {
      const issuer = getIssuerFromIdentifier("");
      expect(issuer).toBe("");
    });
  });
});

describe("getBalanceByContractId", () => {
  const networkDetails = {
    network: NETWORKS.TESTNET,
    networkPassphrase: Networks.TESTNET,
  } as never;

  const USDC_ISSUER =
    "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

  const nativeBalance = {
    total: new BigNumber("100"),
    available: new BigNumber("95"),
    token: { type: "native", code: "XLM" },
  } as never;

  const usdcBalance = {
    total: new BigNumber("50"),
    available: new BigNumber("50"),
    token: { code: "USDC", issuer: { key: USDC_ISSUER } },
  } as never;

  const balances = { XLM: nativeBalance, [`USDC:${USDC_ISSUER}`]: usdcBalance };

  it("matches native XLM to its SAC address", () => {
    const nativeSac = Asset.native().contractId(Networks.TESTNET);
    expect(getBalanceByContractId(nativeSac, balances, networkDetails)).toBe(
      nativeBalance,
    );
  });

  it("matches a classic asset to its SAC address", () => {
    const usdcSac = new Asset("USDC", USDC_ISSUER).contractId(Networks.TESTNET);
    expect(getBalanceByContractId(usdcSac, balances, networkDetails)).toBe(
      usdcBalance,
    );
  });

  it("matches a Soroban balance on its own contractId", () => {
    const contractId =
      "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";
    const sorobanBalance = {
      total: new BigNumber("7"),
      available: new BigNumber("7"),
      contractId,
      token: { code: "ABC", issuer: { key: contractId } },
    } as never;

    expect(
      getBalanceByContractId(
        contractId,
        { ...balances, "ABC:x": sorobanBalance },
        networkDetails,
      ),
    ).toBe(sorobanBalance);
  });

  it("returns undefined when nothing matches", () => {
    // Not derivable from any balance above: neither the native SAC, the USDC
    // SAC, nor a contractId any balance carries directly.
    const unheld = "CC4QNKPEFDA2DOYRJ7AQZQ66AOSKX3PBUAOBH7YW3CQIQDS4KI42ATS3";
    expect(
      getBalanceByContractId(unheld, { XLM: nativeBalance }, networkDetails),
    ).toBeUndefined();
  });

  it("does not throw on a liquidity pool balance, which has no token", () => {
    const lpBalance = {
      total: new BigNumber("1"),
      liquidityPoolId: "abc123",
      reserves: [],
    } as never;

    expect(() =>
      getBalanceByContractId(
        Asset.native().contractId(Networks.TESTNET),
        { "abc123:lp": lpBalance },
        networkDetails,
      ),
    ).not.toThrow();
  });

  it("does not mistake a classic asset coded XLM for the native balance", () => {
    // A classic (non-native) asset can be issued with the code "XLM" by any
    // issuer — asset-code impersonation is a known Stellar phishing pattern.
    // Its token has no `type: "native"`, only a matching `code`.
    const spoofedXlmIssuer =
      "GCELD3NDDG6TUTPWYSZFAMGO7VITAV27DCLW5HDU5WWXX2A2QEXHLW4A";
    const spoofedXlmBalance = {
      total: new BigNumber("1000"),
      available: new BigNumber("1000"),
      token: { code: "XLM", issuer: { key: spoofedXlmIssuer } },
    } as never;

    // Spoof placed FIRST so a code-based check (`token.code === "XLM"`)
    // would return it before ever reaching the real native balance.
    const spoofedBalances = {
      [`XLM:${spoofedXlmIssuer}`]: spoofedXlmBalance,
      ...balances,
    };

    const nativeSac = Asset.native().contractId(Networks.TESTNET);

    expect(
      getBalanceByContractId(nativeSac, spoofedBalances, networkDetails),
    ).toBe(nativeBalance);
  });
});
