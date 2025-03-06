import NetInfo from "@react-native-community/netinfo";
import { OfflineMessage } from "components/OfflineMessage";
import { useNetworkStore, useIsOffline } from "config/store";
import { debug } from "helpers/debug";
import React, { useEffect } from "react";

interface Props {
  children: React.ReactNode;
}

export const OfflineDetection = ({ children }: Props) => {
  const { isConnected, isInternetReachable, setNetworkInfo } =
    useNetworkStore();
  const isOffline = useIsOffline();

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      debug(
        "network",
        `Connection status changed: connected=${state.isConnected}, reachable=${state.isInternetReachable}`,
      );

      setNetworkInfo({
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
      });
    });

    // Initial network check
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    NetInfo.fetch()
      .then((state) => {
        debug(
          "network",
          `Initial network state: connected=${state.isConnected}, reachable=${state.isInternetReachable}`,
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
