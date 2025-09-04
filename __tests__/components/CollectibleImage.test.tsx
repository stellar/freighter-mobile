import { fireEvent, render } from "@testing-library/react-native";
import { CollectibleImage } from "components/CollectibleImage";
import React from "react";

// Mock the useColors hook
jest.mock("hooks/useColors", () => ({
  __esModule: true,
  default: () => ({
    themeColors: {
      text: {
        secondary: "#666666",
      },
    },
  }),
}));

// Mock the Icon component
jest.mock("components/sds/Icon", () => ({
  __esModule: true,
  default: {
    Image01: ({ size, color, testID }: any) => (
      // eslint-disable-next-line react/no-unknown-property
      <div testID={testID} data-size={size} data-color={color}>
        MockIcon
      </div>
    ),
  },
}));

describe("CollectibleImage", () => {
  const defaultProps = {
    imageUri: "https://example.com/image.jpg",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders with default props", () => {
    const { getByTestId } = render(<CollectibleImage {...defaultProps} />);

    // Should render the image
    const image = getByTestId("collectible-image");
    expect(image).toBeTruthy();

    // Should show placeholder initially
    const placeholder = getByTestId("collectible-image-placeholder");
    expect(placeholder).toBeTruthy();
  });

  it("renders with custom placeholder icon size", () => {
    const { getByTestId } = render(
      <CollectibleImage {...defaultProps} placeholderIconSize={90} />,
    );

    const placeholder = getByTestId("collectible-image-placeholder");
    expect(placeholder.props["data-size"]).toBe(90);
  });

  it("renders with custom container className", () => {
    const { getByTestId } = render(
      <CollectibleImage
        {...defaultProps}
        containerClassName="custom-container"
      />,
    );

    const container = getByTestId("collectible-image-container");
    expect(container.props.className).toContain("custom-container");
  });

  it("renders with custom image className", () => {
    const { getByTestId } = render(
      <CollectibleImage {...defaultProps} imageClassName="custom-image" />,
    );

    const image = getByTestId("collectible-image");
    expect(image.props.className).toContain("custom-image");
  });

  it("renders with custom resize mode", () => {
    const { getByTestId } = render(
      <CollectibleImage {...defaultProps} resizeMode="contain" />,
    );

    const image = getByTestId("collectible-image");
    expect(image.props.resizeMode).toBe("contain");
  });

  it("handles image load success", () => {
    const { getByTestId, queryByTestId } = render(
      <CollectibleImage {...defaultProps} />,
    );

    const image = getByTestId("collectible-image");

    // Initially placeholder should be visible
    expect(getByTestId("collectible-image-placeholder")).toBeTruthy();

    // Simulate successful image load
    fireEvent(image, "load");

    // Placeholder should be hidden after successful load
    expect(queryByTestId("collectible-image-placeholder")).toBeFalsy();
  });

  it("handles image load error", () => {
    const { getByTestId } = render(<CollectibleImage {...defaultProps} />);

    const image = getByTestId("collectible-image");

    // Initially placeholder should be visible
    expect(getByTestId("collectible-image-placeholder")).toBeTruthy();

    // Simulate image load error
    fireEvent(image, "error");

    // Placeholder should still be visible after error
    expect(getByTestId("collectible-image-placeholder")).toBeTruthy();
  });

  it("handles empty imageUri", () => {
    const { getByTestId } = render(<CollectibleImage imageUri="" />);

    // Should show placeholder for empty URI
    const placeholder = getByTestId("collectible-image-placeholder");
    expect(placeholder).toBeTruthy();
  });

  it("handles undefined imageUri", () => {
    const { getByTestId } = render(<CollectibleImage />);

    // Should show placeholder for undefined URI
    const placeholder = getByTestId("collectible-image-placeholder");
    expect(placeholder).toBeTruthy();
  });

  it("applies correct image source", () => {
    const imageUri = "https://example.com/test-image.jpg";
    const { getByTestId } = render(<CollectibleImage imageUri={imageUri} />);

    const image = getByTestId("collectible-image");
    expect(image.props.source.uri).toBe(imageUri);
  });

  it("uses default values when props are not provided", () => {
    const { getByTestId } = render(<CollectibleImage />);

    const container = getByTestId("collectible-image-container");
    const image = getByTestId("collectible-image");
    const placeholder = getByTestId("collectible-image-placeholder");

    // Check default values
    expect(container.props.className).toContain("w-full h-full");
    expect(image.props.className).toContain("w-full h-full");
    expect(image.props.resizeMode).toBe("cover");
    expect(placeholder.props["data-size"]).toBe(45);
  });

  it("shows placeholder when image fails to load after successful load", () => {
    const { getByTestId, queryByTestId } = render(
      <CollectibleImage {...defaultProps} />,
    );

    const image = getByTestId("collectible-image");

    // Simulate successful load first
    fireEvent(image, "load");
    expect(queryByTestId("collectible-image-placeholder")).toBeFalsy();

    // Simulate error after successful load
    fireEvent(image, "error");
    expect(getByTestId("collectible-image-placeholder")).toBeTruthy();
  });
});
