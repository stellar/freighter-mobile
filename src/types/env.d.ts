declare module "react-native-config" {
  interface NativeConfig {
    WALLET_KIT_PROJECT_ID: string;
  }
  const Config: NativeConfig;
  export default Config;
}