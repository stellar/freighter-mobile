import { renderHook } from "@testing-library/react-hooks";
import { useDefaultSwapDestination } from "components/screens/SwapScreen/hooks/useDefaultSwapDestination";
import { DEFAULT_SWAP_DEST_TOKEN_ID, NETWORKS } from "config/constants";
import { useBalancesStore } from "ducks/balances";

jest.mock("services/blockaid/api", () => ({
  scanToken: jest.fn(() => new Promise(() => {})),
}));

const PUBLIC_KEY = "GACJYENHYW2LGHBNNGNZ4NCBGZYVTGTZM4CJLQIOQQ5IUZU3SYWOW5EK";
const DEFAULT_ID = DEFAULT_SWAP_DEST_TOKEN_ID[NETWORKS.PUBLIC]!;

const renderSeeding = () => {
  const setDestinationToken = jest.fn();

  renderHook(() =>
    useDefaultSwapDestination({
      network: NETWORKS.PUBLIC,
      publicKey: PUBLIC_KEY,
      swapFromTokenId: "native",
      destinationTokenDescriptor: null,
      setDestinationToken,
    }),
  );

  return setDestinationToken;
};

describe("useDefaultSwapDestination", () => {
  beforeEach(() => {
    useBalancesStore.setState({
      balances: { [DEFAULT_ID]: {} } as any,
      fetchedPublicKey: PUBLIC_KEY,
      fetchedNetwork: NETWORKS.PUBLIC,
      hiddenTokenIds: [],
    });
  });

  afterEach(() => {
    useBalancesStore.setState({ hiddenTokenIds: [] });
  });

  it("seeds the network's default destination", () => {
    const setDestinationToken = renderSeeding();

    expect(setDestinationToken).toHaveBeenCalledWith(
      expect.objectContaining({ id: DEFAULT_ID, requiresTrustline: false }),
    );
  });

  it("leaves the destination empty when the default token is hidden", () => {
    useBalancesStore.setState({ hiddenTokenIds: [DEFAULT_ID] });

    const setDestinationToken = renderSeeding();

    expect(setDestinationToken).not.toHaveBeenCalled();
  });
});
