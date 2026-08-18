import {
  Account,
  Keypair,
  TransactionBuilder,
  Networks,
} from "@stellar/stellar-sdk";
import { renderHook } from "@testing-library/react-hooks";
import { AUTH_STATUS } from "config/types";
import { useAuthenticationStore } from "ducks/auth";

// Use the REAL hook (it is globally mocked in jest.setup.js)
jest.unmock("hooks/useGetActiveAccount");

// The real hook imports the navigation ref from the App entry; stub it so we
// don't pull in the whole app tree
jest.mock("components/App", () => ({
  navigationRef: { isReady: () => false },
}));

// eslint-disable-next-line import/first, @typescript-eslint/no-var-requires
const useGetActiveAccount = require("hooks/useGetActiveAccount").default;

const testKeypair = Keypair.random();

const buildUnsignedTransaction = () => {
  const source = new Account(testKeypair.publicKey(), "1");
  return new TransactionBuilder(source, {
    fee: "100",
    networkPassphrase: Networks.TESTNET,
  })
    .setTimeout(30)
    .build();
};

describe("useGetActiveAccount signing guard", () => {
  beforeEach(() => {
    // Neutralise the mount-time side effects of the real hook
    useAuthenticationStore.setState({
      account: {
        publicKey: testKeypair.publicKey(),
        privateKey: testKeypair.secret(),
        accountName: "Test",
        id: "test-id",
        subentryCount: 0,
      } as never,
      isLoadingAccount: false,
      accountError: null,
      fetchActiveAccount: jest.fn().mockResolvedValue(null),
      refreshActiveAccount: jest.fn(),
      setNavigationRef: jest.fn(),
    });
  });

  it("refuses to sign while soft-locked even though the account is still in the store", () => {
    useAuthenticationStore.setState({
      authStatus: AUTH_STATUS.LOCKED,
      isSoftLocked: true,
    });

    const { result } = renderHook(() => useGetActiveAccount());

    expect(
      result.current.signTransaction(buildUnsignedTransaction()),
    ).toBeNull();
    expect(result.current.signMessage("hello")).toBeNull();
    expect(result.current.signAuthEntry("deadbeef")).toBeNull();
  });

  it("refuses to sign when authStatus is not AUTHENTICATED", () => {
    useAuthenticationStore.setState({
      authStatus: AUTH_STATUS.HASH_KEY_EXPIRED,
      isSoftLocked: false,
    });

    const { result } = renderHook(() => useGetActiveAccount());

    expect(
      result.current.signTransaction(buildUnsignedTransaction()),
    ).toBeNull();
  });

  it("signs when fully unlocked (AUTHENTICATED and not soft-locked)", () => {
    useAuthenticationStore.setState({
      authStatus: AUTH_STATUS.AUTHENTICATED,
      isSoftLocked: false,
    });

    const { result } = renderHook(() => useGetActiveAccount());

    const signedXdr = result.current.signTransaction(
      buildUnsignedTransaction(),
    );
    expect(typeof signedXdr).toBe("string");
    expect(signedXdr).toBeTruthy();
  });
});
