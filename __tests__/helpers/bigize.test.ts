import BigNumber from "bignumber.js";
import { bigize } from "helpers/bigize";

describe("bigize helper", () => {
  // Configure BigNumber for consistent test results
  beforeAll(() => {
    BigNumber.config({ EXPONENTIAL_AT: 1e9 });
  });

  describe("basic functionality", () => {
    it("should convert specified number properties to BigNumber", () => {
      const input = { value: "123.456", name: "test", id: 42 };
      const output = bigize(input, ["value"]);

      expect(BigNumber.isBigNumber(output.value)).toBe(true);
      expect(output.value.toString()).toBe("123.456");
      expect(output.name).toBe("test");
      expect(output.id).toBe(42);
    });

    it("should convert string numbers with specified keys", () => {
      const input = { balance: "100.5", amount: "200.75" };
      const output = bigize(input, ["balance", "amount"]);

      expect(BigNumber.isBigNumber(output.balance)).toBe(true);
      expect(BigNumber.isBigNumber(output.amount)).toBe(true);
      expect(output.balance.toString()).toBe("100.5");
      expect(output.amount.toString()).toBe("200.75");
    });

    it("should convert numeric values with specified keys", () => {
      const input = { balance: 100.5, amount: 200.75 };
      const output = bigize(input, ["balance", "amount"]);

      expect(BigNumber.isBigNumber(output.balance)).toBe(true);
      expect(BigNumber.isBigNumber(output.amount)).toBe(true);
      expect(output.balance.toString()).toBe("100.5");
      expect(output.amount.toString()).toBe("200.75");
    });

    it("should not convert properties that are not in the keys list", () => {
      const input = { balance: "100.5", amount: "200.75", name: "42" };
      const output = bigize(input, ["balance"]);

      expect(BigNumber.isBigNumber(output.balance)).toBe(true);
      expect(BigNumber.isBigNumber(output.amount)).toBe(false);
      expect(typeof output.amount).toBe("string");
      expect(typeof output.name).toBe("string");
    });

    it("should handle rounding to 7 decimal places", () => {
      const input = { value: "123.45678912345" };
      const output = bigize(input, ["value"]);

      expect(BigNumber.isBigNumber(output.value)).toBe(true);
      expect(output.value.toString()).toBe("123.4567891");
    });
  });

  describe("empty or missing values", () => {
    it("should handle null values without converting them", () => {
      const input = { balance: null, amount: "200.75" };
      const output = bigize(input, ["balance", "amount"]);

      expect(output.balance).toBeNull();
      expect(BigNumber.isBigNumber(output.amount)).toBe(true);
    });

    it("should handle undefined values without converting them", () => {
      const input = { balance: undefined, amount: "200.75" };
      const output = bigize(input, ["balance", "amount"]);

      expect(output.balance).toBeUndefined();
      expect(BigNumber.isBigNumber(output.amount)).toBe(true);
    });

    it("should handle empty objects", () => {
      const input = {};
      const output = bigize(input, ["balance", "amount"]);

      expect(output).toEqual({});
    });

    it("should handle objects with no matching keys", () => {
      const input = { name: "test", id: 42 };
      const output = bigize(input, ["balance", "amount"]);

      expect(output).toEqual({ name: "test", id: 42 });
    });

    it("should handle empty key list", () => {
      const input = { balance: "100.5", amount: "200.75" };
      const output = bigize(input, []);

      expect(typeof output.balance).toBe("string");
      expect(typeof output.amount).toBe("string");
      expect(output).toEqual(input);
    });

    it("should handle undefined key list (default to empty array)", () => {
      const input = { balance: "100.5", amount: "200.75" };
      const output = bigize(input);

      expect(typeof output.balance).toBe("string");
      expect(typeof output.amount).toBe("string");
      expect(output).toEqual(input);
    });
  });

  describe("non-object inputs", () => {
    it("should return primitive values as-is", () => {
      expect(bigize(42, ["value"])).toBe(42);
      expect(bigize("hello", ["value"])).toBe("hello");
      expect(bigize(true, ["value"])).toBe(true);
    });

    it("should return null values as-is", () => {
      expect(bigize(null, ["value"])).toBeNull();
    });

    it("should return undefined values as-is", () => {
      expect(bigize(undefined, ["value"])).toBeUndefined();
    });

    it("should return BigNumber instances as-is", () => {
      const bn = new BigNumber("123.456");
      const result = bigize(bn, ["value"]);

      expect(BigNumber.isBigNumber(result)).toBe(true);
      expect(result.toString()).toBe("123.456");
      expect(result).toBe(bn); // Should be the same instance
    });
  });

  describe("array handling", () => {
    it("should process arrays of primitives", () => {
      const input = ["100.5", "200.75", "300"];
      // Arrays of primitives should be returned as-is since they don't have named properties
      const output = bigize(input, ["value"]);

      expect(output).toEqual(input);
    });

    it("should process arrays of objects", () => {
      const input = [
        { balance: "100.5", name: "Alice" },
        { balance: "200.75", name: "Bob" },
      ];
      const output = bigize(input, ["balance"]);

      expect(Array.isArray(output)).toBe(true);
      expect(output.length).toBe(2);
      expect(BigNumber.isBigNumber(output[0].balance)).toBe(true);
      expect(BigNumber.isBigNumber(output[1].balance)).toBe(true);
      expect(output[0].balance.toString()).toBe("100.5");
      expect(output[1].balance.toString()).toBe("200.75");
      expect(output[0].name).toBe("Alice");
      expect(output[1].name).toBe("Bob");
    });

    it("should handle empty arrays", () => {
      const input: string[] = [];
      const output = bigize(input, ["balance"]);

      expect(Array.isArray(output)).toBe(true);
      expect(output.length).toBe(0);
    });
  });

  describe("nested structures", () => {
    it("should process nested objects", () => {
      const input = {
        user: {
          name: "Alice",
          account: {
            balance: "100.5",
            limit: "1000",
          },
        },
      };
      const output = bigize(input, ["balance", "limit"]);

      expect(BigNumber.isBigNumber(output.user.account.balance)).toBe(true);
      expect(BigNumber.isBigNumber(output.user.account.limit)).toBe(true);
      expect(output.user.account.balance.toString()).toBe("100.5");
      expect(output.user.account.limit.toString()).toBe("1000");
      expect(output.user.name).toBe("Alice");
    });

    it("should process objects with nested arrays", () => {
      const input = {
        accounts: [
          { id: 1, balance: "100.5" },
          { id: 2, balance: "200.75" },
        ],
        total: "301.25",
      };
      const output = bigize(input, ["balance", "total"]);

      expect(BigNumber.isBigNumber(output.accounts[0].balance)).toBe(true);
      expect(BigNumber.isBigNumber(output.accounts[1].balance)).toBe(true);
      expect(BigNumber.isBigNumber(output.total)).toBe(true);
      expect(output.accounts[0].balance.toString()).toBe("100.5");
      expect(output.accounts[1].balance.toString()).toBe("200.75");
      expect(output.total.toString()).toBe("301.25");
    });

    it("should process arrays with nested objects", () => {
      const input = [
        {
          id: 1,
          transactions: [
            { amount: "10.5", date: "2023-01-01" },
            { amount: "20.75", date: "2023-01-02" },
          ],
        },
        {
          id: 2,
          transactions: [{ amount: "30.5", date: "2023-01-03" }],
        },
      ];
      const output = bigize(input, ["amount"]);

      expect(BigNumber.isBigNumber(output[0].transactions[0].amount)).toBe(
        true,
      );
      expect(BigNumber.isBigNumber(output[0].transactions[1].amount)).toBe(
        true,
      );
      expect(BigNumber.isBigNumber(output[1].transactions[0].amount)).toBe(
        true,
      );
      expect(output[0].transactions[0].amount.toString()).toBe("10.5");
      expect(output[0].transactions[1].amount.toString()).toBe("20.75");
      expect(output[1].transactions[0].amount.toString()).toBe("30.5");
    });

    it("should handle deeply nested structures", () => {
      const input = {
        level1: {
          level2: {
            level3: {
              level4: {
                value: "123.456",
              },
            },
          },
        },
      };
      const output = bigize(input, ["value"]);

      expect(
        BigNumber.isBigNumber(output.level1.level2.level3.level4.value),
      ).toBe(true);
      expect(output.level1.level2.level3.level4.value.toString()).toBe(
        "123.456",
      );
    });
  });

  describe("edge cases", () => {
    it("should handle invalid number strings without throwing", () => {
      const input = { balance: "not-a-number", amount: "200.75" };

      // This should log an error but not throw
      const output = bigize(input, ["balance", "amount"]);

      // Since "not-a-number" is not valid, it should be converted to NaN
      expect(BigNumber.isBigNumber(output.balance)).toBe(true);
      // Type assertion is safe here because we've verified it's a BigNumber
      const balanceAsBN = output.balance as unknown as BigNumber;
      expect(balanceAsBN.isNaN()).toBe(true);

      expect(BigNumber.isBigNumber(output.amount)).toBe(true);
      expect(output.amount.toString()).toBe("200.75");
    });

    it("should handle extremely large numbers", () => {
      const input = { balance: "1".repeat(100) };
      const output = bigize(input, ["balance"]);

      expect(BigNumber.isBigNumber(output.balance)).toBe(true);
      // The string has 100 ones, so should be 10^99-1
      expect(output.balance.toString()).toBe("1".repeat(100));
    });

    it("should handle negative numbers", () => {
      const input = { balance: "-123.456" };
      const output = bigize(input, ["balance"]);

      expect(BigNumber.isBigNumber(output.balance)).toBe(true);
      expect(output.balance.toString()).toBe("-123.456");
    });

    it("should handle numbers in scientific notation", () => {
      const input = { balance: "1.23456e+5" };
      const output = bigize(input, ["balance"]);

      expect(BigNumber.isBigNumber(output.balance)).toBe(true);
      expect(output.balance.toString()).toBe("123456");
    });

    it("should handle objects with prototype properties", () => {
      class Account {
        balance: string;

        constructor(balance: string) {
          this.balance = balance;
        }
      }

      const input = new Account("100.5");
      const output = bigize(input, ["balance"]);

      expect(BigNumber.isBigNumber(output.balance)).toBe(true);
      expect(output.balance.toString()).toBe("100.5");
    });
  });

  describe("real-world examples", () => {
    it("should handle Stellar account balances", () => {
      const input = {
        account: {
          balances: [
            {
              asset_type: "native",
              balance: "100.5000000",
              buying_liabilities: "0.0000000",
              selling_liabilities: "0.0000000",
            },
            {
              asset_type: "credit_alphanum4",
              asset_code: "USDC",
              asset_issuer:
                "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
              balance: "200.7500000",
              limit: "1000.0000000",
              buying_liabilities: "0.0000000",
              selling_liabilities: "0.0000000",
            },
          ],
        },
      };

      const output = bigize(input, [
        "balance",
        "buying_liabilities",
        "selling_liabilities",
        "limit",
      ]);

      // Check that the output structure exists
      expect(output.account).toBeDefined();
      expect(output.account?.balances).toBeDefined();
      expect(Array.isArray(output.account?.balances)).toBe(true);
      expect(output.account?.balances?.length).toBe(2);

      // Type assertion for easier access with known structure
      type BalanceWithBN = {
        asset_type: string;
        asset_code?: string;
        balance: BigNumber;
        buying_liabilities: BigNumber;
        selling_liabilities: BigNumber;
        limit?: BigNumber;
      };

      const nativeBalance = output.account
        ?.balances?.[0] as unknown as BalanceWithBN;
      const usdcBalance = output.account
        ?.balances?.[1] as unknown as BalanceWithBN;

      // Check native balance
      expect(BigNumber.isBigNumber(nativeBalance.balance)).toBe(true);
      expect(BigNumber.isBigNumber(nativeBalance.buying_liabilities)).toBe(
        true,
      );
      expect(BigNumber.isBigNumber(nativeBalance.selling_liabilities)).toBe(
        true,
      );
      expect(nativeBalance.balance.toString()).toBe("100.5");

      // Check USDC balance
      expect(BigNumber.isBigNumber(usdcBalance.balance)).toBe(true);
      expect(BigNumber.isBigNumber(usdcBalance.limit)).toBe(true);
      expect(usdcBalance.balance.toString()).toBe("200.75");
      if (usdcBalance.limit) {
        expect(usdcBalance.limit.toString()).toBe("1000");
      }

      // Check that non-numeric properties are preserved
      expect(nativeBalance.asset_type).toBe("native");
      expect(usdcBalance.asset_code).toBe("USDC");
    });
  });
});
