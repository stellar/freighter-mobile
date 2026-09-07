import { useIsFocused } from "@react-navigation/native";
import {
  APP_VERSION,
  DAPP_APPROVAL_TIMEOUT_MS,
  mapNetworkToNetworkDetails,
  NETWORKS,
} from "config/constants";
import {
  DappApprovalKind,
  DappErrorCode,
  type DappRequest,
} from "config/dappRequest";
import { logger } from "config/logger";
import { useAuthenticationStore } from "ducks/auth";
import { useBrowserTabsStore } from "ducks/browserTabs";
import { useDappApprovalStore } from "ducks/dappApproval";
import { useRemoteConfigStore } from "ducks/remoteConfig";
import { isDev } from "helpers/isEnv";
import useGetActiveAccount, {
  isWalletUnlocked,
} from "hooks/useGetActiveAccount";
import { useEffect, useRef, useCallback, useMemo } from "react";
import { AppState } from "react-native";
import { randomBytes } from "react-native-quick-crypto";
import type { WebView } from "react-native-webview";
import { WebviewBridge } from "services/webview/bridge";
import { prepareSep10Auth } from "services/webview/sep10";

/**
 * Hands a WebView request to WalletKitProvider through the shared approval
 * store and resolves with the user's decision. Rejects with BUSY while
 * another approval (either transport) owns the sheets, and with TIMEOUT once
 * DAPP_APPROVAL_TIMEOUT_MS elapses.
 */
const approve = (
  kind: DappApprovalKind,
  request: DappRequest,
): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const state = useDappApprovalStore.getState();
    if (state.job || state.walletConnectBusy) {
      reject(
        Object.assign(new Error("Another wallet approval is in progress"), {
          code: DappErrorCode.BUSY,
        }),
      );
      return;
    }
    let timeout: ReturnType<typeof setTimeout>;
    const jobRequest: DappRequest = {
      ...request,
      respond: async (response) => {
        clearTimeout(timeout);
        state.clearJob(jobRequest);
        if (kind === DappApprovalKind.SIGN) await request.respond(response);
        if (response.error) reject(response.error);
        else resolve(response.result);
      },
    };
    timeout = setTimeout(() => {
      state.clearJob(jobRequest);
      reject(
        Object.assign(
          new Error("Request timed out; submission outcome may be unknown"),
          { code: DappErrorCode.TIMEOUT },
        ),
      );
    }, DAPP_APPROVAL_TIMEOUT_MS);
    state.setJob({ kind, request: jobRequest });
    state.setWalletConnectBusy(kind === DappApprovalKind.SIGN);
  });

/** Rejects the queued approval when its request went stale before the user decided. */
const cancelInvalidApproval = () => {
  const { job } = useDappApprovalStore.getState();
  if (job && !job.request.isValid()) {
    job.request
      .respond({
        id: job.request.id,
        jsonrpc: "2.0",
        error: {
          code: DappErrorCode.CONTEXT_CHANGED,
          message: "Wallet context changed",
        },
      })
      .catch((error) =>
        logger.warn("WebViewBridge", "Approval cancellation failed", error),
      );
  }
};

/**
 * One WebviewBridge per mounted Discovery tab. Browser lifecycle (navigation,
 * focus, tab switches, disposal) owns transport lifetime; WalletKitProvider
 * owns approval and signing. Everything is gated by the
 * `webview_provider_enabled` remote-config flag.
 */
export const useWebviewBridge = (
  refs: React.MutableRefObject<Record<string, WebView | null>>,
) => {
  const enabled = useRemoteConfigStore(
    (state) => state.webview_provider_enabled,
  );
  const { signTransaction } = useGetActiveAccount();
  const signTransactionRef = useRef(signTransaction);
  signTransactionRef.current = signTransaction;
  const focused = useIsFocused();
  const focusedRef = useRef(focused);
  focusedRef.current = focused;
  const bridges = useRef(new Map<string, WebviewBridge>());
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const get = useCallback(
    (tabId: string) => {
      let bridge = bridges.current.get(tabId);
      if (!bridge) {
        bridge = new WebviewBridge({
          version: APP_VERSION,
          development: isDev,
          token: () => randomBytes(24).toString("hex"),
          inject: (script) => refs.current[tabId]?.injectJavaScript(script),
          approve,
          onInvalidated: cancelInvalidApproval,
          prepareAuth: (origin, account) =>
            useRemoteConfigStore.getState().webview_auto_signin_enabled
              ? prepareSep10Auth({
                  origin,
                  account,
                  development: isDev,
                  signTransaction: (tx) => signTransactionRef.current(tx),
                })
              : Promise.resolve(null),
          context: () => {
            const browser = useBrowserTabsStore.getState();
            const auth = useAuthenticationStore.getState();
            // "inactive" is transient on iOS (Face ID for the signing confirmation, the
            // notification shade, an incoming call banner); only "background" means
            // the user left. Treating inactive as lost context cancelled in-flight
            // signatures right as the wallet approved them (CONTEXT_CHANGED).
            const active =
              enabledRef.current &&
              focusedRef.current &&
              AppState.currentState !== "background" &&
              browser.activeTabId === tabId &&
              !browser.showTabOverview;
            const supported =
              auth.network === NETWORKS.PUBLIC ||
              auth.network === NETWORKS.TESTNET;
            return {
              active,
              account:
                isWalletUnlocked() && supported && auth.account
                  ? {
                      address: auth.account.publicKey,
                      chainId:
                        auth.network === NETWORKS.PUBLIC
                          ? "stellar:pubnet"
                          : "stellar:testnet",
                      networkPassphrase: mapNetworkToNetworkDetails(
                        auth.network,
                      ).networkPassphrase,
                    }
                  : null,
            };
          },
        });
        bridges.current.set(tabId, bridge);
      }
      return bridge;
    },
    [refs],
  );

  useEffect(() => {
    const update = () => {
      const ids = new Set(
        useBrowserTabsStore.getState().tabs.map((tab) => tab.id),
      );
      bridges.current.forEach((bridge, id) => {
        if (!ids.has(id)) {
          bridge.navigationStarted();
          bridges.current.delete(id);
        } else bridge.contextChanged();
      });
      cancelInvalidApproval();
    };
    const authUnsubscribe = useAuthenticationStore.subscribe(update);
    const browserUnsubscribe = useBrowserTabsStore.subscribe(update);
    const appSubscription = AppState.addEventListener("change", update);
    update();
    return () => {
      authUnsubscribe();
      browserUnsubscribe();
      appSubscription.remove();
    };
  }, [focused, enabled]);

  // Tabs restored at app start load before remote config resolves, so their
  // documents only got the beacon injection. Once the flag turns on, activate
  // the bridge on every mounted tab instead of waiting for its next navigation
  // (activateBridge carries the idempotent bootstrap, so a late inject is safe).
  useEffect(() => {
    if (!enabled) return;
    useBrowserTabsStore.getState().tabs.forEach((tab) => {
      const bridge = bridges.current.get(tab.id);
      if (bridge) bridge.loaded(tab.url);
    });
  }, [enabled]);

  useEffect(
    () => () => {
      bridges.current.forEach((bridge) => bridge.navigationStarted());
      bridges.current.clear();
      cancelInvalidApproval();
    },
    [],
  );

  return useMemo(
    () => ({
      enabled,
      start: (id: string, url: string) => {
        get(id).navigationStarted(url);
        cancelInvalidApproval();
      },
      loaded: (id: string, url: string) => {
        if (enabled) get(id).loaded(url);
      },
      receive: (id: string, data: string, origin: string) =>
        get(id).receive(data, origin),
      dispose: (id: string) => {
        bridges.current.get(id)?.navigationStarted();
        bridges.current.delete(id);
        cancelInvalidApproval();
      },
    }),
    [enabled, get],
  );
};
