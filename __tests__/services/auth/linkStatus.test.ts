import { STORAGE_KEYS } from "config/constants";
import {
  clearLinkStatus,
  getLinkConflicts,
  getLinkStatus,
  getLinkStatusEpoch,
  recordLinkResults,
} from "services/auth/linkStatus";

// Minimal in-memory dataStorage, as in derivationIndices.test.ts.
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

const storedMap = (): Record<string, string> | undefined =>
  memory[STORAGE_KEYS.SOURCE_LINK_STATUS]
    ? JSON.parse(memory[STORAGE_KEYS.SOURCE_LINK_STATUS])
    : undefined;

const A = "a".repeat(64);
const B = "b".repeat(64);
const C = "c".repeat(64);

describe("linkStatus", () => {
  beforeEach(async () => {
    await clearLinkStatus();
  });

  it("is empty before any response", async () => {
    expect(await getLinkStatus()).toEqual({});
    expect(await getLinkConflicts()).toEqual([]);
  });

  it("merges a later response into the earlier entries", async () => {
    await recordLinkResults({
      linked: [A],
      conflicts: [],
      epoch: getLinkStatusEpoch(),
    });
    await recordLinkResults({
      linked: [B],
      conflicts: [C],
      epoch: getLinkStatusEpoch(),
    });

    expect(storedMap()).toEqual({
      [A]: "linked",
      [B]: "linked",
      [C]: "conflict",
    });
    expect(await getLinkConflicts()).toEqual([C]);
  });

  it("writes nothing for an empty response", async () => {
    await recordLinkResults({
      linked: [],
      conflicts: [],
      epoch: getLinkStatusEpoch(),
    });
    expect(storedMap()).toBeUndefined();
  });

  it("clears the cached user id with the map", async () => {
    memory[STORAGE_KEYS.SOURCE_LINK_STATUS] = JSON.stringify({ [A]: "linked" });
    memory[STORAGE_KEYS.CANONICAL_USER_ID] = A;

    await clearLinkStatus();

    expect(STORAGE_KEYS.SOURCE_LINK_STATUS in memory).toBe(false);
    expect(STORAGE_KEYS.CANONICAL_USER_ID in memory).toBe(false);
  });

  it("drops a write that read the epoch before a clear", async () => {
    const epoch = getLinkStatusEpoch();
    await clearLinkStatus();

    const written = await recordLinkResults({
      linked: [A],
      conflicts: [B],
      epoch,
    });

    expect(written).toBe(false);
    expect(storedMap()).toBeUndefined();
  });

  it("clears every entry", async () => {
    await recordLinkResults({
      linked: [A],
      conflicts: [B],
      epoch: getLinkStatusEpoch(),
    });
    await clearLinkStatus();
    expect(await getLinkStatus()).toEqual({});
  });
});
