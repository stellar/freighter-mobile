import {
  Account,
  Asset,
  BASE_FEE,
  Networks,
  Operation,
  Transaction,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import { renderHook } from "@testing-library/react-native";
import { G_ACCOUNT } from "__tests__/support/muxedContractFixtures";
import {
  sacTransferArgs,
  sacTransferInvocation,
  sacTransferTransactionXdr,
  XLM_SAC_TESTNET,
} from "__tests__/support/sacTransferFixtures";
import { getDisplayableDetails } from "components/screens/SignTransactionDetails/helpers/detailsState";
import {
  buildSignTransactionDetailsState,
  useSignTransactionDetails,
  useSignTransactionDetailsState,
} from "components/screens/SignTransactionDetails/hooks/useSignTransactionDetails";
import { SignTransactionDetailsState } from "components/screens/SignTransactionDetails/types";
import { logger } from "config/logger";
import {
  getAuthEntryBoundAddress,
  scValToDisplayTokens,
} from "helpers/soroban";

jest.mock("ducks/auth", () => ({
  useAuthenticationStore: () => ({ network: "TESTNET" }),
}));

// Both conversions are wrapped so a test can make one throw, as an arm the app
// can't render does. The wrappers call through by default.
jest.mock("helpers/soroban", () => {
  const actual = jest.requireActual("helpers/soroban");
  return {
    ...actual,
    getAuthEntryBoundAddress: jest.fn(actual.getAuthEntryBoundAddress),
    scValToDisplayTokens: jest.fn(actual.scValToDisplayTokens),
  };
});

const actualSoroban = jest.requireActual("helpers/soroban");

type ReadyState = Extract<SignTransactionDetailsState, { status: "ready" }>;

/** A testnet transaction calling `transfer` on the native SAC with `args`, authorized by `auth`. */
const transferXdr = ({
  args,
  auth,
}: {
  args: xdr.ScVal[];
  auth: xdr.SorobanAuthorizationEntry[];
}) =>
  new TransactionBuilder(new Account(G_ACCOUNT, "0"), {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: XLM_SAC_TESTNET,
        function: "transfer",
        args,
        auth,
      }),
    )
    .setTimeout(0)
    .build()
    .toXdr();

/** Every `scValToDisplayTokens` call throws, as it does for an arm it can't render. */
const failTokens = () =>
  jest.mocked(scValToDisplayTokens).mockImplementation(() => {
    throw new Error("unsupported arm");
  });

beforeEach(() => {
  jest
    .mocked(scValToDisplayTokens)
    .mockReset()
    .mockImplementation(actualSoroban.scValToDisplayTokens);
  jest
    .mocked(getAuthEntryBoundAddress)
    .mockReset()
    .mockImplementation(actualSoroban.getAuthEntryBoundAddress);
  jest.mocked(logger.warn).mockClear();
  jest.mocked(logger.error).mockClear();
});

describe("buildSignTransactionDetailsState", () => {
  it("is empty without an XDR", () =>
    expect(buildSignTransactionDetailsState("", Networks.TESTNET)).toEqual({
      status: "empty",
    }));

  it("is undisplayable, with only a breadcrumb, when the XDR doesn't parse", () => {
    expect(
      buildSignTransactionDetailsState("not-xdr", Networks.TESTNET),
    ).toEqual({ status: "undisplayable" });
    expect(logger.warn).toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  // A dApp controls the request's params, so the XDR isn't always a string.
  it.each([123, {}, true])(
    "is undisplayable, with only a breadcrumb, when the XDR is %p, not a string",
    (notAString) => {
      expect(
        buildSignTransactionDetailsState(
          notAString as unknown as string,
          Networks.TESTNET,
        ),
      ).toEqual({ status: "undisplayable" });
      expect(logger.warn).toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    },
  );

  it("is ready for a SAC transfer to a W address", () => {
    const state = buildSignTransactionDetailsState(
      sacTransferTransactionXdr(),
      Networks.TESTNET,
    );

    expect(state.status).toBe("ready");

    const { details } = state as ReadyState;
    expect(details.operations).toHaveLength(1);
    expect(details.authEntries).toHaveLength(1);
    // source-account credentials
    expect(details.authEntries[0].boundAddress).toBeUndefined();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("carries the summary and the trustline flag", () => {
    const xdrString = sacTransferTransactionXdr();
    const { details } = buildSignTransactionDetailsState(
      xdrString,
      Networks.TESTNET,
    ) as ReadyState;

    expect(details.summary).toEqual({
      operationsCount: 1,
      feeXlm: "0.00001",
      sequenceNumber: "1",
      memo: { value: "", type: "none" },
      xdr: xdrString,
    });
    expect(details.hasTrustlineChanges).toBe(false);

    const trustlineXdr = new TransactionBuilder(new Account(G_ACCOUNT, "0"), {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.changeTrust({ asset: new Asset("USDC", G_ACCOUNT) }),
      )
      .setTimeout(0)
      .build()
      .toXdr();
    const trustline = buildSignTransactionDetailsState(
      trustlineXdr,
      Networks.TESTNET,
    ) as ReadyState;

    expect(trustline.details.hasTrustlineChanges).toBe(true);
  });

  it("is ready for a fee bump wrapping that transfer", () => {
    const inner = TransactionBuilder.fromXdr(
      sacTransferTransactionXdr(),
      Networks.TESTNET,
    ) as Transaction;
    const feeBump = TransactionBuilder.buildFeeBumpTransaction(
      G_ACCOUNT,
      "200",
      inner,
      Networks.TESTNET,
    ).toXdr();

    expect(
      buildSignTransactionDetailsState(feeBump, Networks.TESTNET).status,
    ).toBe("ready");
  });

  it("is undisplayable, and reports to Sentry, when an argument can't be converted", () => {
    failTokens();

    expect(
      buildSignTransactionDetailsState(
        sacTransferTransactionXdr(),
        Networks.TESTNET,
      ),
    ).toEqual({ status: "undisplayable" });
    expect(logger.error).toHaveBeenCalledWith(
      "useSignTransactionDetails",
      expect.any(String),
      expect.any(Error),
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("is undisplayable, and reports to Sentry, when only an operation's argument can't be converted", () => {
    failTokens();
    // No auth entries, so only the operation has arguments to convert.
    const xdrString = transferXdr({ args: sacTransferArgs(), auth: [] });

    expect(
      buildSignTransactionDetailsState(xdrString, Networks.TESTNET),
    ).toEqual({ status: "undisplayable" });
    expect(logger.error).toHaveBeenCalledWith(
      "useSignTransactionDetails",
      expect.any(String),
      expect.any(Error),
    );
  });

  it("is undisplayable, and reports to Sentry, when only an auth entry's argument can't be converted", () => {
    failTokens();
    // The operation takes no arguments, so only its auth entry has any to convert.
    const xdrString = transferXdr({
      args: [],
      auth: [
        new xdr.SorobanAuthorizationEntry({
          credentials: xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
          rootInvocation: sacTransferInvocation(),
        }),
      ],
    });

    expect(
      buildSignTransactionDetailsState(xdrString, Networks.TESTNET),
    ).toEqual({ status: "undisplayable" });
    expect(logger.error).toHaveBeenCalledWith(
      "useSignTransactionDetails",
      expect.any(String),
      expect.any(Error),
    );
  });

  it("is undisplayable, and reports to Sentry, when an auth entry's address can't be converted", () => {
    jest.mocked(getAuthEntryBoundAddress).mockImplementation(() => {
      throw new Error("unsupported arm");
    });

    expect(
      buildSignTransactionDetailsState(
        sacTransferTransactionXdr(),
        Networks.TESTNET,
      ),
    ).toEqual({ status: "undisplayable" });
    expect(logger.error).toHaveBeenCalledWith(
      "useSignTransactionDetails",
      expect.any(String),
      expect.any(Error),
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

describe("useSignTransactionDetailsState", () => {
  it("keeps the state stable across renders for the same XDR", () => {
    const { result, rerender } = renderHook(() =>
      useSignTransactionDetailsState({ xdr: sacTransferTransactionXdr() }),
    );
    const first = result.current;

    rerender({});

    expect(result.current).toBe(first);
  });

  it("builds a new state for a new XDR", () => {
    const { result, rerender } = renderHook(
      ({ envelope }: { envelope: string }) =>
        useSignTransactionDetailsState({ xdr: envelope }),
      { initialProps: { envelope: "" } },
    );
    expect(result.current).toEqual({ status: "empty" });

    rerender({ envelope: sacTransferTransactionXdr() });

    expect(result.current.status).toBe("ready");
  });
});

describe("useSignTransactionDetails", () => {
  it("returns the details of a displayable transaction, the same object on every render", () => {
    const envelope = sacTransferTransactionXdr();
    const { result, rerender } = renderHook(() =>
      useSignTransactionDetails({ xdr: envelope }),
    );
    const first = result.current;

    expect(first?.operations).toHaveLength(1);

    rerender({});

    expect(result.current).toBe(first);
  });

  it("returns null when there is nothing to show or it can't be shown", () => {
    const detailsOf = (envelope: string) =>
      renderHook(() => useSignTransactionDetails({ xdr: envelope })).result
        .current;

    expect(detailsOf("")).toBeNull();
    expect(detailsOf("not-xdr")).toBeNull();

    failTokens();

    expect(detailsOf(sacTransferTransactionXdr())).toBeNull();
  });
});

describe("getDisplayableDetails", () => {
  it("hands out the details only when ready", () => {
    const ready = buildSignTransactionDetailsState(
      sacTransferTransactionXdr(),
      Networks.TESTNET,
    );

    expect(getDisplayableDetails(ready)).toBe((ready as ReadyState).details);
    expect(getDisplayableDetails({ status: "empty" })).toBeNull();
    expect(getDisplayableDetails({ status: "undisplayable" })).toBeNull();
  });
});
