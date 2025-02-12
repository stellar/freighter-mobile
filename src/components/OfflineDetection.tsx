import React, {useEffect} from 'react';
import NetInfo from '@react-native-community/netinfo';
import {useDispatch, useSelector} from 'react-redux';
import {setNetworkInfo} from '../reducers/networkInfo';
import {RootState} from '../config/store';
import {OfflineMessage} from './OfflineMessage';
import {debug} from '../helpers/debug';

interface Props {
  children: React.ReactNode;
}

export const OfflineDetection = ({children}: Props) => {
  const dispatch = useDispatch();
  const {isConnected, isInternetReachable} = useSelector(
    (state: RootState) => state.networkInfo,
  );

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      debug(
        'network',
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
    NetInfo.fetch().then(state => {
      debug(
        'network',
        `Initial network state: connected=${state.isConnected}, reachable=${state.isInternetReachable}`,
      );
    });

    return () => {
      debug('network', 'Cleaning up network listener');
      unsubscribe();
    };
  }, [dispatch]);

  const isOffline = !isConnected || !isInternetReachable;

  useEffect(() => {
    debug(
      'network',
      `Network status: ${isOffline ? 'OFFLINE' : 'ONLINE'} (connected=${isConnected}, reachable=${isInternetReachable})`,
    );
  }, [isOffline, isConnected, isInternetReachable]);

  return (
    <>
      {isOffline && <OfflineMessage />}
      {children}
    </>
  );
}; 