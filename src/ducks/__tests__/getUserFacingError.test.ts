import { getUserFacingError } from "ducks/auth";
import { t } from "i18next";

describe("getUserFacingError", () => {
  it("passes through a known, already-translated auth error message", () => {
    const invalidPassword = t("authStore.error.invalidPassword");
    const error = new Error(invalidPassword);

    expect(getUserFacingError(error, "authStore.error.failedToSignIn")).toBe(
      invalidPassword,
    );
  });

  it("replaces a raw native error message with the generic fallback", () => {
    const error = new Error(
      "Keychain write rejected: User interaction is not allowed.",
    );

    expect(getUserFacingError(error, "authStore.error.failedToSignIn")).toBe(
      t("authStore.error.failedToSignIn"),
    );
  });

  it("downgrades a real authStore.error key that is absent from the safe set", () => {
    // failedToSignIn is a generic fallback key, not an intentionally-thrown
    // user-facing message, so it must NOT be passed through even though it is
    // a valid translation. Guards against accidentally widening the safe set.
    const error = new Error(t("authStore.error.failedToSignIn"));

    expect(
      getUserFacingError(error, "authStore.error.failedToLoadAccount"),
    ).toBe(t("authStore.error.failedToLoadAccount"));
  });

  it("uses the fallback for a non-Error throw", () => {
    expect(
      getUserFacingError("some string", "authStore.error.failedToImportWallet"),
    ).toBe(t("authStore.error.failedToImportWallet"));
  });
});
