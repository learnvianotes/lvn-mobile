import { Easing, SlideInDown, SlideOutDown } from 'react-native-reanimated'

/**
 * How bottom sheets come and go: up in a quarter of a second, easing out, with no bounce. The spring they used
 * overshot (damping ratio about 0.67), so a sheet rose past its place and dropped back: it looked like a jump.
 */
export const SHEET_IN = SlideInDown.duration(260).easing(Easing.out(Easing.cubic))
export const SHEET_OUT = SlideOutDown.duration(180)
