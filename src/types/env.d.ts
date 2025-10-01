declare module "react-native-config" {
  interface NativeConfig {
    AMPLITUDE_API_KEY: string;
    AMPLITUDE_EXPERIMENT_DEPLOYMENT_KEY: string;
    SENTRY_DSN: string;

    FREIGHTER_BACKEND_URL: string;
    FREIGHTER_BACKEND_V2_URL: string;

    WALLET_KIT_PROJECT_ID: string;
    WALLET_KIT_MT_NAME: string;
    WALLET_KIT_MT_DESCRIPTION: string;
    WALLET_KIT_MT_URL: string;
    WALLET_KIT_MT_ICON: string;
    WALLET_KIT_MT_REDIRECT_NATIVE: string;
  }
  const Config: NativeConfig;
  export default Config;
}
