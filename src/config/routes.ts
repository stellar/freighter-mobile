export const ROOT_NAVIGATOR_ROUTES = {
  AUTH_STACK: "AuthStack",
  MAIN_TAB_STACK: "MainTabStack",
  SETTINGS_STACK: "SettingsStack",
  SEND_PAYMENT_STACK: "SendPaymentStack",
  MANAGE_ASSETS_STACK: "ManageAssetsStack",
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
  ADD_ASSET_SCREEN: "AddAssetScreen",
} as const;

export const SETTINGS_ROUTES = {
  SETTINGS_SCREEN: "SettingsScreen",
} as const;

export const SEND_PAYMENT_ROUTES = {
  SEND_PAYMENT_SCREEN: "SendPaymentScreen",
  TRANSACTION_DETAILS_SCREEN: "TransactionDetailsScreen",
  TRANSACTION_AMOUNT_SCREEN: "TransactionAmountScreen",
  TRANSACTION_MEMO_SCREEN: "TransactionMemoScreen",
  TRANSACTION_TIMEOUT_SCREEN: "TransactionTimeoutScreen",
  TRANSACTION_FEE_SCREEN: "TransactionFeeScreen",
} as const;

export type RootStackParamList = {
  [ROOT_NAVIGATOR_ROUTES.AUTH_STACK]: undefined;
  [ROOT_NAVIGATOR_ROUTES.MAIN_TAB_STACK]: undefined;
  [ROOT_NAVIGATOR_ROUTES.MANAGE_ASSETS_STACK]: undefined;
  [ROOT_NAVIGATOR_ROUTES.LOCK_SCREEN]: undefined;
  [ROOT_NAVIGATOR_ROUTES.SETTINGS_STACK]: undefined;
  [ROOT_NAVIGATOR_ROUTES.SEND_PAYMENT_STACK]: undefined;
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
  [MANAGE_ASSETS_ROUTES.ADD_ASSET_SCREEN]: undefined;
};

export type SettingsStackParamList = {
  [SETTINGS_ROUTES.SETTINGS_SCREEN]: undefined;
};

export type SendPaymentStackParamList = {
  [SEND_PAYMENT_ROUTES.SEND_PAYMENT_SCREEN]: undefined;
  [SEND_PAYMENT_ROUTES.TRANSACTION_DETAILS_SCREEN]: {
    address: string;
  };
  [SEND_PAYMENT_ROUTES.TRANSACTION_AMOUNT_SCREEN]: {
    address: string;
    tokenId: string;
  };
  [SEND_PAYMENT_ROUTES.TRANSACTION_MEMO_SCREEN]: {
    address: string;
    tokenId: string;
  };
  [SEND_PAYMENT_ROUTES.TRANSACTION_TIMEOUT_SCREEN]: {
    address: string;
    tokenId: string;
  };
  [SEND_PAYMENT_ROUTES.TRANSACTION_FEE_SCREEN]: {
    address: string;
    tokenId: string;
    tokenCode: string;
  };
};
