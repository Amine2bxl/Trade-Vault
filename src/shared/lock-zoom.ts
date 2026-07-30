/**
 * Prevents iOS pinch-zoom gesture events that bypass the viewport meta tag.
 * touch-action: manipulation in CSS handles Android/modern browsers.
 *
 * iOS Safari ignores `user-scalable=no` since iOS 10, so gesture* events
 * must be cancelled at the event level. touch-action does nothing on iOS <13.
 */
export function lockZoom(): () => void {
  if (typeof window === "undefined") return () => {};
  const stop = (e: Event) => e.preventDefault();
  document.addEventListener("gesturestart", stop, { passive: false });
  document.addEventListener("gesturechange", stop, { passive: false });
  document.addEventListener("gestureend", stop, { passive: false });
  return () => {
    document.removeEventListener("gesturestart", stop);
    document.removeEventListener("gesturechange", stop);
    document.removeEventListener("gestureend", stop);
  };
}
