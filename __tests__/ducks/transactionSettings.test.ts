import { act } from "@testing-library/react-hooks";
import {
  DEFAULT_TRANSACTION_TIMEOUT,
  MIN_TRANSACTION_FEE,
} from "config/constants";
import { useTransactionSettingsStore } from "ducks/transactionSettings";

const store = useTransactionSettingsStore;

describe("transactionSettings Duck", () => {
  beforeEach(() => {
    act(() => {
      store.getState().resetSettings();
    });
  });

  it("should have correct initial state", () => {
    const initialState = store.getState();
    expect(initialState.transactionMemo).toBe("");
    expect(initialState.transactionFee).toBe(MIN_TRANSACTION_FEE);
    expect(initialState.transactionTimeout).toBe(DEFAULT_TRANSACTION_TIMEOUT);
    expect(initialState.recipientAddress).toBe("");
    expect(initialState.selectedTokenId).toBe("");
  });

  it("should save memo", () => {
    const newMemo = "Test Memo";
    act(() => {
      store.getState().saveMemo(newMemo);
    });
    expect(store.getState().transactionMemo).toBe(newMemo);
  });

  it("should save fee", () => {
    const newFee = "200";
    act(() => {
      store.getState().saveTransactionFee(newFee);
    });
    expect(store.getState().transactionFee).toBe(newFee);
  });

  it("should save timeout", () => {
    const newTimeout = 300;
    act(() => {
      store.getState().saveTransactionTimeout(newTimeout);
    });
    expect(store.getState().transactionTimeout).toBe(newTimeout);
  });

  it("should save recipient address", () => {
    const newAddress =
      "GBR4KK7G3FACWZJXJ4JAL6Y2KWXIXC56KEET54YAEBOU6YFWPYIQE7RU";
    act(() => {
      store.getState().saveRecipientAddress(newAddress);
    });
    expect(store.getState().recipientAddress).toBe(newAddress);
  });

  it("should save selected token ID", () => {
    const newTokenId =
      "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
    act(() => {
      store.getState().saveSelectedTokenId(newTokenId);
    });
    expect(store.getState().selectedTokenId).toBe(newTokenId);
  });

  it("should reset to default values", () => {
    const newMemo = "Another Memo";
    const newFee = "500";
    const newTimeout = 600;
    const newAddress =
      "GCVOLU545KR4QKJ5J57Q4AP3ZT6M2PX5FQOOWEVJ6VAMSHMWWUH4Y3QF";
    const newTokenId = "TEST:TEST";

    act(() => {
      store.getState().saveMemo(newMemo);
      store.getState().saveTransactionFee(newFee);
      store.getState().saveTransactionTimeout(newTimeout);
      store.getState().saveRecipientAddress(newAddress);
      store.getState().saveSelectedTokenId(newTokenId);
    });

    expect(store.getState().transactionMemo).toBe(newMemo);
    expect(store.getState().transactionFee).toBe(newFee);
    expect(store.getState().transactionTimeout).toBe(newTimeout);
    expect(store.getState().recipientAddress).toBe(newAddress);
    expect(store.getState().selectedTokenId).toBe(newTokenId);

    act(() => {
      store.getState().resetSettings();
    });

    expect(store.getState().transactionMemo).toBe("");
    expect(store.getState().transactionFee).toBe(MIN_TRANSACTION_FEE);
    expect(store.getState().transactionTimeout).toBe(
      DEFAULT_TRANSACTION_TIMEOUT,
    );
    expect(store.getState().recipientAddress).toBe("");
    expect(store.getState().selectedTokenId).toBe("");
  });

  describe("selectedCollectibleDetails", () => {
    it("should have correct initial collectible details state", () => {
      const initialState = store.getState();
      expect(initialState.selectedCollectibleDetails).toEqual({
        collectionAddress: "",
        tokenId: "",
      });
    });

    it("should save collectible details", () => {
      const collectibleDetails = {
        collectionAddress:
          "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
        tokenId: "12345",
      };

      act(() => {
        store.getState().saveSelectedCollectibleDetails(collectibleDetails);
      });

      expect(store.getState().selectedCollectibleDetails).toEqual(
        collectibleDetails,
      );
    });

    it("should update collectible details when changed", () => {
      const firstCollectible = {
        collectionAddress:
          "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
        tokenId: "100",
      };
      const secondCollectible = {
        collectionAddress:
          "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
        tokenId: "999",
      };

      act(() => {
        store.getState().saveSelectedCollectibleDetails(firstCollectible);
      });
      expect(store.getState().selectedCollectibleDetails).toEqual(
        firstCollectible,
      );

      act(() => {
        store.getState().saveSelectedCollectibleDetails(secondCollectible);
      });
      expect(store.getState().selectedCollectibleDetails).toEqual(
        secondCollectible,
      );
    });

    it("should reset collectible details when resetSettings is called", () => {
      const collectibleDetails = {
        collectionAddress:
          "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
        tokenId: "12345",
      };

      act(() => {
        store.getState().saveSelectedCollectibleDetails(collectibleDetails);
      });

      expect(store.getState().selectedCollectibleDetails).toEqual(
        collectibleDetails,
      );

      act(() => {
        store.getState().resetSettings();
      });

      expect(store.getState().selectedCollectibleDetails).toEqual({
        collectionAddress: "",
        tokenId: "",
      });
    });

    it("should handle empty string values for collectible details", () => {
      const emptyCollectibleDetails = {
        collectionAddress: "",
        tokenId: "",
      };

      act(() => {
        store
          .getState()
          .saveSelectedCollectibleDetails(emptyCollectibleDetails);
      });

      expect(store.getState().selectedCollectibleDetails).toEqual(
        emptyCollectibleDetails,
      );
    });
  });
});
