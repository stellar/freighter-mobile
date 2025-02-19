import { Dimensions } from 'react-native';
import { heightPercentageToDP } from 'react-native-responsive-screen';

// iPhone 14 aspect ratio used as reference for design
const DESIGN_HEIGHT = 844;
const DESIGN_WIDTH = 390;
const DESIGN_ASPECT_RATIO = DESIGN_WIDTH / DESIGN_HEIGHT;

const { width, height } = Dimensions.get('window');

/*
  The taller the device the smaller the aspect ratio, which will result in a
  device scale smaller than 1 (see formula below for "deviceScale"), therefore
  decreasing the height percentage used for rendering the components so that it
  fits well in a tall screen.
*/
export const deviceAspectRatio = width / height;

/*
  The smaller the device aspect ratio the smaller the device scale.
  On the other hand, if the device has an aspect ratio that is wider than the
  expected "DESIGN_ASPECT_RATIO" (i.e. has a width that is relatively bigger
  than the expected) it would result in big components for a relatively short
  screen (i.e. deviceScale > 1) which is the opposite of the desired behavior,
  that's why we shouldn't let the device scale be greater than 1.2.
*/
const deviceScale = Math.min(deviceAspectRatio / DESIGN_ASPECT_RATIO, 1.2);

export function pxValue(designValue: number): number {
  const designHeightPercentage = deviceScale * (designValue / DESIGN_HEIGHT) * 100;
  return heightPercentageToDP(designHeightPercentage);
}

export function px(designValue: number): string {
  return `${pxValue(designValue)}px`;
}

export function fsValue(designFontSize: number): number {
  return pxValue(designFontSize);
}

export function fs(designFontSize: number): string {
  return `${fsValue(designFontSize)}px`;
}
