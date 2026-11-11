import {
  Account,
  Address,
  Asset,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
  nativeToScVal,
  xdr,
} from "@stellar/stellar-sdk";
import lifi from "__tests__/components/screens/SwapScreen/helpers/fixtures/lifiSwapTx.json";
import {
  SwapTxMismatchError,
  decodeSwapTx,
} from "components/screens/SwapScreen/helpers/decodeSwapTx";

const USDC_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const USDC = `USDC:${USDC_ISSUER}`;
const EURC = "EURC:GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2";

const ACCOUNT = Keypair.random().publicKey();
const OTHER = Keypair.random().publicKey();

const classicTx = ({
  ops,
  source = ACCOUNT,
}: {
  ops: ReturnType<typeof Operation.pathPaymentStrictSend>[];
  source?: string;
}) => {
  const builder = new TransactionBuilder(new Account(source, "1"), {
    fee: "100",
    networkPassphrase: Networks.PUBLIC,
  }).setTimeout(180);
  ops.forEach((op) => builder.addOperation(op));
  return builder.build();
};

const pathPayment = (overrides: { destination?: string } = {}) =>
  Operation.pathPaymentStrictSend({
    sendAsset: Asset.native(),
    sendAmount: "100",
    destination: overrides.destination ?? ACCOUNT,
    destAsset: new Asset("USDC", USDC_ISSUER),
    destMin: "17.1941798",
    path: [],
  });

const decode = (
  transactionXdr: string,
  account = ACCOUNT,
  toAsset = USDC,
  fromAsset = "XLM",
  minOut = "0",
) =>
  decodeSwapTx({
    transactionXdr,
    networkPassphrase: Networks.PUBLIC,
    account,
    fromAsset,
    toAsset,
    minOut,
  });

describe("decodeSwapTx", () => {
  describe("classic path payment", () => {
    it("reads the amount sold, minimum received and fee", () => {
      const tx = classicTx({ ops: [pathPayment()] });

      expect(decode(tx.toXDR())).toEqual({
        sendAmount: "100",
        minReceived: "17.1941798",
        fee: "0.00001",
        addsTrustline: false,
      });
    });

    it("reports the changeTrust the backend added", () => {
      const tx = classicTx({
        ops: [
          Operation.changeTrust({ asset: new Asset("USDC", USDC_ISSUER) }),
          pathPayment(),
        ],
      });

      expect(decode(tx.toXDR())).toMatchObject({
        addsTrustline: true,
        fee: "0.00002",
      });
    });

    it("refuses a minimum below the minOut the client asked for", () => {
      const tx = classicTx({ ops: [pathPayment()] });

      expect(() =>
        decode(tx.toXDR(), ACCOUNT, USDC, "XLM", "17.1941799"),
      ).toThrow(/minimum/);
      expect(
        decode(tx.toXDR(), ACCOUNT, USDC, "XLM", "17.1941798").minReceived,
      ).toBe("17.1941798");
    });

    it("refuses a payment to another account", () => {
      const tx = classicTx({ ops: [pathPayment({ destination: OTHER })] });

      expect(() => decode(tx.toXDR())).toThrow(/path payment/);
    });

    it("refuses a different destination asset", () => {
      const tx = classicTx({ ops: [pathPayment()] });

      expect(() => decode(tx.toXDR(), ACCOUNT, EURC)).toThrow(/path payment/);
    });

    it("refuses a changeTrust that sets a limit instead of opening the default one", () => {
      const tx = classicTx({
        ops: [
          Operation.changeTrust({
            asset: new Asset("USDC", USDC_ISSUER),
            limit: "1000",
          }),
          pathPayment(),
        ],
      });

      expect(() => decode(tx.toXDR())).toThrow(/trustline/);
    });

    it("refuses a changeTrust for another asset", () => {
      const [code, issuer] = EURC.split(":");
      const tx = classicTx({
        ops: [
          Operation.changeTrust({ asset: new Asset(code, issuer) }),
          pathPayment(),
        ],
      });

      expect(() => decode(tx.toXDR())).toThrow(/trustline/);
    });

    it.each([
      [
        "an extra payment",
        () => [
          Operation.payment({
            destination: OTHER,
            asset: Asset.native(),
            amount: "1",
          }),
          pathPayment(),
        ],
      ],
      [
        "an extra setOptions",
        () => [pathPayment(), Operation.setOptions({ homeDomain: "x.com" })],
      ],
      [
        "more than two operations",
        () => [
          Operation.changeTrust({ asset: new Asset("USDC", USDC_ISSUER) }),
          pathPayment(),
          pathPayment(),
        ],
      ],
      ["no operations", () => []],
    ])("refuses %s", (_, ops) => {
      const tx = new TransactionBuilder(new Account(ACCOUNT, "1"), {
        fee: "100",
        networkPassphrase: Networks.PUBLIC,
      }).setTimeout(180);
      ops().forEach((op) => tx.addOperation(op));

      expect(() => decode(tx.build().toXDR())).toThrow(/does not match/);
    });

    it("refuses an operation with another source account", () => {
      const tx = classicTx({
        ops: [
          Operation.changeTrust({
            asset: new Asset("USDC", USDC_ISSUER),
            source: OTHER,
          }),
          pathPayment(),
        ],
      });

      expect(() => decode(tx.toXDR())).toThrow(/source account/);
    });

    it("refuses another account's transaction", () => {
      const tx = classicTx({ ops: [pathPayment()], source: OTHER });

      expect(() => decode(tx.toXDR())).toThrow(/source account/);
    });

    it("refuses a fee bump", () => {
      const inner = classicTx({ ops: [pathPayment()] });
      const bump = TransactionBuilder.buildFeeBumpTransaction(
        Keypair.random(),
        "200",
        inner,
        Networks.PUBLIC,
      );

      expect(() => decode(bump.toXDR())).toThrow(/fee bump/);
    });
  });

  describe("any Soroban source", () => {
    it("decodes a swap through another contract and function from its authorization tree", () => {
      const { xdr: txXdr, account } = lifi.xlmUsdc100k;
      const { auth } = TransactionBuilder.fromXdr(txXdr, Networks.PUBLIC)
        .operations[0] as Operation.InvokeHostFunction;
      const tx = new TransactionBuilder(new Account(account, "1"), {
        fee: "100",
        networkPassphrase: Networks.PUBLIC,
      })
        .addOperation(
          Operation.invokeContractFunction({
            contract:
              "CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE",
            function: "exchange",
            args: [nativeToScVal(1), nativeToScVal(2), nativeToScVal(3)],
            auth,
          }),
        )
        .setTimeout(180)
        .build();

      expect(decode(tx.toXDR(), account, USDC, "XLM", "18191.30443")).toEqual({
        sendAmount: "100000",
        minReceived: undefined,
        fee: "0.00001",
        addsTrustline: false,
      });
    });
  });

  describe("LI.FI swap call", () => {
    it("reads the amount sold from the authorization tree", () => {
      const { xdr: txXdr, account } = lifi.xlmUsdc100k;

      // 100,000 XLM: a 250 XLM LI.FI fee plus 99,750 XLM into the aggregator.
      expect(decode(txXdr, account)).toEqual({
        sendAmount: "100000",
        minReceived: undefined,
        fee: "0.0829393",
        addsTrustline: false,
      });
    });

    it("reports the trustline the swap opens", () => {
      const { xdr: txXdr, account } = lifi.xlmUsdcWithTrust;

      expect(decode(txXdr, account)).toMatchObject({
        sendAmount: "10",
        addsTrustline: true,
      });
    });

    it("refuses the swap call alongside another operation", () => {
      const { xdr: txXdr, account } = lifi.xlmUsdc100k;
      const env = xdr.TransactionEnvelope.fromXDR(txXdr, "base64");
      if (env.type !== "envelopeTypeTx") throw new Error("fixture");
      const [swapOp] = env.v1.tx.operations;
      const extra = Operation.payment({
        destination: OTHER,
        asset: Asset.native(),
        amount: "1",
      });
      Object.assign(env.v1.tx, { operations: [swapOp, extra] });

      expect(() => decode(env.toXDR("base64"), account)).toThrow(
        /does not match/,
      );
    });

    it("refuses a swap for another account", () => {
      expect(() => decode(lifi.xlmUsdc100k.xdr, OTHER)).toThrow(
        /source account/,
      );
    });

    it("refuses an authorized transfer of another token", () => {
      const { xdr: txXdr, account } = lifi.xlmUsdc100k;
      const env = xdr.TransactionEnvelope.fromXDR(txXdr, "base64");
      const { body } =
        env.type === "envelopeTypeTx"
          ? env.v1.tx.operations[0]
          : { body: null };
      if (body?.type !== "invokeHostFunction") throw new Error("fixture");
      const [feeTransfer] =
        body.invokeHostFunctionOp.auth[0].rootInvocation.subInvocations;
      if (
        feeTransfer.function.type !== "sorobanAuthorizedFunctionTypeContractFn"
      ) {
        throw new Error("fixture");
      }
      Object.assign(feeTransfer.function.contractFn, {
        contractAddress: new Address(
          new Asset("USDC", USDC_ISSUER).contractId(Networks.PUBLIC),
        ).toScAddress(),
      });

      expect(() => decode(env.toXDR("base64"), account)).toThrow(/transfer/);
    });

    const withFeeTransfer = (txXdr: string, stroops: bigint) => {
      const env = xdr.TransactionEnvelope.fromXDR(txXdr, "base64");
      const { body } =
        env.type === "envelopeTypeTx"
          ? env.v1.tx.operations[0]
          : { body: null };
      if (body?.type !== "invokeHostFunction") throw new Error("fixture");
      const [feeTransfer] =
        body.invokeHostFunctionOp.auth[0].rootInvocation.subInvocations;
      if (
        feeTransfer.function.type !== "sorobanAuthorizedFunctionTypeContractFn"
      ) {
        throw new Error("fixture");
      }
      Object.assign(feeTransfer.function.contractFn.args, {
        2: nativeToScVal(stroops, { type: "i128" }),
      });
      return env.toXDR("base64");
    };

    it("refuses a negative authorized transfer, which would lower the amount shown", () => {
      const { xdr: txXdr, account } = lifi.xlmUsdc100k;

      expect(() => decode(withFeeTransfer(txXdr, BigInt(-1)), account)).toThrow(
        /transfer/,
      );
    });

    it("accepts a zero fee transfer, as the backend does", () => {
      const { xdr: txXdr, account } = lifi.xlmUsdc100k;

      // 99,750 XLM into the aggregator and no fee.
      expect(
        decode(withFeeTransfer(txXdr, BigInt(0)), account).sendAmount,
      ).toBe("99750");
    });

    it("refuses a trustline for an asset other than the one bought", () => {
      const { xdr: txXdr, account } = lifi.xlmUsdcWithTrust;

      expect(() => decode(txXdr, account, EURC)).toThrow(/trustline/);
    });

    // Appends a call the account authorizes to the LI.FI auth tree.
    const withAuthorizedCall = (
      txXdr: string,
      contract: string,
      name: string,
      args: xdr.ScVal[],
    ) => {
      const env = xdr.TransactionEnvelope.fromXDR(txXdr, "base64");
      const { body } =
        env.type === "envelopeTypeTx"
          ? env.v1.tx.operations[0]
          : { body: null };
      if (body?.type !== "invokeHostFunction") throw new Error("fixture");
      const root = body.invokeHostFunctionOp.auth[0].rootInvocation;
      const call = new xdr.SorobanAuthorizedInvocation({
        function:
          xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
            new xdr.InvokeContractArgs({
              contractAddress: new Address(contract).toScAddress(),
              functionName: name,
              args,
            }),
          ),
        subInvocations: [],
      });
      Object.assign(root, { subInvocations: [...root.subInvocations, call] });
      return env.toXDR("base64");
    };

    it("refuses an allowance the swap would grant on another token", () => {
      const { xdr: txXdr, account } = lifi.xlmUsdcWithTrust;
      const usdcContract = new Asset("USDC", USDC_ISSUER).contractId(
        Networks.PUBLIC,
      );
      const input = withAuthorizedCall(txXdr, usdcContract, "approve", [
        new Address(account).toScVal(),
        new Address(OTHER).toScVal(),
        nativeToScVal(BigInt("170141183460469231731687303715884105727"), {
          type: "i128",
        }),
        nativeToScVal(60_000_000, { type: "u32" }),
      ]);

      expect(() => decode(input, account)).toThrow(/approve/);
    });

    it("still reads a swap whose source calls its own contracts", () => {
      const { xdr: txXdr, account } = lifi.xlmUsdcWithTrust;
      const input = withAuthorizedCall(
        txXdr,
        "CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE",
        "swap_exact_in",
        [new Address(account).toScVal()],
      );

      expect(decode(input, account)).toMatchObject({ sendAmount: "10" });
    });
  });

  it.each([
    ["unparseable XDR", "not-a-transaction"],
    ["a swap call with malformed arguments", "malformed"],
  ])("refuses %s as a mismatch", (_, which) => {
    const { xdr: txXdr, account } = lifi.xlmUsdc100k;
    let input = which;
    if (which === "malformed") {
      const env = xdr.TransactionEnvelope.fromXDR(txXdr, "base64");
      const { body } =
        env.type === "envelopeTypeTx"
          ? env.v1.tx.operations[0]
          : { body: null };
      if (body?.type !== "invokeHostFunction") throw new Error("fixture");
      const [feeTransfer] =
        body.invokeHostFunctionOp.auth[0].rootInvocation.subInvocations;
      if (
        feeTransfer.function.type !== "sorobanAuthorizedFunctionTypeContractFn"
      ) {
        throw new Error("fixture");
      }
      // transfer(from, to) with no amount: reading args[2] fails.
      Object.assign(feeTransfer.function.contractFn, {
        args: feeTransfer.function.contractFn.args.slice(0, 2),
      });
      input = env.toXDR("base64");
    }

    expect(() => decode(input, account)).toThrow(SwapTxMismatchError);
  });

  it("refuses a contract token until the picker allows them", () => {
    const tx = classicTx({ ops: [pathPayment()] });

    expect(() =>
      decode(
        tx.toXDR(),
        ACCOUNT,
        "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
      ),
    ).toThrow(/unsupported asset/);
  });
});
