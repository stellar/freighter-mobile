const DEBUG = __DEV__;

export const debug = (namespace: string, message: string) => {
  if (DEBUG) {
    console.log(`[${namespace}] ${message}`);
  }
}; 