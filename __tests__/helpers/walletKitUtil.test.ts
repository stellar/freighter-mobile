import { StellarRpcMethods } from "ducks/walletKit";
import { resolveDappRejectionEvent } from "helpers/walletKitUtil";

describe("resolveDappRejectionEvent (dApp-request teardown → signing.*_rejected)", () => {
  const base = {
    requestMethod: StellarRpcMethods.SIGN_XDR,
    hasRequestEvent: true,
    hasResponded: false,
    approvalInFlight: false,
  };

  it("maps each signing method to its rejection event on a genuine dismissal", () => {
    expect(
      resolveDappRejectionEvent({
        ...base,
        requestMethod: StellarRpcMethods.SIGN_MESSAGE,
      }),
    ).toBe("message");
    expect(
      resolveDappRejectionEvent({
        ...base,
        requestMethod: StellarRpcMethods.SIGN_AUTH_ENTRY,
      }),
    ).toBe("auth_entry");
    expect(
      resolveDappRejectionEvent({
        ...base,
        requestMethod: StellarRpcMethods.SIGN_XDR,
      }),
    ).toBe("transaction");
    expect(
      resolveDappRejectionEvent({
        ...base,
        requestMethod: StellarRpcMethods.SIGN_AND_SUBMIT_XDR,
      }),
    ).toBe("transaction");
  });

  // The reviewer's exact concern: an approved/completed request must NOT emit a
  // rejection, even though handleClearDappRequest still runs in the .finally().
  it("returns null once the request has been responded to (approved/completed)", () => {
    expect(
      resolveDappRejectionEvent({ ...base, hasResponded: true }),
    ).toBeNull();
  });

  // approveSessionRequest threw: the WC fallback rejection still fires, but this
  // is an approval attempt, not a user reject — so no analytics rejection.
  it("returns null when an approval attempt was in flight (even if it threw)", () => {
    expect(
      resolveDappRejectionEvent({ ...base, approvalInFlight: true }),
    ).toBeNull();
  });

  it("returns null when there is no active request", () => {
    expect(
      resolveDappRejectionEvent({ ...base, hasRequestEvent: false }),
    ).toBeNull();
  });

  it("returns null for an unrecognized / undefined method", () => {
    expect(
      resolveDappRejectionEvent({ ...base, requestMethod: undefined }),
    ).toBeNull();
  });
});
