import React from "react";
import {
  AccessibilityProps,
  Image,
  ImageRequireSource,
  ViewProps,
} from "react-native";

type ResizeMode = "contain" | "cover" | "stretch" | "center";
type Priority = "low" | "normal" | "high";
type CacheControl = "immutable" | "web" | "cacheOnly";
type Transition = "fade" | "none";

interface Source {
  uri?: string;
  headers?: Record<string, string>;
  priority?: Priority;
  cache?: CacheControl;
}

interface FastImageProps extends AccessibilityProps, ViewProps {
  source?: Source | ImageRequireSource;
  defaultSource?: ImageRequireSource;
  resizeMode?: ResizeMode;
  transition?: Transition;
  fallback?: boolean;
  onLoadStart?: () => void;
  onLoad?: () => void;
  onError?: () => void;
  onLoadEnd?: () => void;
}

interface FastImageStaticProperties {
  resizeMode: Record<ResizeMode, ResizeMode>;
  priority: Record<Priority, Priority>;
  cacheControl: Record<CacheControl, CacheControl>;
  transition: Record<Transition, Transition>;
  preload: jest.Mock<void, [Source[]]>;
  clearMemoryCache: jest.Mock<Promise<void>, []>;
  clearDiskCache: jest.Mock<Promise<void>, []>;
}

const FastImageMock = React.forwardRef<unknown, FastImageProps>(
  (
    { source, style, accessibilityLabel, onLoad, onError, onLoadEnd, ...props },
    ref,
  ) => (
    <Image
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      source={source as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      style={style as any}
      accessibilityLabel={accessibilityLabel}
      onLoad={onLoad}
      onError={onError}
      onLoadEnd={onLoadEnd}
      {...props}
    />
  ),
);

FastImageMock.displayName = "FastImage";

const FastImage =
  FastImageMock as unknown as React.ComponentType<FastImageProps> &
    FastImageStaticProperties;

(FastImage as FastImageStaticProperties).resizeMode = {
  contain: "contain",
  cover: "cover",
  stretch: "stretch",
  center: "center",
};

(FastImage as FastImageStaticProperties).priority = {
  low: "low",
  normal: "normal",
  high: "high",
};

(FastImage as FastImageStaticProperties).cacheControl = {
  immutable: "immutable",
  web: "web",
  cacheOnly: "cacheOnly",
};

(FastImage as FastImageStaticProperties).transition = {
  fade: "fade",
  none: "none",
};

(FastImage as FastImageStaticProperties).preload = jest.fn();
(FastImage as FastImageStaticProperties).clearMemoryCache = jest.fn(() =>
  Promise.resolve(),
);
(FastImage as FastImageStaticProperties).clearDiskCache = jest.fn(() =>
  Promise.resolve(),
);

export default FastImage;
