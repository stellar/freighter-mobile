const DEBUG = __DEV__;

const debug = (namespace: string, message: string) => {
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log(`[${namespace}] ${message}`);
  }
};

export default debug;
