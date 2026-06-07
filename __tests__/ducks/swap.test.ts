import { act, renderHook } from "@testing-library/react-hooks";
import { DestinationTokenDescriptor } from "components/screens/SwapScreen/helpers";
import { TokenTypeWithCustomToken } from "config/types";
import { useSwapStore, destinationAsBalanceLike } from "ducks/swap";

describe("useSwapStore — destinationToken migration", () => {
  beforeEach(() => {
    act(() => {
      useSwapStore.getState().resetSwap();
    });
  });

  it("has destinationToken: null in initial state (legacy fields removed)", () => {
    const { result } = renderHook(() => useSwapStore());

    expect(result.current.destinationToken).toBeNull();
    expect((result.current as any).destinationTokenId).toBeUndefined();
    expect((result.current as any).destinationTokenSymbol).toBeUndefined();
  });

  it("setDestinationToken stores the descriptor verbatim", () => {
    const { result } = renderHook(() => useSwapStore());

    const descriptor: DestinationTokenDescriptor = {
      id: "USDC:GA5Z...",
      tokenCode: "USDC",
      issuer: "GA5Z...",
      decimals: 7,
      tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
      isNew: true,
    };

    act(() => {
      result.current.setDestinationToken(descriptor);
    });

    expect(result.current.destinationToken).toEqual(descriptor);
  });

  it("resetSwap clears destinationToken", () => {
    const { result } = renderHook(() => useSwapStore());

    act(() => {
      result.current.setDestinationToken({
        id: "native",
        tokenCode: "XLM",
        decimals: 7,
        tokenType: TokenTypeWithCustomToken.NATIVE,
        isNew: false,
      });
    });
    act(() => {
      result.current.resetSwap();
    });

    expect(result.current.destinationToken).toBeNull();
  });
});

describe("destinationAsBalanceLike", () => {
  it("throws on a native descriptor (XLM should always resolve to a held balance before this projector runs)", () => {
    expect(() =>
      destinationAsBalanceLike({
        id: "native",
        tokenCode: "XLM",
        decimals: 7,
        tokenType: TokenTypeWithCustomToken.NATIVE,
        isNew: false,
      }),
    ).toThrow(/native descriptor/);
  });

  it("projects a classic descriptor", () => {
    const result = destinationAsBalanceLike({
      id: "USDC:GA5Z...",
      tokenCode: "USDC",
      issuer: "GA5Z...",
      decimals: 7,
      tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
      isNew: true,
    });

    expect((result as any).token).toEqual({
      code: "USDC",
      issuer: { key: "GA5Z..." },
      type: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
    });
  });

  it("throws when a non-native descriptor is missing issuer", () => {
    expect(() =>
      destinationAsBalanceLike({
        id: "USDC:GA5Z...",
        tokenCode: "USDC",
        // issuer intentionally omitted
        decimals: 7,
        tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
        isNew: true,
      }),
    ).toThrow(/missing issuer/);
  });
});
