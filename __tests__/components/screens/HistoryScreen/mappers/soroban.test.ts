import {
  Account,
  Asset as SdkToken,
  Contract,
  nativeToScVal,
  Networks,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import type { Horizon, xdr } from "@stellar/stellar-sdk";
import { G_ACCOUNT } from "__tests__/support/muxedContractFixtures";
import { resolveSorobanDisplayIdentity } from "components/screens/HistoryScreen/mappers/soroban";
import { TESTNET_NETWORK_DETAILS } from "config/constants";
import { logger } from "config/logger";
import { getAttrsFromSorobanHorizonOp } from "helpers/soroban";

const NATIVE_SAC_TESTNET =
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const OTHER_CONTRACT =
  "CB64D3G7SM2RTH6JSGG34DDTFTQ5CFDKVDZJZSODMCX4NJ2HV2KN7OHT";
const CIRCLE_ISSUER =
  "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

describe("resolveSorobanDisplayIdentity", () => {
  const passphrase = Networks.TESTNET;

  it("treats symbol 'native' as XLM only for the native contract", () => {
    const nonNativeResult = resolveSorobanDisplayIdentity(
      { symbol: "native", name: "native", contractId: OTHER_CONTRACT },
      passphrase,
    );
    expect(nonNativeResult.isNative).toBe(false);
    expect(nonNativeResult.code).toBe("native");

    const genuine = resolveSorobanDisplayIdentity(
      { symbol: "native", name: "native", contractId: NATIVE_SAC_TESTNET },
      passphrase,
    );
    expect(genuine.isNative).toBe(true);
    expect(genuine.code).toBe("XLM");
  });

  it("accepts a CODE:ISSUER name as a SAC only when the contract id derives from that pair", () => {
    const claimed = `USDC:${CIRCLE_ISSUER}`;
    const unverifiedClaim = resolveSorobanDisplayIdentity(
      { symbol: "USDC", name: claimed, contractId: OTHER_CONTRACT },
      passphrase,
    );
    // Not verified as a SAC: displayed as a plain contract token, issuer NOT
    // taken from the self-reported name.
    expect(unverifiedClaim.isVerifiedSac).toBe(false);
    expect(unverifiedClaim.issuerKey).toBe(OTHER_CONTRACT);

    const realSacId = new SdkToken("USDC", CIRCLE_ISSUER).contractId(
      passphrase,
    );
    const genuine = resolveSorobanDisplayIdentity(
      { symbol: "USDC", name: claimed, contractId: realSacId },
      passphrase,
    );
    expect(genuine.isVerifiedSac).toBe(true);
    expect(genuine.issuerKey).toBe(CIRCLE_ISSUER);
  });
});

const USER = G_ACCOUNT;

/** An `invoke_host_function` record as freighter-backend's `/account-history` serves it. */
const sorobanRecord = (fields: Record<string, unknown>) =>
  ({
    id: "op-1",
    type: "invoke_host_function",
    type_i: 24,
    created_at: "2026-11-03T12:00:00Z",
    transaction_successful: true,
    source_account: USER,
    ...fields,
  }) as unknown as Horizon.ServerApi.OperationRecord;

/**
 * The `envelope_xdr` Horizon serves for a transaction that calls `fnName` on
 * the native SAC. Built with the real SDK, so decoding it is a real decode.
 */
const envelopeXdrCalling = (fnName: string, ...args: xdr.ScVal[]) =>
  new TransactionBuilder(new Account(USER, "0"), {
    fee: "100",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(new Contract(NATIVE_SAC_TESTNET).call(fnName, ...args))
    .setTimeout(0)
    .build()
    .toXDR();

describe("getAttrsFromSorobanHorizonOp", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns a Mercury record's pre-decoded attributes without logging", () => {
    const op = sorobanRecord({
      transaction_attr: {
        contractId: NATIVE_SAC_TESTNET,
        fnName: "transfer",
        args: { from: USER, to: CIRCLE_ISSUER, amount: 1000n },
      },
    });

    expect(getAttrsFromSorobanHorizonOp(op, TESTNET_NETWORK_DETAILS)).toEqual({
      contractId: NATIVE_SAC_TESTNET,
      fnName: "transfer",
      from: USER,
      to: CIRCLE_ISSUER,
      amount: 1000n,
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("decodes the token transfer in a Horizon envelope without logging", () => {
    const op = sorobanRecord({
      transaction_attr: {
        envelope_xdr: envelopeXdrCalling(
          "transfer",
          nativeToScVal(USER, { type: "address" }),
          nativeToScVal(CIRCLE_ISSUER, { type: "address" }),
          nativeToScVal(1000n, { type: "i128" }),
        ),
      },
    });

    expect(
      getAttrsFromSorobanHorizonOp(op, TESTNET_NETWORK_DETAILS),
    ).toMatchObject({
      contractId: NATIVE_SAC_TESTNET,
      fnName: "transfer",
      from: USER,
      to: CIRCLE_ISSUER,
      amount: 1000n,
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("returns null without logging for a call that isn't a token transfer or mint", () => {
    // The common case, and not a failure: only a record it can't read is
    // logged.
    const op = sorobanRecord({
      transaction_attr: {
        envelope_xdr: envelopeXdrCalling(
          "balance",
          nativeToScVal(USER, { type: "address" }),
        ),
      },
    });

    expect(
      getAttrsFromSorobanHorizonOp(op, TESTNET_NETWORK_DETAILS),
    ).toBeNull();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it.each([
    ["XDR that doesn't decode", { envelope_xdr: "not-xdr" }],
    ["no envelope", {}],
    ["no transaction_attr", undefined],
    ["null transaction_attr", null],
  ])(
    "returns null instead of throwing for a record with %s",
    (_, transactionAttr) => {
      const op = sorobanRecord({ transaction_attr: transactionAttr });
      expect(
        getAttrsFromSorobanHorizonOp(op, TESTNET_NETWORK_DETAILS),
      ).toBeNull();
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        "getAttrsFromSorobanHorizonOp",
        "Failed to decode Soroban operation",
        expect.anything(),
      );
    },
  );
});
