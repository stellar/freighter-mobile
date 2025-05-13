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
});
