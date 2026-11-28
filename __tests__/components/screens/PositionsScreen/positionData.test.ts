import {
  Account,
  Keypair,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import BigNumber from "bignumber.js";
import { projectAnnualEarnings } from "components/screens/PositionsScreen/helpers/earnProjection";
import { formatActivityDate } from "components/screens/PositionsScreen/helpers/formatActivityDate";
import {
  PositionActivityType,
  getBlendActivityFromHistory,
} from "components/screens/PositionsScreen/helpers/positionActivity";
import { BlendEarnAssetOption } from "config/blendTypes";
import { NETWORKS, mapNetworkToNetworkDetails } from "config/constants";
import {
  BlendRequestType,
  buildBlendRequestScVal,
  buildBlendSubmitOp,
} from "helpers/blend";

const networkDetails = mapNetworkToNetworkDetails(NETWORKS.PUBLIC);
const POOL_ID = "CBAKAZUEJBAFA2DCGBRS2WKJT3FNIMJBHTFL76AY7XMAVEINQNNIQWAO";
const USDC_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const USDC_SAC = "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";
const NATIVE_SAC = "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA";

describe("projectAnnualEarnings", () => {
  const option = (
    assetId: string,
    supplyApy: number | null,
    overrides: Partial<BlendEarnAssetOption> = {},
  ): BlendEarnAssetOption => ({
    assetId,
    symbol: null,
    name: null,
    decimals: 7,
    pools: [
      {
        id: POOL_ID,
        name: "Fixed v2.1",
        supplyApy,
        emissionsSupplyApr: 0.5,
        suppliedUsd: 1,
      },
    ],
    ...overrides,
  });

  const balances = {
    XLM: {
      token: { type: "native", code: "XLM" },
      total: new BigNumber("101.5"),
      // The minimum balance can't be deposited.
      available: new BigNumber("100"),
      currentPrice: new BigNumber("0.5"),
    },
    [`USDC:${USDC_ISSUER}`]: {
      token: { code: "USDC", issuer: { key: USDC_ISSUER } },
      total: new BigNumber("200"),
      available: new BigNumber("200"),
      currentPrice: new BigNumber("1"),
    },
  } as never;

  it("values each held token at its own best rate", () => {
    const result = projectAnnualEarnings({
      options: [
        option(NATIVE_SAC, 0.02),
        option(USDC_SAC, 0.1, { name: `USDC:${USDC_ISSUER}` }),
      ],
      balances,
      networkDetails,
    });
    // 100 XLM × $0.50 × 2% + 200 USDC × $1 × 10%.
    expect(result).toEqual({ usd: "21.00", bestApy: 0.1 });
  });

  it("leaves emissions and unpriced pools out of the rate", () => {
    const result = projectAnnualEarnings({
      options: [option(NATIVE_SAC, null)],
      balances,
      networkDetails,
    });
    expect(result).toEqual({ usd: null, bestApy: null });
  });

  it("skips tokens the account doesn't hold, and has no dollar figure then", () => {
    const result = projectAnnualEarnings({
      options: [option(USDC_SAC, 0.1, { name: `USDC:${USDC_ISSUER}` })],
      balances: {} as never,
      networkDetails,
    });
    expect(result).toEqual({ usd: null, bestApy: 0.1 });
  });

  it("skips a held token with no price", () => {
    const result = projectAnnualEarnings({
      options: [option(NATIVE_SAC, 0.02)],
      balances: {
        XLM: {
          token: { type: "native", code: "XLM" },
          total: new BigNumber("10"),
          available: new BigNumber("8"),
        },
      } as never,
      networkDetails,
    });
    expect(result.usd).toBeNull();
  });

  it("has nothing to project without a catalog", () => {
    expect(
      projectAnnualEarnings({ options: null, balances, networkDetails }),
    ).toEqual({ usd: null, bestApy: null });
  });

  // Start Earning leads into Earn, which deposits into one pool, so "Earn up
  // to" never promises another pool's better rate.
  it("rates each token at the pool Earn deposits into, not another pool's better rate", () => {
    const result = projectAnnualEarnings({
      options: [
        option(USDC_SAC, 0.1, {
          name: `USDC:${USDC_ISSUER}`,
          pools: [
            {
              id: "COTHERPOOL",
              name: "Other",
              supplyApy: 0.3,
              emissionsSupplyApr: null,
              suppliedUsd: 1,
            },
            {
              id: POOL_ID,
              name: "Fixed v2.1",
              supplyApy: 0.1,
              emissionsSupplyApr: null,
              suppliedUsd: 1,
            },
          ],
        }),
      ],
      balances,
      networkDetails,
    });

    // 200 USDC × $1 × 10%.
    expect(result).toEqual({ usd: "20.00", bestApy: 0.1 });
  });

  it("leaves out a token Earn's pool doesn't take", () => {
    const result = projectAnnualEarnings({
      options: [
        option(USDC_SAC, 0.1, {
          name: `USDC:${USDC_ISSUER}`,
          pools: [
            {
              id: "COTHERPOOL",
              name: "Other",
              supplyApy: 0.3,
              emissionsSupplyApr: null,
              suppliedUsd: 1,
            },
          ],
        }),
      ],
      balances,
      networkDetails,
    });

    expect(result).toEqual({ usd: null, bestApy: null });
  });
});

describe("getBlendActivityFromHistory", () => {
  const user = Keypair.random().publicKey();

  const envelopeFor = ({
    requests,
    publicKey = user,
    poolId = POOL_ID,
  }: {
    requests: { assetId: string; amount: string; type: BlendRequestType }[];
    publicKey?: string;
    poolId?: string;
  }) =>
    new TransactionBuilder(new Account(publicKey, "1"), {
      fee: "100",
      networkPassphrase: networkDetails.networkPassphrase,
    })
      .addOperation(
        buildBlendSubmitOp({
          poolId,
          publicKey,
          requests: requests.map((request) =>
            buildBlendRequestScVal({
              assetId: request.assetId,
              amount: request.amount,
              requestType: request.type,
            }),
          ),
        }),
      )
      .setTimeout(30)
      .build()
      .toEnvelope()
      .toXDR("base64");

  const operation = (overrides: Record<string, unknown> = {}) => ({
    id: "100",
    type: "invoke_host_function",
    transaction_successful: true,
    created_at: "2026-08-28T14:33:00Z",
    transaction_hash: "hash-1",
    transaction_attr: {
      envelope_xdr: envelopeFor({
        requests: [
          {
            assetId: USDC_SAC,
            amount: "5000000000",
            type: BlendRequestType.SupplyCollateral,
          },
        ],
      }),
    },
    ...overrides,
  });

  const activityFrom = (operations: unknown[]) =>
    getBlendActivityFromHistory({
      operations: operations as never,
      poolId: POOL_ID,
      publicKey: user,
      networkDetails,
    });

  it("reads a deposit's amount off its request", () => {
    expect(activityFrom([operation()])).toEqual([
      {
        id: "100:0",
        protocol: "blend",
        positionId: POOL_ID,
        assetId: USDC_SAC,
        type: PositionActivityType.DEPOSIT,
        amount: "5000000000",
        occurredAt: "2026-08-28T14:33:00Z",
        txHash: "hash-1",
        // For the details sheet's "Transaction details".
        envelopeXdr: expect.any(String),
      },
    ]);
  });

  it("reads a withdrawal's amount off what the pool paid out", () => {
    const [item] = activityFrom([
      operation({
        transaction_attr: {
          envelope_xdr: envelopeFor({
            // "Withdraw max" asks for more than the position holds.
            requests: [
              {
                assetId: USDC_SAC,
                amount: "99999999999",
                type: BlendRequestType.WithdrawCollateral,
              },
            ],
          }),
        },
        asset_balance_changes: [
          {
            asset_type: "credit_alphanum4",
            asset_code: "USDC",
            asset_issuer: USDC_ISSUER,
            type: "transfer",
            from: POOL_ID,
            to: user,
            amount: "120.0000000",
          },
        ],
      }),
    ]);
    expect(item.type).toBe(PositionActivityType.WITHDRAW);
    expect(item.amount).toBe("1200000000");
  });

  it("leaves a withdrawal's amount unknown without the pool's payout", () => {
    const [item] = activityFrom([
      operation({
        transaction_attr: {
          envelope_xdr: envelopeFor({
            requests: [
              {
                assetId: USDC_SAC,
                amount: "1",
                type: BlendRequestType.Withdraw,
              },
            ],
          }),
        },
      }),
    ]);
    expect(item.amount).toBeNull();
  });

  it("gives each request in one call its own row", () => {
    const items = activityFrom([
      operation({
        transaction_attr: {
          envelope_xdr: envelopeFor({
            requests: [
              {
                assetId: USDC_SAC,
                amount: "1",
                type: BlendRequestType.Supply,
              },
              {
                assetId: NATIVE_SAC,
                amount: "2",
                type: BlendRequestType.SupplyCollateral,
              },
            ],
          }),
        },
      }),
    ]);
    expect(items.map((item) => item.id)).toEqual(["100:0", "100:1"]);
    expect(items[1].assetId).toBe(NATIVE_SAC);
  });

  it("skips failed transactions, other pools and other accounts' calls", () => {
    const other = Keypair.random().publicKey();
    expect(
      activityFrom([
        operation({ transaction_successful: false }),
        operation({
          transaction_attr: {
            envelope_xdr: envelopeFor({
              poolId: USDC_SAC,
              requests: [
                {
                  assetId: USDC_SAC,
                  amount: "1",
                  type: BlendRequestType.Supply,
                },
              ],
            }),
          },
        }),
        operation({
          transaction_attr: {
            envelope_xdr: envelopeFor({
              publicKey: other,
              requests: [
                {
                  assetId: USDC_SAC,
                  amount: "1",
                  type: BlendRequestType.Supply,
                },
              ],
            }),
          },
        }),
        operation({ type: "payment" }),
        operation({ transaction_attr: { envelope_xdr: "not-xdr" } }),
      ]),
    ).toEqual([]);
  });

  it("skips requests that don't change what the account supplies", () => {
    // Request type 4 is a borrow.
    const borrow = buildBlendRequestScVal({
      assetId: USDC_SAC,
      amount: "1",
      requestType: 4 as BlendRequestType,
    });
    expect(borrow).toBeInstanceOf(xdr.ScVal);
    expect(
      activityFrom([
        operation({
          transaction_attr: {
            envelope_xdr: envelopeFor({
              requests: [
                { assetId: USDC_SAC, amount: "1", type: 4 as BlendRequestType },
              ],
            }),
          },
        }),
      ]),
    ).toEqual([]);
  });
});

describe("formatActivityDate", () => {
  const now = new Date("2026-11-28T12:00:00Z");

  it("writes a date in the current year without the year", () => {
    expect(formatActivityDate("2026-08-28T14:33:00Z", now)).toBe("Aug 28");
  });

  it("adds the year to a date from another year", () => {
    expect(formatActivityDate("2025-08-28T14:33:00Z", now)).toBe(
      "Aug 28, 2025",
    );
  });

  it("writes nothing for an unreadable date", () => {
    expect(formatActivityDate("not a date", now)).toBe("");
  });
});
