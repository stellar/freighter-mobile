import React, {useEffect} from 'react';
import NetInfo from '@react-native-community/netinfo';
import {useDispatch, useSelector} from 'react-redux';
import {setNetworkInfo} from '../reducers/networkInfo';
import {RootState} from '../config/store';
import {OfflineMessage} from './OfflineMessage';

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
      dispatch(
        setNetworkInfo({
          isConnected: state.isConnected,
          isInternetReachable: state.isInternetReachable,
        }),
      );
    });

    return () => unsubscribe();
  }, [dispatch]);

  const isOffline = !isConnected || !isInternetReachable;

  return (
    <>
      {isOffline && <OfflineMessage />}
      {children}
    </>
  );
}; 