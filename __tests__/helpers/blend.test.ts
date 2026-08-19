import { Address, xdr } from "@stellar/stellar-sdk";
import {
  BlendRequestType,
  buildBlendRequestScVal,
  buildBlendSubmitOp,
} from "helpers/blend";

const POOL_ID = "CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD";
const USDC_SAC = "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";
const PUBLIC_KEY = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";

describe("buildBlendRequestScVal", () => {
  it("encodes Request as a map keyed address, amount, request_type in that order", () => {
    const val = buildBlendRequestScVal({
      assetId: USDC_SAC,
      amount: "5000000000",
      requestType: BlendRequestType.SupplyCollateral,
    });

    const entries = val.map();
    expect(entries).not.toBeNull();
    expect(entries!.map((e) => e.key().sym().toString())).toEqual([
      "address",
      "amount",
      "request_type",
    ]);
  });

  it("encodes the amount as an i128 and the request type as a u32", () => {
    const entries = buildBlendRequestScVal({
      assetId: USDC_SAC,
      amount: "5000000000",
      requestType: BlendRequestType.SupplyCollateral,
    }).map()!;

    const byKey = (name: string) =>
      entries.find((e) => e.key().sym().toString() === name)!.val();

    expect(byKey("amount").switch().name).toBe("scvI128");
    expect(byKey("request_type").switch().name).toBe("scvU32");
    expect(byKey("request_type").u32()).toBe(2);
    expect(byKey("address").switch().name).toBe("scvAddress");
  });

  it("uses SupplyCollateral (2), not Supply (0), for deposits", () => {
    expect(BlendRequestType.SupplyCollateral).toBe(2);
    expect(BlendRequestType.Supply).toBe(0);
  });

  it("round-trips through XDR without loss", () => {
    const val = buildBlendRequestScVal({
      assetId: USDC_SAC,
      amount: "5000000000",
      requestType: BlendRequestType.SupplyCollateral,
    });
    const restored = xdr.ScVal.fromXDR(val.toXDR());
    expect(restored.toXDR("base64")).toBe(val.toXDR("base64"));
  });
});

describe("buildBlendSubmitOp", () => {
  it("calls submit with from, spender and to all set to the user", () => {
    const op = buildBlendSubmitOp({
      poolId: POOL_ID,
      publicKey: PUBLIC_KEY,
      requests: [
        buildBlendRequestScVal({
          assetId: USDC_SAC,
          amount: "1",
          requestType: BlendRequestType.SupplyCollateral,
        }),
      ],
    });

    const invocation = op
      .body()
      .invokeHostFunctionOp()
      .hostFunction()
      .invokeContract();

    expect(invocation.functionName().toString()).toBe("submit");
    // from, spender, to, requests
    expect(invocation.args()).toHaveLength(4);

    // Verify that from, spender, and to are all the user's Address
    const expectedUser = new Address(PUBLIC_KEY).toScVal().toXDR("base64");
    const args = invocation.args();
    expect(args[0].toXDR("base64")).toBe(expectedUser);
    expect(args[1].toXDR("base64")).toBe(expectedUser);
    expect(args[2].toXDR("base64")).toBe(expectedUser);
  });
});
