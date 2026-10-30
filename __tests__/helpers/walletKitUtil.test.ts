import { StellarRpcMethods } from "ducks/walletKit";
import {
  isDappRequestUndisplayable,
  resolveDappRejectionEvent,
} from "helpers/walletKitUtil";

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

describe("isDappRequestUndisplayable (a request the app can't display can only be rejected)", () => {
  const base = {
    signTransactionDetailsStatus: "ready" as const,
    isAuthEntryDisplayable: true,
    hasDetailsRenderError: false,
  };

  it.each([StellarRpcMethods.SIGN_XDR, StellarRpcMethods.SIGN_AND_SUBMIT_XDR])(
    "%s fails closed unless its details are ready",
    (requestMethod) => {
      expect(isDappRequestUndisplayable({ ...base, requestMethod })).toBe(
        false,
      );
      expect(
        isDappRequestUndisplayable({
          ...base,
          requestMethod,
          signTransactionDetailsStatus: "undisplayable",
        }),
      ).toBe(true);
      expect(
        isDappRequestUndisplayable({
          ...base,
          requestMethod,
          signTransactionDetailsStatus: "empty",
        }),
      ).toBe(true);
    },
  );

  it("fails an auth entry closed only when its invocation can't be displayed", () => {
    const authEntry = {
      ...base,
      requestMethod: StellarRpcMethods.SIGN_AUTH_ENTRY,
      signTransactionDetailsStatus: "empty" as const,
    };

    expect(isDappRequestUndisplayable(authEntry)).toBe(false);
    expect(
      isDappRequestUndisplayable({
        ...authEntry,
        isAuthEntryDisplayable: false,
      }),
    ).toBe(true);
  });

  it("never fails a sign_message request closed for display reasons", () => {
    expect(
      isDappRequestUndisplayable({
        ...base,
        requestMethod: StellarRpcMethods.SIGN_MESSAGE,
        signTransactionDetailsStatus: "empty",
        isAuthEntryDisplayable: false,
      }),
    ).toBe(false);
  });

  it("fails a request closed once its details tripped the error boundary", () => {
    [StellarRpcMethods.SIGN_XDR, StellarRpcMethods.SIGN_AUTH_ENTRY].forEach(
      (requestMethod) =>
        expect(
          isDappRequestUndisplayable({
            ...base,
            requestMethod,
            hasDetailsRenderError: true,
          }),
        ).toBe(true),
    );
  });

  it("returns false when there is no request", () => {
    expect(
      isDappRequestUndisplayable({
        ...base,
        requestMethod: undefined,
        signTransactionDetailsStatus: "empty",
      }),
    ).toBe(false);
  });
});
