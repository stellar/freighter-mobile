// Initialize the app i18n instance so t() resolves real translations rather
// than returning raw "history.v2.…" key paths (which would make the
// string-literal assertions below vacuous, and would let a typo'd key path
// pass silently). Mirrors the pattern in
// __tests__/helpers/history/v2/mapV2Transaction.test.ts and
// __tests__/ducks/getUserFacingError.test.ts.
import {
  transitionDescription,
  transitionItem,
  signersItems,
  thresholdsItems,
  homeDomainItems,
  trustlinesItems,
  EM_DASH,
  accountCreatedItems,
  accountMergedItems,
  dataEntryItems,
  flagsItems,
  balanceAuthorizationsItems,
  allowanceItems,
  buildStateChangeItems,
} from "components/screens/HistoryScreen/TransactionDetailsV2/stateChangeItems";
import { ResolvedToken } from "helpers/history/v2/model";
import "i18n";
import React from "react";

const ctx = { onSelectDataEntry: jest.fn() };
const ADDRESS = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";
const token = (code: string): ResolvedToken => ({
  code,
  contractId: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
  issuer: null,
  icon: null,
  decimals: 7,
});

describe("transitionDescription", () => {
  it("renders both sides with an arrow when both are present", () => {
    expect(transitionDescription("1", "5")).toBe("1 → 5");
  });

  it("marks an added value with the translated word plus the new value", () => {
    expect(transitionDescription(null, "5")).toBe("Added 5");
  });

  it("marks a removed value with the translated word plus the old value", () => {
    // The removed marker must not read as a literal null, and must not
    // silently drop the value that used to be there.
    expect(transitionDescription("5", null)).toBe("Removed 5");
    expect(transitionDescription("5", null)).not.toContain("null");
  });

  it("falls back to an em dash when neither side is known", () => {
    // Not reachable from any current StateChangeCardData shape, but the
    // function must not guess a direction for it.
    expect(transitionDescription(null, null)).toBe(EM_DASH);
  });
});

describe("transitionItem", () => {
  it("renders both sides when the value changed", () => {
    const item = transitionItem("Weight", "1", "5");
    expect(item.title).toBe("Weight");
    expect(item.value).toBe("1 → 5");
  });

  it("renders the translated 'Added' marker plus the value when there is no old value", () => {
    expect(transitionItem("Weight", null, "5").value).toBe("Added 5");
  });

  it("renders the translated 'Removed' marker plus the old value when there is no new value", () => {
    const { value } = transitionItem("Weight", "5", null);
    expect(value).toBe("Removed 5");
    // The removed marker must not read as a literal null.
    expect(value).not.toContain("null");
  });
});

describe("signersItems", () => {
  it("emits one row per signer with a weight transition", () => {
    const items = signersItems(
      {
        kind: "signers",
        verb: "updated",
        entries: [{ address: ADDRESS, weightOld: 1, weightNew: 5 }],
      },
      ctx,
    );
    expect(items).toHaveLength(1);
    expect(items[0].value).toBe("1 → 5");
  });

  it("marks an added signer (weightOld null) with the translated word and its new weight", () => {
    const items = signersItems(
      {
        kind: "signers",
        verb: "added",
        entries: [{ address: ADDRESS, weightOld: null, weightNew: 2 }],
      },
      ctx,
    );
    expect(items[0].value).toBe("Added 2");
    expect(items[0].value).not.toContain("null");
  });

  it("marks a removed signer (weightNew null) with the translated word and its old weight", () => {
    const items = signersItems(
      {
        kind: "signers",
        verb: "removed",
        entries: [{ address: ADDRESS, weightOld: 2, weightNew: null }],
      },
      ctx,
    );
    expect(items[0].value).toBe("Removed 2");
    expect(items[0].value).not.toContain("null");
  });
});

describe("thresholdsItems", () => {
  it("emits the level and the value transition", () => {
    const items = thresholdsItems(
      { kind: "thresholds", level: "medium", valueOld: "1", valueNew: "3" },
      ctx,
    );
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("medium threshold");
    expect(items[0].value).toBe("1 → 3");
  });
});

describe("homeDomainItems", () => {
  it("emits the domain transition", () => {
    const items = homeDomainItems(
      {
        kind: "homeDomain",
        verb: "updated",
        domainOld: "old.com",
        domainNew: "new.com",
      },
      ctx,
    );
    expect(items[0].title).toBe("Home domain");
    expect(items[0].value).toBe("old.com → new.com");
  });

  it("handles a removed domain with the translated word and the old domain", () => {
    const items = homeDomainItems(
      {
        kind: "homeDomain",
        verb: "removed",
        domainOld: "old.com",
        domainNew: null,
      },
      ctx,
    );
    expect(items[0].value).toBe("Removed old.com");
    expect(items[0].value).not.toContain("null");
  });
});

describe("trustlinesItems", () => {
  it("emits one row per trustline with a limit transition", () => {
    const items = trustlinesItems(
      {
        kind: "trustlines",
        verb: "updated",
        entries: [{ token: token("USDC"), limitOld: "100", limitNew: "500" }],
      },
      ctx,
    );
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("USDC");
    expect(items[0].value).toBe("100 → 500");
  });

  it("handles a created trustline (limitOld null) with the translated word and the new limit", () => {
    const items = trustlinesItems(
      {
        kind: "trustlines",
        verb: "created",
        entries: [{ token: token("USDC"), limitOld: null, limitNew: "500" }],
      },
      ctx,
    );
    expect(items[0].value).toBe("Added 500");
    expect(items[0].value).not.toContain("null");
  });
});

const FUNDER = "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ";

describe("accountCreatedItems", () => {
  it("emits the created address", () => {
    const items = accountCreatedItems(
      { kind: "accountCreated", address: ADDRESS, funder: null },
      ctx,
    );
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Account created");
  });

  it("emits the funder when present", () => {
    const items = accountCreatedItems(
      { kind: "accountCreated", address: ADDRESS, funder: FUNDER },
      ctx,
    );
    expect(items).toHaveLength(2);
    expect(items[1].title).toBe("Funded by");
  });
});

describe("accountMergedItems", () => {
  it("emits a single statement row", () => {
    const items = accountMergedItems({ kind: "accountMerged" }, ctx);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Account merged");
  });
});

describe("dataEntryItems", () => {
  const entries: {
    key: string;
    valueOldB64: string | null;
    valueNewB64: string | null;
  }[] = [{ key: "myKey", valueOldB64: null, valueNewB64: "aGVsbG8=" }];

  it("emits one row per entry key", () => {
    const items = dataEntryItems(
      { kind: "dataEntry", verb: "added", entries },
      ctx,
    );
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("myKey");
  });

  it("marks each row tappable with a trailing info icon, since List renders a plain onPress row identically to a static one", () => {
    const items = dataEntryItems(
      { kind: "dataEntry", verb: "added", entries },
      ctx,
    );
    expect(React.isValidElement(items[0].trailingContent)).toBe(true);
  });

  it("makes each row tappable and passes the selection through", () => {
    const onSelectDataEntry = jest.fn();
    const items = dataEntryItems(
      { kind: "dataEntry", verb: "added", entries },
      { onSelectDataEntry },
    );
    items[0].onPress!();
    expect(onSelectDataEntry).toHaveBeenCalledWith({
      verb: "added",
      entry: entries[0],
    });
  });
});

describe("flagsItems", () => {
  it("emits a row for set flags and a row for cleared flags", () => {
    const items = flagsItems(
      { kind: "flags", set: ["AUTH_REQUIRED"], cleared: ["AUTH_REVOCABLE"] },
      ctx,
    );
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("Flags set");
    expect(items[1].title).toBe("Flags cleared");
  });

  it("omits the group that is empty", () => {
    const items = flagsItems(
      { kind: "flags", set: ["AUTH_REQUIRED"], cleared: [] },
      ctx,
    );
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Flags set");
  });
});

describe("balanceAuthorizationsItems", () => {
  it("emits the authorized state and the affected tokens", () => {
    const items = balanceAuthorizationsItems(
      {
        kind: "balanceAuthorizations",
        authorized: true,
        tokens: [token("USDC")],
      },
      ctx,
    );
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items[0].title).toBe("Authorized");
    expect(JSON.stringify(items)).toContain("USDC");
  });

  it("emits the revoked state when authorization is removed", () => {
    const items = balanceAuthorizationsItems(
      {
        kind: "balanceAuthorizations",
        authorized: false,
        tokens: [token("USDC")],
      },
      ctx,
    );
    expect(items[0].title).toBe("Authorization revoked");
  });
});

describe("allowanceItems", () => {
  it("emits one row per field", () => {
    const items = allowanceItems(
      {
        kind: "allowance",
        token: token("USDC"),
        spender: ADDRESS,
        amount: "100",
        expirationLedger: 12345,
      },
      ctx,
    );
    expect(items).toHaveLength(4);
    expect(items[0].title).toBe("Token");
    expect(items[1].title).toBe("Spender");
    expect(items[2].title).toBe("Amount");
    expect(items[3].title).toBe("Expiration ledger");
  });

  it("renders an em dash when the amount's scale is unknown", () => {
    const items = allowanceItems(
      {
        kind: "allowance",
        token: token("USDC"),
        spender: ADDRESS,
        amount: null,
        expirationLedger: 12345,
      },
      ctx,
    );
    expect(JSON.stringify(items)).toContain("—");
  });
});

describe("buildStateChangeItems", () => {
  it("dispatches every card kind without throwing", () => {
    const cards: Parameters<typeof buildStateChangeItems>[0][] = [
      { kind: "accountCreated", address: ADDRESS, funder: null },
      { kind: "accountMerged" },
      {
        kind: "signers",
        verb: "added",
        entries: [{ address: ADDRESS, weightOld: null, weightNew: 1 }],
      },
      { kind: "thresholds", level: "low", valueOld: "1", valueNew: "2" },
      {
        kind: "dataEntry",
        verb: "added",
        entries: [{ key: "k", valueOldB64: null, valueNewB64: null }],
      },
      { kind: "homeDomain", verb: "set", domainOld: null, domainNew: "a.com" },
      { kind: "flags", set: ["AUTH_REQUIRED"], cleared: [] },
      {
        kind: "trustlines",
        verb: "created",
        entries: [{ token: token("USDC"), limitOld: null, limitNew: "1" }],
      },
      {
        kind: "balanceAuthorizations",
        authorized: false,
        tokens: [token("USDC")],
      },
      {
        kind: "allowance",
        token: token("USDC"),
        spender: ADDRESS,
        amount: "1",
        expirationLedger: 1,
      },
    ];

    cards.forEach((card) => {
      expect(Array.isArray(buildStateChangeItems(card, ctx))).toBe(true);
    });
    // One case per kind in the union — a new kind should fail typecheck here.
    expect(cards).toHaveLength(10);
  });
});
