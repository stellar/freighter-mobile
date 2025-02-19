export const ROUTES = {
  // Auth Stack
  LOGIN: 'Login',
  MAIN_TABS: 'MainTabs',

  // Tab Stack
  TAB_HOME: 'Home',
  TAB_SWAP: 'Swap',
  TAB_HISTORY: 'History',
  TAB_SETTINGS: 'Settings',
} as const;

export type RootStackParamList = {
  [ROUTES.LOGIN]: undefined;
  [ROUTES.MAIN_TABS]: undefined;
};

export type TabStackParamList = {
  [ROUTES.TAB_HOME]: undefined;
  [ROUTES.TAB_SWAP]: undefined;
  [ROUTES.TAB_HISTORY]: undefined;
  [ROUTES.TAB_SETTINGS]: undefined;
};
