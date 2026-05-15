/**
 * TypedArray Constructor Preservation Tests
 *
 * Verifies that TypedArray methods (subarray, map, filter, slice) return
 * instances of the correct constructor type, not bare Uint8Array.
 *
 * Context: The Hermes JS engine has broken TypedArray methods that return
 * base Uint8Array instead of the derived type. The
 * @exodus/patch-broken-hermes-typed-arrays package fixes this at runtime.
 *
 * In Jest (V8), these methods already work correctly. These tests document
 * the behavioral contract that must hold on Hermes as well, but they do not
 * by themselves verify that the Hermes polyfill is required or loaded.
 */
import { Buffer } from "buffer";

describe("TypedArray constructor preservation", () => {
  describe("Buffer (extends Uint8Array)", () => {
    it("subarray returns a Buffer instance", () => {
      const buf = Buffer.alloc(10);
      const sub = buf.subarray(0, 5);
      expect(sub).toBeInstanceOf(Buffer);
    });

    it("subarray result supports Buffer methods like toString('hex')", () => {
      const buf = Buffer.from([0xde, 0xad, 0xbe, 0xef]);
      const sub = buf.subarray(0, 2);
      expect(sub.toString("hex")).toBe("dead");
    });

    it("slice returns a Buffer instance", () => {
      const buf = Buffer.alloc(10);
      const sliced = buf.slice(0, 5);
      expect(sliced).toBeInstanceOf(Buffer);
    });

    it("map preserves the type as Uint8Array", () => {
      const buf = Buffer.alloc(4, 1);
      const mapped = buf.map((x) => x * 2);
      // map returns Uint8Array (not Buffer) even on V8 — the important thing
      // is it doesn't return a broken object
      expect(mapped).toBeInstanceOf(Uint8Array);
      expect(Array.from(mapped)).toEqual([2, 2, 2, 2]);
    });

    it("filter preserves the type as Uint8Array", () => {
      const buf = Buffer.from([1, 2, 3, 4]);
      const filtered = buf.filter((x) => x > 2);
      expect(filtered).toBeInstanceOf(Uint8Array);
      expect(Array.from(filtered)).toEqual([3, 4]);
    });
  });

  describe("Uint8Array", () => {
    it("subarray preserves constructor", () => {
      const arr = new Uint8Array([1, 2, 3, 4]);
      const sub = arr.subarray(1, 3);
      expect(sub).toBeInstanceOf(Uint8Array);
      expect(Array.from(sub)).toEqual([2, 3]);
    });

    it("map preserves constructor", () => {
      const arr = new Uint8Array([1, 2, 3]);
      const mapped = arr.map((x) => x * 10);
      expect(mapped).toBeInstanceOf(Uint8Array);
      expect(Array.from(mapped)).toEqual([10, 20, 30]);
    });

    it("filter preserves constructor", () => {
      const arr = new Uint8Array([1, 2, 3, 4]);
      const filtered = arr.filter((x) => x % 2 === 0);
      expect(filtered).toBeInstanceOf(Uint8Array);
      expect(Array.from(filtered)).toEqual([2, 4]);
    });

    it("slice preserves constructor", () => {
      const arr = new Uint8Array([10, 20, 30, 40]);
      const sliced = arr.slice(1, 3);
      expect(sliced).toBeInstanceOf(Uint8Array);
      expect(Array.from(sliced)).toEqual([20, 30]);
    });
  });

  describe("Other TypedArray types", () => {
    it("Int8Array.subarray preserves constructor", () => {
      const arr = new Int8Array([1, -2, 3, -4]);
      const sub = arr.subarray(0, 2);
      expect(sub).toBeInstanceOf(Int8Array);
      expect(Array.from(sub)).toEqual([1, -2]);
    });

    it("Float32Array.subarray preserves constructor", () => {
      const arr = new Float32Array([1.5, 2.5, 3.5]);
      const sub = arr.subarray(0, 2);
      expect(sub).toBeInstanceOf(Float32Array);
      expect(sub[0]).toBeCloseTo(1.5);
      expect(sub[1]).toBeCloseTo(2.5);
    });

    it("Uint16Array.map preserves constructor", () => {
      const arr = new Uint16Array([100, 200, 300]);
      const mapped = arr.map((x) => x + 1);
      expect(mapped).toBeInstanceOf(Uint16Array);
      expect(Array.from(mapped)).toEqual([101, 201, 301]);
    });
  });

  describe("XDR-critical Buffer operations", () => {
    it("Buffer.subarray result can be used for hex encoding (XDR serialization)", () => {
      const buf = Buffer.from("deadbeefcafe", "hex");
      const sub = buf.subarray(0, 4);
      expect(sub.toString("hex")).toBe("deadbeef");
      expect(sub.length).toBe(4);
    });

    it("chained subarray calls preserve Buffer type", () => {
      const buf = Buffer.alloc(20, 0xff);
      const sub1 = buf.subarray(0, 10);
      const sub2 = sub1.subarray(0, 5);
      expect(sub1).toBeInstanceOf(Buffer);
      expect(sub2).toBeInstanceOf(Buffer);
      expect(sub2.toString("hex")).toBe("ffffffffff");
    });

    it("subarray shares underlying memory (no copy)", () => {
      const buf = Buffer.alloc(4, 0);
      const sub = buf.subarray(1, 3);
      sub[0] = 0xaa;
      expect(buf[1]).toBe(0xaa);
    });
  });
});
