import { MenuItem } from "components/ContextMenuButton";

/** Size of the avatar and tab count button */
export const BUTTON_SIZE = 40;
/** Height of the search bar input area */
export const INPUT_HEIGHT = 40;
/** Size of icons inside the search bar */
export const ICON_SIZE = 20;
/** Spacing between bar children (avatar, search bar, right button) */
export const BAR_SPACING = 16;
/** Max extra width the right button container gains when showing cancel */
export const CANCEL_EXTRA_WIDTH = 60;
/** Bottom margin of the bar container when fully focused on iOS */
export const IOS_FOCUSED_MARGIN_BOTTOM = 10;
/** Horizontal margin of the bar container when fully focused on iOS */
export const IOS_FOCUSED_MARGIN_HORIZONTAL = 6;
/** Border radius of the bar container when fully focused on iOS */
export const IOS_FOCUSED_BORDER_RADIUS = 20;
/**
 * Keyboard progress threshold at which pointer events swap between
 * focused and unfocused UI elements. At 50% progress the elements are
 * equally transparent, so this is the natural switch point.
 */
export const POINTER_EVENTS_THRESHOLD = 0.5;

export interface BottomNavigationBarProps {
  inputUrl: string;
  onInputChange: (text: string) => void;
  onUrlSubmit: () => void;
  onShowTabs: () => void;
  onCancel: () => void;
  onAvatarPress: () => void;
  tabsCount: number;
  canGoBack: boolean;
  onGoBack: () => void;
  contextMenuActions: MenuItem[];
  isHomePage: boolean;
  onFocusChange?: (focused: boolean) => void;
}
