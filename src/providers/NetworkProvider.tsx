import NetInfo from "@react-native-community/netinfo";
import { OfflineMessage } from "components/OfflineMessage";
import { useNetworkStore } from "ducks/networkInfo";
import { debug } from "helpers/debug";
import React, { useEffect } from "react";

interface Props {
  children: React.ReactNode;
}

const NETWORK_CHECK_INITIAL_DELAY = 1000;

export const NetworkProvider = ({ children }: Props) => {
  const { isConnected, isInternetReachable, isOffline, setNetworkInfo } =
    useNetworkStore();

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    // Initial network check to consume initial "null" values
    // and avoid UI glitches due to initial network state
    NetInfo.fetch();

    // We still need to wait a while before subscribing to the network change event
    // otherwise we could get the initial transient "null" values which would cause a UI glitch
    const initialSetupTimeout = setTimeout(() => {
      unsubscribe = NetInfo.addEventListener((event) => {
        debug(
          "network",
          `Connection status changed: connected=${event.isConnected}, reachable=${event.isInternetReachable}`,
        );

        setNetworkInfo(event);
      });
    }, NETWORK_CHECK_INITIAL_DELAY);

    return () => {
      debug("network", "Cleaning up network listener");
      clearTimeout(initialSetupTimeout);
      unsubscribe?.();
    };
  }, [setNetworkInfo]);

  useEffect(() => {
    debug(
      "network",
      `Network status: ${isOffline ? "OFFLINE" : "ONLINE"} (connected=${isConnected}, reachable=${isInternetReachable})`,
    );
  }, [isOffline, isConnected, isInternetReachable]);

  return (
    <>
      {isOffline && <OfflineMessage />}
      {children}
    </>
  );
};
