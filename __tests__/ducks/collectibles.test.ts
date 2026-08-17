import { NETWORKS } from "config/constants";
import { useCollectiblesStore } from "ducks/collectibles";
import {
  retrieveCollectiblesContracts,
  retrieveHiddenCollectibles,
  transformBackendCollections,
} from "helpers/collectibles";
import { fetchCollectibles as apiFetchCollectibles } from "services/backend";

jest.mock("helpers/collectibles", () => ({
  retrieveCollectiblesContracts: jest.fn(),
  retrieveHiddenCollectibles: jest.fn(),
  transformBackendCollections: jest.fn(),
  addCollectibleToStorage: jest.fn(),
  removeCollectibleFromStorage: jest.fn(),
  addHiddenCollectibleToStorage: jest.fn(),
  removeHiddenCollectibleFromStorage: jest.fn(),
}));

jest.mock("services/backend", () => ({
  fetchCollectibles: jest.fn(),
}));

const PK = "GDNF5WJ2BEPABVBXCF4C7KZKM3XYXP27VUE3SCGPZA3VXWWZ7OFA3VPM";

/**
 * The fetch stamp is what lets a caller tell "this account holds no
 * collectibles" apart from "we haven't looked yet" — an empty `collections`
 * array means both. Home relies on it to decide whether the Add CTA belongs in
 * the empty state or in the floating pill, so a missing stamp shows the wrong
 * one and then corrects itself.
 */
describe("collectibles duck fetch stamp", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useCollectiblesStore.setState({
      collections: [],
      isLoading: false,
      error: null,
      fetchedPublicKey: null,
      fetchedNetwork: null,
    });

    (retrieveCollectiblesContracts as jest.Mock).mockResolvedValue([]);
    (retrieveHiddenCollectibles as jest.Mock).mockResolvedValue([]);
    (transformBackendCollections as jest.Mock).mockResolvedValue([]);
    (apiFetchCollectibles as jest.Mock).mockResolvedValue([]);
  });

  it("starts unstamped, so an empty store reads as 'not looked yet'", () => {
    const { fetchedPublicKey, fetchedNetwork } =
      useCollectiblesStore.getState();

    expect(fetchedPublicKey).toBeNull();
    expect(fetchedNetwork).toBeNull();
  });

  // The common case: an account that genuinely holds nothing must still be
  // stamped, or callers wait forever for an answer that already arrived.
  it("stamps the account even when it holds no collectibles", async () => {
    await useCollectiblesStore
      .getState()
      .fetchCollectibles({ publicKey: PK, network: NETWORKS.PUBLIC });

    const { collections, fetchedPublicKey, fetchedNetwork, isLoading } =
      useCollectiblesStore.getState();

    expect(collections).toEqual([]);
    expect(fetchedPublicKey).toBe(PK);
    expect(fetchedNetwork).toBe(NETWORKS.PUBLIC);
    expect(isLoading).toBe(false);
  });

  it("stamps the account it actually fetched, on any network", async () => {
    await useCollectiblesStore
      .getState()
      .fetchCollectibles({ publicKey: PK, network: NETWORKS.TESTNET });

    expect(useCollectiblesStore.getState().fetchedNetwork).toBe(
      NETWORKS.TESTNET,
    );
  });

  // On failure the stamp stays null — callers treat a non-null `error` as
  // "reported" instead, so they can't be stranded waiting.
  it("leaves the stamp unset but records the error when the fetch fails", async () => {
    (apiFetchCollectibles as jest.Mock).mockRejectedValue(
      new Error("network down"),
    );

    await useCollectiblesStore
      .getState()
      .fetchCollectibles({ publicKey: PK, network: NETWORKS.PUBLIC });

    const { fetchedPublicKey, error, isLoading } =
      useCollectiblesStore.getState();

    expect(fetchedPublicKey).toBeNull();
    expect(error).toBe("network down");
    expect(isLoading).toBe(false);
  });
});
