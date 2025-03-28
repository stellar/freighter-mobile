export const ROOT_NAVIGATOR_ROUTES = {
  AUTH_STACK: "AuthStack",
  MAIN_TAB_STACK: "MainTabStack",
} as const;

export const AUTH_STACK_ROUTES = {
  WELCOME_SCREEN: "WelcomeScreen",
  CHOOSE_PASSWORD_SCREEN: "ChoosePasswordScreen",
  CONFIRM_PASSWORD_SCREEN: "ConfirmPasswordScreen",
  RECOVERY_PHRASE_ALERT_SCREEN: "RecoveryPhraseAlertScreen",
  RECOVERY_PHRASE_SCREEN: "RecoveryPhraseScreen",
  IMPORT_WALLET_SCREEN: "ImportWalletScreen",
} as const;

export const MAIN_TAB_ROUTES = {
  TAB_HISTORY: "History",
  TAB_HOME: "Home",
  TAB_DISCOVERY: "Discovery",
} as const;

export type RootStackParamList = {
  [ROOT_NAVIGATOR_ROUTES.AUTH_STACK]: undefined;
  [ROOT_NAVIGATOR_ROUTES.MAIN_TAB_STACK]: undefined;
};

export type AuthStackParamList = {
  [AUTH_STACK_ROUTES.WELCOME_SCREEN]: undefined;
  [AUTH_STACK_ROUTES.CHOOSE_PASSWORD_SCREEN]: undefined;
  [AUTH_STACK_ROUTES.CONFIRM_PASSWORD_SCREEN]: {
    password: string;
  };
  [AUTH_STACK_ROUTES.RECOVERY_PHRASE_ALERT_SCREEN]: {
    password: string;
  };
  [AUTH_STACK_ROUTES.RECOVERY_PHRASE_SCREEN]: {
    password: string;
  };
  [AUTH_STACK_ROUTES.IMPORT_WALLET_SCREEN]: undefined;
};

export type MainTabStackParamList = {
  [MAIN_TAB_ROUTES.TAB_HISTORY]: undefined;
  [MAIN_TAB_ROUTES.TAB_HOME]: undefined;
  [MAIN_TAB_ROUTES.TAB_DISCOVERY]: undefined;
};
