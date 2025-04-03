export const ROOT_NAVIGATOR_ROUTES = {
  AUTH_STACK: "AuthStack",
  MAIN_TAB_STACK: "MainTabStack",

  // This screen can be called on both stacks.
  LOCK_SCREEN: "LockScreen",
} as const;

export const AUTH_STACK_ROUTES = {
  WELCOME_SCREEN: "WelcomeScreen",
  CHOOSE_PASSWORD_SCREEN: "ChoosePasswordScreen",
  CONFIRM_PASSWORD_SCREEN: "ConfirmPasswordScreen",
  RECOVERY_PHRASE_ALERT_SCREEN: "RecoveryPhraseAlertScreen",
  RECOVERY_PHRASE_SCREEN: "RecoveryPhraseScreen",
  VALIDATE_RECOVERY_PHRASE_SCREEN: "ValidateRecoveryPhraseScreen",
  IMPORT_WALLET_SCREEN: "ImportWalletScreen",

  // This screen can be called on both stacks.
  LOCK_SCREEN: "LockScreen",
} as const;

export const MAIN_TAB_ROUTES = {
  TAB_HISTORY: "History",
  TAB_HOME: "Home",
  TAB_DISCOVERY: "Discovery",
} as const;

export const MANAGE_ASSETS_ROUTES = {
  MANAGE_ASSETS_SCREEN: "ManageAssetsScreen",
} as const;

export type RootStackParamList = {
  [ROOT_NAVIGATOR_ROUTES.AUTH_STACK]: undefined;
  [ROOT_NAVIGATOR_ROUTES.MAIN_TAB_STACK]: undefined;
  [ROOT_NAVIGATOR_ROUTES.LOCK_SCREEN]: undefined;
};

export type AuthStackParamList = {
  [AUTH_STACK_ROUTES.WELCOME_SCREEN]: undefined;
  [AUTH_STACK_ROUTES.CHOOSE_PASSWORD_SCREEN]: {
    isImporting?: boolean;
  };
  [AUTH_STACK_ROUTES.CONFIRM_PASSWORD_SCREEN]: {
    password: string;
    isImporting?: boolean;
  };
  [AUTH_STACK_ROUTES.RECOVERY_PHRASE_ALERT_SCREEN]: {
    password: string;
  };
  [AUTH_STACK_ROUTES.RECOVERY_PHRASE_SCREEN]: {
    password: string;
  };
  [AUTH_STACK_ROUTES.IMPORT_WALLET_SCREEN]: {
    password: string;
  };
  [AUTH_STACK_ROUTES.LOCK_SCREEN]: undefined;
  [AUTH_STACK_ROUTES.VALIDATE_RECOVERY_PHRASE_SCREEN]: {
    password: string;
    recoveryPhrase: string;
  };
};

export type MainTabStackParamList = {
  [MAIN_TAB_ROUTES.TAB_HISTORY]: undefined;
  [MAIN_TAB_ROUTES.TAB_HOME]: undefined;
  [MAIN_TAB_ROUTES.TAB_DISCOVERY]: undefined;
};

export type ManageAssetsStackParamList = {
  [MANAGE_ASSETS_ROUTES.MANAGE_ASSETS_SCREEN]: undefined;
};
