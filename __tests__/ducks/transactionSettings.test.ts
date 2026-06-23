import { act } from "@testing-library/react-hooks";
import {
  DEFAULT_TRANSACTION_TIMEOUT,
  MIN_TRANSACTION_FEE,
} from "config/constants";
import { FeePriority } from "config/types";
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
    expect(initialState.federationAddress).toBe("");
    expect(initialState.recipientName).toBe("");
    expect(initialState.selectedTokenId).toBe("");
    expect(initialState.feePriority).toBe(FeePriority.MEDIUM);
  });

  it("should save fee priority", () => {
    act(() => {
      store.getState().saveFeePriority(FeePriority.HIGH);
    });
    expect(store.getState().feePriority).toBe(FeePriority.HIGH);
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

  it("should save federation address", () => {
    const newFederationAddress = "alice*example.com";

    act(() => {
      store.getState().saveFederationAddress(newFederationAddress);
    });

    expect(store.getState().federationAddress).toBe(newFederationAddress);
    // recipientName must remain untouched
    expect(store.getState().recipientName).toBe("");
  });

  it("should save recipient name", () => {
    const newName = "Account 2";

    act(() => {
      store.getState().saveRecipientName(newName);
    });

    expect(store.getState().recipientName).toBe(newName);
    // federationAddress must remain untouched
    expect(store.getState().federationAddress).toBe("");
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
    const newFederationAddress = "alice*example.com";
    const newRecipientName = "Account 2";
    const newTokenId = "TEST:TEST";

    act(() => {
      store.getState().saveMemo(newMemo);
      store.getState().saveTransactionFee(newFee);
      store.getState().saveTransactionTimeout(newTimeout);
      store.getState().saveRecipientAddress(newAddress);
      store.getState().saveFederationAddress(newFederationAddress);
      store.getState().saveRecipientName(newRecipientName);
      store.getState().saveSelectedTokenId(newTokenId);
      store.getState().saveFeePriority(FeePriority.HIGH);
    });

    expect(store.getState().transactionMemo).toBe(newMemo);
    expect(store.getState().transactionFee).toBe(newFee);
    expect(store.getState().transactionTimeout).toBe(newTimeout);
    expect(store.getState().recipientAddress).toBe(newAddress);
    expect(store.getState().federationAddress).toBe(newFederationAddress);
    expect(store.getState().recipientName).toBe(newRecipientName);
    expect(store.getState().selectedTokenId).toBe(newTokenId);
    expect(store.getState().feePriority).toBe(FeePriority.HIGH);

    act(() => {
      store.getState().resetSettings();
    });

    expect(store.getState().transactionMemo).toBe("");
    expect(store.getState().transactionFee).toBe(MIN_TRANSACTION_FEE);
    expect(store.getState().transactionTimeout).toBe(
      DEFAULT_TRANSACTION_TIMEOUT,
    );
    expect(store.getState().recipientAddress).toBe("");
    expect(store.getState().federationAddress).toBe("");
    expect(store.getState().recipientName).toBe("");
    expect(store.getState().selectedTokenId).toBe("");
    expect(store.getState().feePriority).toBe(FeePriority.MEDIUM);
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
