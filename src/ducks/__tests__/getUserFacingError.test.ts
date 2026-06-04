import { getUserFacingError } from "ducks/auth";
import i18n from "i18n";
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

  it("passes a known message through when the active language is non-English", async () => {
    const originalLanguage = i18n.language;
    try {
      await i18n.changeLanguage("pt");
      const invalidPasswordPt = t("authStore.error.invalidPassword");
      const error = new Error(invalidPasswordPt);

      expect(getUserFacingError(error, "authStore.error.failedToSignIn")).toBe(
        invalidPasswordPt,
      );
    } finally {
      // Always restore the language so a failed assertion can't leak "pt"
      // into subsequent tests.
      await i18n.changeLanguage(originalLanguage);
    }
  });
});
