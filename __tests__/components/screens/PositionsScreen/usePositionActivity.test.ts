import { renderHook } from "@testing-library/react-native";
import { POOL_ID, USDC_SAC } from "__tests__/support/positionFixtures";
import { usePositionActivity } from "components/screens/PositionsScreen/hooks/usePositionActivity";
import { NETWORKS, mapNetworkToNetworkDetails } from "config/constants";
import { useHistoryStore } from "ducks/history";

const networkDetails = mapNetworkToNetworkDetails(NETWORKS.PUBLIC);
const params = {
  poolId: POOL_ID,
  assetId: USDC_SAC,
  publicKey: "GACCOUNT",
  networkDetails,
};

describe("usePositionActivity", () => {
  const fetchAccountHistory = jest.fn(() => Promise.resolve());

  beforeEach(() => {
    jest.clearAllMocks();
    useHistoryStore.setState({ rawHistoryData: null, fetchAccountHistory });
  });

  // History polls every 30 seconds, and an account switch clears it, so it
  // can be missing when a position opens.
  it("loads History when none is loaded, without History's own spinner", () => {
    const { result } = renderHook(() => usePositionActivity(params));

    expect(result.current).toBeNull();
    expect(fetchAccountHistory).toHaveBeenCalledWith({
      publicKey: "GACCOUNT",
      network: NETWORKS.PUBLIC,
      isBackgroundRefresh: true,
    });
  });

  it("reads the History already loaded, without loading it again", () => {
    useHistoryStore.setState({
      rawHistoryData: { balances: {}, rawOperations: [] },
    });

    const { result } = renderHook(() => usePositionActivity(params));

    expect(result.current).toEqual([]);
    expect(fetchAccountHistory).not.toHaveBeenCalled();
  });
});
