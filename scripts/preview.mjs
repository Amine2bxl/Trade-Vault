// Local production preview.
//
// The deploy build uses nitro's "vercel" preset (.vercel/output/), which has
// no local runner — `vite preview` can't serve it. This script builds a
// node-server bundle instead (same app, runnable) and boots it on :4173.
// Cross-platform on purpose (no VAR=x prefix — Windows cmd chokes on it).
import { spawnSync, spawn } from "node:child_process";

const PORT = process.env.PORT || "4173";

console.log("[preview] building node-server bundle (NITRO_PRESET=node-server)…");
const build = spawnSync("npx", ["vite", "build"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, NITRO_PRESET: "node-server" },
});
if (build.status !== 0) process.exit(build.status ?? 1);

console.log(`[preview] starting server on http://localhost:${PORT}`);
const server = spawn("node", [".output/server/index.mjs"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, PORT },
});
server.on("exit", (code) => process.exit(code ?? 0));
