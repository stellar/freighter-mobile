import { networkInfoReducer, setNetworkInfo } from "ducks/networkInfo";

describe("networkInfo reducer", () => {
  const initialState = {
    isConnected: true,
    isInternetReachable: true,
  };

  it("should return the initial state", () => {
    expect(networkInfoReducer(undefined, { type: "@@redux/INIT" })).toEqual(
      initialState,
    );
  });

  it("should handle setNetworkInfo", () => {
    const newState = {
      isConnected: false,
      isInternetReachable: false,
    };

    expect(networkInfoReducer(initialState, setNetworkInfo(newState))).toEqual(
      newState,
    );
  });
});
