// Initialize the app i18n instance so t() resolves real translations rather
// than returning undefined (which would make these assertions vacuous).
import { getUserFacingError } from "ducks/auth";
import "i18n";
import { t } from "i18next";

describe("getUserFacingError", () => {
  it("passes an intentionally-thrown auth error message through unchanged", () => {
    const invalidPassword = t("authStore.error.invalidPassword");
    // Guard against a vacuous (undefined === undefined) assertion.
    expect(invalidPassword).toBeTruthy();

    const result = getUserFacingError(
      new Error(invalidPassword),
      "authStore.error.failedToSignIn",
    );

    expect(result).toBe(invalidPassword);
    // Must NOT have been downgraded to the generic fallback.
    expect(result).not.toBe(t("authStore.error.failedToSignIn"));
  });

  it("replaces a raw native error message with the generic fallback", () => {
    const result = getUserFacingError(
      new Error("Keychain write rejected: User interaction is not allowed."),
      "authStore.error.failedToSignIn",
    );

    expect(result).toBe(t("authStore.error.failedToSignIn"));
    expect(result).toBeTruthy();
  });

  it("downgrades a real authStore.error key that is absent from the safe set", () => {
    // failedToSignIn is a generic fallback key, not an intentionally-thrown
    // user-facing message, so it must NOT be passed through even though it is
    // a valid translation. Guards against accidentally widening the safe set.
    const result = getUserFacingError(
      new Error(t("authStore.error.failedToSignIn")),
      "authStore.error.failedToLoadAccount",
    );

    expect(result).toBe(t("authStore.error.failedToLoadAccount"));
    expect(result).not.toBe(t("authStore.error.failedToSignIn"));
  });

  it("uses the fallback for a non-Error throw", () => {
    expect(
      getUserFacingError("some string", "authStore.error.failedToImportWallet"),
    ).toBe(t("authStore.error.failedToImportWallet"));
  });

  it.each([
    "authStore.error.hashKeyNotFound",
    "authStore.error.temporaryStoreNotFound",
    "authStore.error.privateKeyNotFound",
    "authStore.error.noKeyPairFound",
  ])(
    "replaces cryptographic/internal jargon '%s' with the fallback (not whitelisted)",
    (key) => {
      const internalMessage = t(key);
      expect(internalMessage).toBeTruthy();

      const fallback = "authStore.error.failedToLoadAccount";
      const result = getUserFacingError(new Error(internalMessage), fallback);

      expect(result).toBe(t(fallback));
      expect(result).not.toBe(internalMessage);
    },
  );

  it.each([
    "authStore.error.accountNotFound",
    "authStore.error.accountListNotFound",
    "authStore.error.noActiveAccount",
  ])(
    "passes through plain user-understandable message '%s' unchanged",
    (key) => {
      const message = t(key);
      expect(message).toBeTruthy();

      const result = getUserFacingError(
        new Error(message),
        "authStore.error.failedToLoadAccount",
      );

      expect(result).toBe(message);
    },
  );
});
