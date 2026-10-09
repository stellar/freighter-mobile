import avatarFixtures from "__tests__/helpers/fixtures/avatarFixtures.json";
import { VARIAL_AVATAR_COLORS, marbleAvatar } from "helpers/varialAvatar";

// Same fixtures as the extension, which renders boring-avatars directly. A
// mismatch means the two platforms draw different avatars for one account.
const svgTransform = (layer: {
  translateX: number;
  translateY: number;
  rotate: number;
  scale: number;
}) =>
  `translate(${layer.translateX} ${layer.translateY}) rotate(${layer.rotate} 40 40) scale(${layer.scale})`;

describe("marbleAvatar", () => {
  it.each(avatarFixtures)(
    "matches boring-avatars for $publicKey",
    ({ publicKey, base, layer1, layer2 }) => {
      const avatar = marbleAvatar(publicKey, VARIAL_AVATAR_COLORS);

      expect(avatar.base).toBe(base);
      expect({
        fill: avatar.layer1.color,
        transform: svgTransform(avatar.layer1),
      }).toEqual(layer1);
      expect({
        fill: avatar.layer2.color,
        transform: svgTransform(avatar.layer2),
      }).toEqual(layer2);
    },
  );
});
