import NetInfo from "@react-native-community/netinfo";
import { OfflineMessage } from "components/OfflineMessage";
import { useNetworkStore } from "ducks/networkInfo";
import { debug } from "helpers/debug";
import React, { useEffect } from "react";

interface Props {
  children: React.ReactNode;
}

export const OfflineDetection = ({ children }: Props) => {
  const { isConnected, isInternetReachable, isOffline, setNetworkInfo } =
    useNetworkStore();

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((event) => {
      debug(
        "network",
        `Connection status changed: connected=${event.isConnected}, reachable=${event.isInternetReachable}`,
      );

      setNetworkInfo({
        isConnected: event.isConnected,
        isInternetReachable: event.isInternetReachable,
      });
    });

    // Initial network check
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    NetInfo.fetch()
      .then((networkState) => {
        debug(
          "network",
          `Initial network state: connected=${networkState.isConnected}, reachable=${networkState.isInternetReachable}`,
        );
      })
      .catch((error: Error) => {
        debug(
          "network",
          `Failed to fetch initial network state: ${error.message}`,
        );
      });

    return () => {
      debug("network", "Cleaning up network listener");
      unsubscribe();
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
