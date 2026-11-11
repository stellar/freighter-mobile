import { Blur, Group, Path, Rect } from "@shopify/react-native-skia";
import { render } from "@testing-library/react-native";
import avatarFixtures from "__tests__/helpers/fixtures/avatarFixtures.json";
import { MarbleAvatar } from "components/sds/Avatar/MarbleAvatar";
import { MARBLE_CLIP_PATH } from "helpers/varialAvatar";
import React from "react";

// Skia draws nothing under Jest, so the drawing nodes are stand-ins that keep
// their props for inspection.
jest.mock("@shopify/react-native-skia", () => {
  const passThrough = ({ children }: { children?: React.ReactNode }) =>
    children ?? null;
  return {
    Group: jest.fn(passThrough),
    Rect: jest.fn(passThrough),
    Path: jest.fn(passThrough),
    Blur: jest.fn(passThrough),
  };
});

type Matrix = [number, number, number, number, number, number]; // a b c d e f
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

const multiply = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const translate = (x: number, y: number): Matrix => [1, 0, 0, 1, x, y];
const rotate = (rad: number): Matrix => [
  Math.cos(rad),
  Math.sin(rad),
  -Math.sin(rad),
  Math.cos(rad),
  0,
  0,
];
const scale = (s: number): Matrix => [s, 0, 0, s, 0, 0];

// Skia applies a transform array left to right, like an SVG transform list.
const skiaMatrix = (transforms: Record<string, number>[]) =>
  transforms.reduce<Matrix>((m, t) => {
    const [[op, v]] = Object.entries(t);
    if (op === "translateX") return multiply(m, translate(v, 0));
    if (op === "translateY") return multiply(m, translate(0, v));
    if (op === "rotate") return multiply(m, rotate(v));
    if (op === "scale") return multiply(m, scale(v));
    throw new Error(`unexpected transform ${op}`);
  }, IDENTITY);

// The fixture's transform is boring-avatars' SVG output, e.g.
// "translate(6 -6) rotate(350 40 40) scale(1.3)".
const svgMatrix = (transform: string) => {
  const [tx, ty, deg, cx, cy, s] = (transform.match(/-?[\d.]+/g) ?? []).map(
    Number,
  );
  return [
    translate(tx, ty),
    translate(cx, cy),
    rotate((deg * Math.PI) / 180),
    translate(-cx, -cy),
    scale(s),
  ].reduce(multiply, IDENTITY);
};

const expectSameMatrix = (actual: Matrix, expected: Matrix) =>
  actual.forEach((v, i) => expect(v).toBeCloseTo(expected[i], 9));

const renderAvatar = (publicAddress: string, size: number) =>
  render(<MarbleAvatar publicAddress={publicAddress} size={size} />)
    .UNSAFE_root;

describe("MarbleAvatar", () => {
  it.each([24, 40, 56])(
    "clips to a circle and scales the 80-unit drawing to %ipx",
    (size) => {
      const root = renderAvatar(avatarFixtures[0].publicKey, size);

      const group = root.findByType(Group);
      expect(group.props.clip).toBe(MARBLE_CLIP_PATH);
      expectSameMatrix(skiaMatrix(group.props.transform), scale(size / 80));
    },
  );

  // Includes the muxed fixture, which must draw its G… account's avatar.
  it.each(avatarFixtures)(
    "draws the pinned avatar for $publicKey",
    ({ publicKey, base, layer1, layer2 }) => {
      const root = renderAvatar(publicKey, 40);
      const [path1, path2] = root.findAllByType(Path);

      expect(root.findByType(Rect).props.color).toBe(base);
      expect(path1.props.color).toBe(layer1.fill);
      expect(path2.props.color).toBe(layer2.fill);
      expectSameMatrix(
        skiaMatrix(path1.props.transform),
        svgMatrix(layer1.transform),
      );
      expectSameMatrix(
        skiaMatrix(path2.props.transform),
        svgMatrix(layer2.transform),
      );
    },
  );

  it("blurs both shapes and overlays only the second, as the library does", () => {
    const root = renderAvatar(avatarFixtures[0].publicKey, 40);
    const [path1, path2] = root.findAllByType(Path);

    root.findAllByType(Blur).forEach((blur) => {
      expect(blur.props).toMatchObject({ blur: 7, mode: "decal" });
    });
    expect(path1.findByType(Blur)).toBeTruthy();
    expect(path2.findByType(Blur)).toBeTruthy();
    expect(path1.props.blendMode).toBeUndefined();
    expect(path2.props.blendMode).toBe("overlay");
  });
});
