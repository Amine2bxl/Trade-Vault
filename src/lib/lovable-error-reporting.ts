export function reportLovableError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  console.error("[App Error]", error, {
    source: "react_error_boundary",
    route: window.location.pathname,
    ...context,
  });
}
