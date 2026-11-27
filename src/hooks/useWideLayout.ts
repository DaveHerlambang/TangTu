import { Platform, useWindowDimensions } from 'react-native';

/** From this width (CSS pixels) the web app uses layout E, "Buku kas" (§13.9); below it, the phone layout. */
export const WIDE_MIN_WIDTH = 960;

/**
 * True for the web app on a wide window (a laptop, a desktop, a tablet in landscape). The phone app and narrow
 * windows (the iPhone) always get the phone layout (§13.9, owner 2026-11-26). Follows window resizes.
 */
export function useWideLayout(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= WIDE_MIN_WIDTH;
}

/** The other screens on a wide window keep a phone-like column this wide, centred (0.6.0). */
export const WIDE_COLUMN_WIDTH = 760;

/**
 * Side padding that centres a screen's content in a `WIDE_COLUMN_WIDTH` column on a wide web window; null
 * elsewhere. `taken` is width already used beside the screen (the tab rail).
 */
export function useWideGutter(taken = 0): { paddingHorizontal: number } | null {
  const { width } = useWindowDimensions();
  if (Platform.OS !== 'web' || width < WIDE_MIN_WIDTH) return null;
  return { paddingHorizontal: Math.max(0, Math.round((width - taken - WIDE_COLUMN_WIDTH) / 2)) };
}
