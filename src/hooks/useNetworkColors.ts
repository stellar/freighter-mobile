import { NETWORKS } from "config/constants";
import useColors from "hooks/useColors";

const useNetworkColors = () => {
  const { themeColors } = useColors();

  const networkColors = {
    [NETWORKS.TESTNET]: themeColors.pink[9],
    [NETWORKS.PUBLIC]: themeColors.lime[9],
    [NETWORKS.FUTURENET]: themeColors.mint[9],
  };

  return networkColors;
};

export default useNetworkColors;
