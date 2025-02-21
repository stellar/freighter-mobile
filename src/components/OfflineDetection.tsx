import NetInfo from "@react-native-community/netinfo";
import { OfflineMessage } from "components/OfflineMessage";
import { RootState } from "config/store";
import { setNetworkInfo } from "ducks/networkInfo";
import { debug } from "helpers/debug";
import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

interface Props {
  children: React.ReactNode;
}

export const OfflineDetection = ({ children }: Props) => {
  const dispatch = useDispatch();
  const { isConnected, isInternetReachable } = useSelector(
    (state: RootState) => state.networkInfo,
  );

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      debug(
        "network",
        `Connection status changed: connected=${state.isConnected}, reachable=${state.isInternetReachable}`,
      );

      dispatch(
        setNetworkInfo({
          isConnected: state.isConnected,
          isInternetReachable: state.isInternetReachable,
        }),
      );
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
  }, [dispatch]);

  const isOffline = !isConnected || !isInternetReachable;

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
