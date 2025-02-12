export const ROUTES = {
  // Auth Stack
  LOGIN: 'Login',
  MAIN_TABS: 'MainTabs',
  
  // Tab Stack
  TAB_HOME: 'Home',
  TAB_WALLET: 'Wallet',
  TAB_SEND: 'Send',
  TAB_RECEIVE: 'Receive',
  TAB_SETTINGS: 'Settings',
} as const;

export type RootStackParamList = {
  [ROUTES.LOGIN]: undefined;
  [ROUTES.MAIN_TABS]: undefined;
};

export type TabStackParamList = {
  [ROUTES.TAB_HOME]: undefined;
  [ROUTES.TAB_WALLET]: undefined;
  [ROUTES.TAB_SEND]: undefined;
  [ROUTES.TAB_RECEIVE]: undefined;
  [ROUTES.TAB_SETTINGS]: undefined;
}; 