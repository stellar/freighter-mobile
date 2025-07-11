import { NavigatorScreenParams } from "@react-navigation/native";
import { NETWORKS } from "config/constants";

export const ROOT_NAVIGATOR_ROUTES = {
  AUTH_STACK: "AuthStack",
  MAIN_TAB_STACK: "MainTabStack",
  SETTINGS_STACK: "SettingsStack",
  BUY_XLM_STACK: "BuyXLMStack",
  SEND_PAYMENT_STACK: "SendPaymentStack",
  SWAP_STACK: "SwapStack",
  MANAGE_ASSETS_STACK: "ManageAssetsStack",
  MANAGE_WALLETS_STACK: "ManageWalletsStack",
  // This screen can be called on both stacks.
  LOCK_SCREEN: "LockScreen",
  ACCOUNT_QR_CODE_SCREEN: "AccountQRCodeScreen",
  TOKEN_DETAILS_SCREEN: "TokenDetailsScreen",
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
  PREFERENCES_SCREEN: "PreferencesScreen",
  CHANGE_NETWORK_SCREEN: "ChangeNetworkScreen",
  NETWORK_SETTINGS_SCREEN: "NetworkSettingsScreen",
  SHARE_FEEDBACK_SCREEN: "ShareFeedbackScreen",
  ABOUT_SCREEN: "AboutScreen",
  SECURITY_SCREEN: "SecurityScreen",
  SHOW_RECOVERY_PHRASE_SCREEN: "ShowRecoveryPhraseScreen",
  YOUR_RECOVERY_PHRASE_SCREEN: "YourRecoveryPhraseScreen",
} as const;

export const MANAGE_WALLETS_ROUTES = {
  ADD_ANOTHER_WALLET_SCREEN: "AddAnotherWalletScreen",
  VERIFY_PASSWORD_SCREEN: "VerifyPasswordScreen",
  IMPORT_SECRET_KEY_SCREEN: "ImportSecretKeyScreen",
} as const;

export const BUY_XLM_ROUTES = {
  BUY_XLM_SCREEN: "BuyXLMScreen",
} as const;

export const SEND_PAYMENT_ROUTES = {
  SEND_SEARCH_CONTACTS_SCREEN: "SendSearchContactsScreen",
  TRANSACTION_TOKEN_SCREEN: "TransactionTokenScreen",
  TRANSACTION_AMOUNT_SCREEN: "TransactionAmountScreen",
  TRANSACTION_MEMO_SCREEN: "TransactionMemoScreen",
  TRANSACTION_TIMEOUT_SCREEN: "TransactionTimeoutScreen",
  TRANSACTION_FEE_SCREEN: "TransactionFeeScreen",
} as const;

export const SWAP_ROUTES = {
  SWAP_SCREEN: "SwapScreen",
  SWAP_AMOUNT_SCREEN: "SwapAmountScreen",
  SWAP_FEE_SCREEN: "SwapFeeScreen",
  SWAP_TIMEOUT_SCREEN: "SwapTimeoutScreen",
  SWAP_SLIPPAGE_SCREEN: "SwapSlippageScreen",
} as const;

export type RootStackParamList = {
  [ROOT_NAVIGATOR_ROUTES.AUTH_STACK]: undefined;
  [ROOT_NAVIGATOR_ROUTES.MAIN_TAB_STACK]: undefined;
  [ROOT_NAVIGATOR_ROUTES.MANAGE_ASSETS_STACK]: undefined;
  [ROOT_NAVIGATOR_ROUTES.MANAGE_WALLETS_STACK]: undefined;
  [ROOT_NAVIGATOR_ROUTES.LOCK_SCREEN]: undefined;
  [ROOT_NAVIGATOR_ROUTES.SETTINGS_STACK]: undefined;
  [ROOT_NAVIGATOR_ROUTES.ACCOUNT_QR_CODE_SCREEN]: {
    showNavigationAsCloseButton?: boolean;
  };
  [ROOT_NAVIGATOR_ROUTES.BUY_XLM_STACK]: NavigatorScreenParams<BuyXLMStackParamList>;
  [ROOT_NAVIGATOR_ROUTES.SEND_PAYMENT_STACK]: undefined;
  [ROOT_NAVIGATOR_ROUTES.SWAP_STACK]: undefined;
  [ROOT_NAVIGATOR_ROUTES.TOKEN_DETAILS_SCREEN]: {
    tokenId: string;
    tokenSymbol: string;
  };
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
  [SETTINGS_ROUTES.PREFERENCES_SCREEN]: undefined;
  [SETTINGS_ROUTES.CHANGE_NETWORK_SCREEN]: undefined;
  [SETTINGS_ROUTES.NETWORK_SETTINGS_SCREEN]: {
    selectedNetwork: NETWORKS;
  };
  [SETTINGS_ROUTES.SHARE_FEEDBACK_SCREEN]: undefined;
  [SETTINGS_ROUTES.ABOUT_SCREEN]: undefined;
  [SETTINGS_ROUTES.SECURITY_SCREEN]: undefined;
  [SETTINGS_ROUTES.SHOW_RECOVERY_PHRASE_SCREEN]: undefined;
  [SETTINGS_ROUTES.YOUR_RECOVERY_PHRASE_SCREEN]: {
    recoveryPhrase: string;
  };
};

export type ManageWalletsStackParamList = {
  [MANAGE_WALLETS_ROUTES.ADD_ANOTHER_WALLET_SCREEN]: undefined;
  [MANAGE_WALLETS_ROUTES.VERIFY_PASSWORD_SCREEN]: undefined;
  [MANAGE_WALLETS_ROUTES.IMPORT_SECRET_KEY_SCREEN]: undefined;
};

export type BuyXLMStackParamList = {
  [BUY_XLM_ROUTES.BUY_XLM_SCREEN]: {
    isUnfunded: boolean;
  };
  [ROOT_NAVIGATOR_ROUTES.ACCOUNT_QR_CODE_SCREEN]: {
    showNavigationAsCloseButton?: boolean;
  };
};

export type SendPaymentStackParamList = {
  [SEND_PAYMENT_ROUTES.SEND_SEARCH_CONTACTS_SCREEN]: undefined;
  [SEND_PAYMENT_ROUTES.TRANSACTION_TOKEN_SCREEN]: undefined;
  [SEND_PAYMENT_ROUTES.TRANSACTION_AMOUNT_SCREEN]: undefined;
  [SEND_PAYMENT_ROUTES.TRANSACTION_MEMO_SCREEN]: undefined;
  [SEND_PAYMENT_ROUTES.TRANSACTION_TIMEOUT_SCREEN]: undefined;
  [SEND_PAYMENT_ROUTES.TRANSACTION_FEE_SCREEN]: undefined;
};

export type SwapStackParamList = {
  [SWAP_ROUTES.SWAP_SCREEN]: undefined;
  [SWAP_ROUTES.SWAP_AMOUNT_SCREEN]: {
    tokenId: string;
    tokenSymbol: string;
  };
  [SWAP_ROUTES.SWAP_FEE_SCREEN]: undefined;
  [SWAP_ROUTES.SWAP_TIMEOUT_SCREEN]: undefined;
  [SWAP_ROUTES.SWAP_SLIPPAGE_SCREEN]: undefined;
};
