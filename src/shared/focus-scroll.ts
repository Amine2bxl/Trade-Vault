/**
 * Ensures a focused element is scrolled into view above the virtual keyboard.
 * Attach to `onFocus` on inputs that might be hidden by the mobile keyboard.
 */
export function scrollInputIntoView(e: FocusEvent): void {
  const target = e.currentTarget as HTMLElement;
  // Small delay lets the keyboard open before measuring the viewport.
  setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
}
