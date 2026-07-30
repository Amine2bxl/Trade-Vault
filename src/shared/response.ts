import { SITE_URL } from "./site";

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export function siteUrl(request: Request): string {
  try {
    return new URL(request.headers.get("referer") ?? SITE_URL).origin;
  } catch {
    return SITE_URL;
  }
}
