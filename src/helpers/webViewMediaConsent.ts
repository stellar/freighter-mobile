import { NativeModules } from "react-native";

interface WebViewMediaConsentModule {
  clearConsent?: () => Promise<void>;
}

const getModule = (): WebViewMediaConsentModule | undefined =>
  NativeModules.WebViewMediaConsent as WebViewMediaConsentModule | undefined;

/**
 * Clears the in-app browser's remembered per-origin camera/microphone consent.
 * Called from the WebView data scrub on logout so a grant doesn't outlive the
 * session or leak to another account on the same device.
 *
 * No-op where the native module isn't present (e.g. iOS, where WKWebView
 * already prompts per-origin and there's no equivalent state to clear).
 */
export const clearWebViewMediaConsent = async (): Promise<void> => {
  const consentModule = getModule();
  if (!consentModule?.clearConsent) return;

  try {
    await consentModule.clearConsent();
  } catch {
    // Best effort — consent also dies with the app process if this ever fails.
  }
};
