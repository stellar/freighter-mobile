interface ParsedWalletConnectDeepLink {
  isAppScheme: boolean;
  pairingUri: string | null;
}

interface ForwardWalletConnectDeepLinkOptions {
  url: string;
  nativeRedirect: string;
  openUrl: (url: string) => Promise<unknown>;
  onError: (error: unknown) => void;
}

const scheme = (value: string) =>
  value
    .trim()
    .match(/^([a-z][a-z\d+.-]*):/i)?.[1]
    .toLowerCase() ?? null;

const expectedRoutes = (nativeRedirect: string) => {
  const redirect = nativeRedirect.trim();
  if (redirect.endsWith("://")) {
    return [`${redirect}wc`, `${redirect}/wc`];
  }
  return [`${redirect.replace(/\/+$/, "")}/wc`];
};

const isWalletConnectPairingUri = (uri: string) => {
  const match = uri.match(/^wc:([0-9a-f]{64})@2\?(.+)$/i);
  if (!match) return false;
  const params = new URLSearchParams(match[2]);
  return (
    Boolean(params.get("relay-protocol")) &&
    /^[0-9a-f]{64}$/i.test(params.get("symKey") ?? "")
  );
};

/**
 * Parse only the registered WalletConnect route and a decodable v2 pairing URI.
 * URLs using the app's custom scheme are identified even when malformed so the
 * WebView can consume them without attempting a navigation.
 *
 * @param url - The candidate deep link.
 * @param nativeRedirect - The custom-scheme redirect registered by the app.
 * @returns Whether the app owns the scheme and the validated pairing URI, if any.
 */
export const parseWalletConnectDeepLink = (
  url: string,
  nativeRedirect: string,
): ParsedWalletConnectDeepLink => {
  const appScheme = scheme(nativeRedirect);
  if (!appScheme || scheme(url) !== appScheme) {
    return { isAppScheme: false, pairingUri: null };
  }

  const queryIndex = url.indexOf("?");
  const route = queryIndex === -1 ? url : url.slice(0, queryIndex);
  const isExpectedRoute = expectedRoutes(nativeRedirect).some(
    (expected) => expected.toLowerCase() === route.toLowerCase(),
  );
  if (!isExpectedRoute || queryIndex === -1) {
    return { isAppScheme: true, pairingUri: null };
  }

  const rawUri = url
    .slice(queryIndex + 1)
    .split("&")
    .find((part) => part.startsWith("uri="))
    ?.slice(4);
  if (!rawUri) return { isAppScheme: true, pairingUri: null };

  try {
    const pairingUri = decodeURIComponent(rawUri);
    return {
      isAppScheme: true,
      pairingUri: isWalletConnectPairingUri(pairingUri) ? pairingUri : null,
    };
  } catch {
    return { isAppScheme: true, pairingUri: null };
  }
};

/**
 * Forward a valid WalletConnect custom-scheme navigation out of the WebView and
 * into React Native Linking, where WalletKit's deep-link listener can pair it.
 *
 * @param options - The navigation URL, registered redirect, and native handlers.
 * @returns Whether the URL belongs to the app and must be consumed by the WebView.
 */
export const forwardWalletConnectDeepLink = ({
  url,
  nativeRedirect,
  openUrl,
  onError,
}: ForwardWalletConnectDeepLinkOptions): boolean => {
  const parsed = parseWalletConnectDeepLink(url, nativeRedirect);
  if (!parsed.isAppScheme) return false;
  if (!parsed.pairingUri) return true;

  try {
    Promise.resolve(openUrl(url)).catch(onError);
  } catch (error) {
    onError(error);
  }
  return true;
};
