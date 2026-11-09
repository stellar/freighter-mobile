import { STORAGE_KEYS } from "config/constants";
import {
  clearDerivationIndices,
  getDerivationIndices,
  lowestUnusedIndex,
  markDerivationIndexUsed,
  nextDerivationIndex,
  releaseDerivationIndex,
} from "services/auth/derivationIndices";
import { clearNonSensitiveData } from "services/storage/helpers";

// Minimal in-memory dataStorage: plain strings, no encoding, so tests can
// inspect exactly what the module persists.
jest.mock("services/storage/storageFactory", () => {
  const memory: Record<string, string> = {};
  return {
    __memory: memory,
    dataStorage: {
      getItem: jest.fn((key: string) => Promise.resolve(memory[key] ?? null)),
      setItem: jest.fn((key: string, value: string) => {
        memory[key] = value;
        return Promise.resolve();
      }),
      remove: jest.fn((keys: string | string[]) => {
        (Array.isArray(keys) ? keys : [keys]).forEach((key) => {
          delete memory[key];
        });
        return Promise.resolve();
      }),
    },
  };
});

const { __memory: memory } = jest.requireMock<{
  __memory: Record<string, string>;
}>("services/storage/storageFactory");

const storedMap = (): Record<string, number[]> | undefined =>
  memory[STORAGE_KEYS.DERIVATION_INDICES]
    ? JSON.parse(memory[STORAGE_KEYS.DERIVATION_INDICES])
    : undefined;

const PHRASE_A = "a".repeat(64);
const PHRASE_B = "b".repeat(64);

beforeEach(() => {
  Object.keys(memory).forEach((key) => {
    delete memory[key];
  });
});

describe("lowestUnusedIndex", () => {
  it("is 0 for an empty set", () => {
    expect(lowestUnusedIndex([])).toBe(0);
  });

  it("is one past the end of a contiguous set", () => {
    expect(lowestUnusedIndex([0, 1, 2])).toBe(3);
  });

  it("is the lowest gap when the set has holes", () => {
    expect(lowestUnusedIndex([0, 2, 3])).toBe(1);
    expect(lowestUnusedIndex([1, 2])).toBe(0);
  });

  it("ignores order and duplicates", () => {
    expect(lowestUnusedIndex([2, 0, 0, 1])).toBe(3);
  });
});

describe("derivation index sets", () => {
  it("reads an empty set for a source with no entry", async () => {
    expect(await getDerivationIndices(PHRASE_A)).toEqual([]);
    expect(await nextDerivationIndex({ sourceId: PHRASE_A })).toBe(0);
  });

  it("marks an index and persists the set sorted under the source id", async () => {
    await markDerivationIndexUsed({ sourceId: PHRASE_A, index: 2 });
    await markDerivationIndexUsed({ sourceId: PHRASE_A, index: 0 });

    expect(storedMap()).toEqual({ [PHRASE_A]: [0, 2] });
    expect(await nextDerivationIndex({ sourceId: PHRASE_A })).toBe(1);
  });

  it("marking an index twice stores it once", async () => {
    await markDerivationIndexUsed({ sourceId: PHRASE_A, index: 0 });
    await markDerivationIndexUsed({ sourceId: PHRASE_A, index: 0 });

    expect(await getDerivationIndices(PHRASE_A)).toEqual([0]);
  });

  it("keeps each source's set independent", async () => {
    await markDerivationIndexUsed({ sourceId: PHRASE_A, index: 0 });
    await markDerivationIndexUsed({ sourceId: PHRASE_A, index: 1 });

    expect(await nextDerivationIndex({ sourceId: PHRASE_B })).toBe(0);
    expect(await getDerivationIndices(PHRASE_B)).toEqual([]);
  });

  it("skips excluded indices without marking them", async () => {
    await markDerivationIndexUsed({ sourceId: PHRASE_A, index: 0 });

    expect(
      await nextDerivationIndex({
        sourceId: PHRASE_A,
        exclude: new Set([1, 2]),
      }),
    ).toBe(3);
    expect(await getDerivationIndices(PHRASE_A)).toEqual([0]);
  });

  it("hands a released index back out as the next one", async () => {
    await markDerivationIndexUsed({ sourceId: PHRASE_A, index: 0 });
    await markDerivationIndexUsed({ sourceId: PHRASE_A, index: 1 });
    await markDerivationIndexUsed({ sourceId: PHRASE_A, index: 2 });

    await releaseDerivationIndex({ sourceId: PHRASE_A, index: 1 });

    expect(await getDerivationIndices(PHRASE_A)).toEqual([0, 2]);
    expect(await nextDerivationIndex({ sourceId: PHRASE_A })).toBe(1);
  });

  it("releasing an index that is not marked changes nothing", async () => {
    await markDerivationIndexUsed({ sourceId: PHRASE_A, index: 0 });

    await releaseDerivationIndex({ sourceId: PHRASE_A, index: 5 });
    await releaseDerivationIndex({ sourceId: PHRASE_B, index: 0 });

    expect(storedMap()).toEqual({ [PHRASE_A]: [0] });
  });

  it("clears every source's set", async () => {
    await markDerivationIndexUsed({ sourceId: PHRASE_A, index: 0 });
    await markDerivationIndexUsed({ sourceId: PHRASE_B, index: 0 });

    await clearDerivationIndices();

    expect(storedMap()).toBeUndefined();
    expect(await getDerivationIndices(PHRASE_A)).toEqual([]);
  });

  it("is cleared by the non-sensitive wipe", async () => {
    await markDerivationIndexUsed({ sourceId: PHRASE_A, index: 0 });

    await clearNonSensitiveData();

    expect(storedMap()).toBeUndefined();
  });
});
