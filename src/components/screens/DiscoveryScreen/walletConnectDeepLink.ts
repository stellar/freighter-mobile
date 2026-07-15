interface ForwardWalletConnectDeepLinkOptions {
  url: string;
  nativeRedirect: string;
  openUrl: (url: string) => Promise<unknown>;
  onError: (error: unknown) => void;
}

const isNativeRedirect = (url: string, nativeRedirect: string) => {
  const base = nativeRedirect.replace(/\/+$/, "");
  return (
    Boolean(base) &&
    (url === base || url.startsWith(`${base}/`) || url.startsWith(`${base}?`))
  );
};

/**
 * Forward a WalletConnect custom-scheme navigation out of the WebView and into
 * React Native Linking, where WalletKit's deep-link listener can pair it.
 *
 * @param options - The navigation URL, registered redirect, and native handlers.
 * @returns Whether the URL matched and was consumed as a WalletConnect redirect.
 */
export const forwardWalletConnectDeepLink = ({
  url,
  nativeRedirect,
  openUrl,
  onError,
}: ForwardWalletConnectDeepLinkOptions): boolean => {
  if (!isNativeRedirect(url, nativeRedirect)) return false;

  try {
    Promise.resolve(openUrl(url)).catch(onError);
  } catch (error) {
    onError(error);
  }
  return true;
};
