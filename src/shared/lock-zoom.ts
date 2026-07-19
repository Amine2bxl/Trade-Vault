/**
 * Locks the app into a native-app-like feel: no pinch-zoom, no double-tap
 * zoom, no ctrl/⌘+wheel zoom. The viewport meta already blocks this on
 * Android, but iOS Safari has ignored `user-scalable=no` since iOS 10, so
 * these gestures have to be cancelled at the event level.
 *
 * Returns a cleanup function that removes every listener it installed.
 */
export function lockZoom(): () => void {
  if (typeof window === "undefined") return () => {};

  const stop = (e: Event) => e.preventDefault();

  // iOS pinch-zoom fires proprietary gesture* events on the document.
  document.addEventListener("gesturestart", stop, { passive: false });
  document.addEventListener("gesturechange", stop, { passive: false });
  document.addEventListener("gestureend", stop, { passive: false });

  // iOS double-tap zoom: cancel a second tap that lands within 300ms.
  let lastTouch = 0;
  const onTouchEnd = (e: TouchEvent) => {
    const now = Date.now();
    if (now - lastTouch <= 300) e.preventDefault();
    lastTouch = now;
  };
  document.addEventListener("touchend", onTouchEnd, { passive: false });

  // Desktop ctrl/⌘ + wheel and trackpad pinch map to a wheel event with ctrlKey.
  const onWheel = (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) e.preventDefault();
  };
  window.addEventListener("wheel", onWheel, { passive: false });

  // Desktop ctrl/⌘ +/-/0 keyboard zoom.
  const onKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && ["+", "-", "=", "0"].includes(e.key)) {
      e.preventDefault();
    }
  };
  window.addEventListener("keydown", onKeyDown, { passive: false });

  return () => {
    document.removeEventListener("gesturestart", stop);
    document.removeEventListener("gesturechange", stop);
    document.removeEventListener("gestureend", stop);
    document.removeEventListener("touchend", onTouchEnd);
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("keydown", onKeyDown);
  };
}
