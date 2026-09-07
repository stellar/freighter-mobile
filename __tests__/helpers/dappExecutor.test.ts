import {
  Account,
  BASE_FEE,
  FeeBumpTransaction,
  Keypair,
  Networks,
  Operation,
  Transaction,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { DappErrorCode, DappRequest, DappTransport } from "config/dappRequest";
import { StellarRpcChains, StellarRpcMethods } from "ducks/walletKit";
import { executeDappRequest } from "helpers/walletKitUtil";
import { TFunction } from "i18next";
import { submitTx } from "services/stellar";

jest.mock("services/analytics", () => ({
  analytics: {
    trackSignedMessage: jest.fn(),
    trackSignedTransaction: jest.fn(),
    trackSignedAuthEntry: jest.fn(),
    trackSubmittedTransaction: jest.fn(),
  },
}));

jest.mock("services/stellar", () => ({ submitTx: jest.fn() }));

describe("shared dApp executor", () => {
  const setup = (method: string, params: Record<string, unknown> = {}) => {
    const respond = jest.fn().mockResolvedValue(undefined);
    const sessionRequest: DappRequest = {
      id: "request-1",
      params: {
        chainId: StellarRpcChains.TESTNET,
        request: { method, params },
      },
      origin: "https://example.org",
      metadata: {
        name: "Example",
        description: "",
        url: "https://example.org",
        icons: [],
      },
      transport: DappTransport.WEBVIEW,
      isValid: jest.fn(() => true),
      respond,
    };
    return {
      sessionRequest,
      signTransaction: jest.fn(() => "signed-xdr"),
      signMessage: jest.fn(() => "signature"),
      signAuthEntry: jest.fn(() => ({
        signedAuthEntry: "signed",
        signerAddress: "GACCOUNT",
      })),
      networkPassphrase: "Test SDF Network ; September 2015",
      publicKey: "GACCOUNT",
      activeChain: StellarRpcChains.TESTNET,
      showToast: jest.fn(),
      t: ((key: string) => key) as TFunction<"translations", undefined>,
    };
  };

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it("rejects an unknown method without parsing XDR or signing", async () => {
    const args = setup("unknown", { xdr: "bad-xdr" });
    await executeDappRequest(args);
    expect(args.signTransaction).not.toHaveBeenCalled();
    expect(args.sessionRequest.respond).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: "UNSUPPORTED_METHOD" }),
      }),
    );
  });

  it("refuses a stale document before signing", async () => {
    const args = setup(StellarRpcMethods.SIGN_MESSAGE, { message: "hello" });
    args.sessionRequest.isValid = () => false;
    await executeDappRequest(args);
    expect(args.signMessage).not.toHaveBeenCalled();
    expect(args.sessionRequest.respond).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: DappErrorCode.CONTEXT_CHANGED }),
      }),
    );
  });

  it("returns message signatures through the transport without browser instructions", async () => {
    const args = setup(StellarRpcMethods.SIGN_MESSAGE, { message: "hello" });
    await executeDappRequest(args);
    expect(args.signMessage).toHaveBeenCalledWith("hello");
    expect(args.sessionRequest.respond).toHaveBeenCalledWith({
      id: "request-1",
      jsonrpc: "2.0",
      result: { signature: "signature" },
    });
    expect(args.showToast).toHaveBeenCalledWith({
      title: "walletKit.signMessageSuccessfull",
      variant: "success",
    });
  });

  it("rejects wrong network and malformed messages before signing", async () => {
    const args = setup(StellarRpcMethods.SIGN_MESSAGE, { message: 42 });
    await executeDappRequest(args);
    expect(args.signMessage).not.toHaveBeenCalled();
    args.sessionRequest.params.chainId = StellarRpcChains.PUBLIC;
    await executeDappRequest(args);
    expect(args.signMessage).not.toHaveBeenCalled();
  });

  it.each([StellarRpcMethods.SIGN_XDR, StellarRpcMethods.SIGN_AND_SUBMIT_XDR])(
    "routes %s results through the same transport",
    async (method) => {
      const args = setup(method, { xdr: "xdr" });
      jest
        .spyOn(TransactionBuilder, "fromXdr")
        .mockReturnValue({} as Transaction);
      await executeDappRequest(args);
      expect(args.signTransaction).toHaveBeenCalledTimes(1);
      expect(args.sessionRequest.respond).toHaveBeenCalledWith({
        id: "request-1",
        jsonrpc: "2.0",
        result:
          method === StellarRpcMethods.SIGN_XDR
            ? { signedXDR: "signed-xdr" }
            : { status: "success" },
      });
      expect(submitTx).toHaveBeenCalledTimes(
        method === StellarRpcMethods.SIGN_XDR ? 0 : 1,
      );
    },
  );

  it("rejects malformed authorization entries before signing", async () => {
    const args = setup(StellarRpcMethods.SIGN_AUTH_ENTRY, { entryXdr: "bad" });
    await executeDappRequest(args);
    expect(args.signAuthEntry).not.toHaveBeenCalled();
    expect(args.sessionRequest.respond).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: "INVALID_PARAMS" }),
      }),
    );
  });

  it("checks context again before submission", async () => {
    const args = setup(StellarRpcMethods.SIGN_AND_SUBMIT_XDR, { xdr: "xdr" });
    jest
      .spyOn(TransactionBuilder, "fromXdr")
      .mockReturnValue({} as Transaction);
    args.signTransaction.mockImplementation(() => {
      args.sessionRequest.isValid = () => false;
      return "signed-xdr";
    });
    await executeDappRequest(args);
    expect(args.signTransaction).toHaveBeenCalled();
    expect(submitTx).not.toHaveBeenCalled();
  });

  it("returns an XDR signature verifiable for the approved account and network", async () => {
    const signer = Keypair.random();
    const unsigned = new TransactionBuilder(
      new Account(signer.publicKey(), "100"),
      {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      },
    )
      .addOperation(
        Operation.manageData({ name: "bridge-test", value: "approved" }),
      )
      .setTimeout(0)
      .build();
    const args = setup(StellarRpcMethods.SIGN_XDR, { xdr: unsigned.toXdr() });
    const respond = jest.fn().mockResolvedValue(undefined);
    await executeDappRequest({
      ...args,
      publicKey: signer.publicKey(),
      sessionRequest: { ...args.sessionRequest, respond },
      signTransaction: (transaction: Transaction | FeeBumpTransaction) => {
        transaction.sign(signer);
        return transaction.toXdr();
      },
    });
    expect(respond).toHaveBeenCalledTimes(1);
    const { signedXDR } = respond.mock.calls[0][0].result as {
      signedXDR: string;
    };
    const signed = TransactionBuilder.fromXdr(signedXDR, Networks.TESTNET);
    expect(signed.hash()).toEqual(unsigned.hash());
    expect(signed.signatures).toHaveLength(1);
    const signature = signed.signatures[0].signature.toBytes();
    expect(signer.verify(signed.hash(), signature)).toBe(true);
    const wrongNetwork = TransactionBuilder.fromXdr(signedXDR, Networks.PUBLIC);
    expect(signer.verify(wrongNetwork.hash(), signature)).toBe(false);
    expect(Keypair.random().verify(signed.hash(), signature)).toBe(false);
  });
});
