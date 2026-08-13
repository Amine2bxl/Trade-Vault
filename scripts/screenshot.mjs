#!/usr/bin/env node
/**
 * Screenshot harness for the design-system PR.
 *
 * Captures the authenticated app at several breakpoints so the PR body can
 * include visual proof of the new tokens, Inter typeface, tabular figures,
 * light theme and dense data surfaces.
 *
 * Usage:
 *   VITE_DEV_URL=http://localhost:8080 \
 *   TV_TEST_EMAIL=... \
 *   TV_TEST_PASSWORD=... \
 *     node scripts/screenshot.mjs
 *
 * The script logs in via the Supabase-backed email/password form, waits for the
 * dashboard to render, then writes PNGs to .github/screenshots/.
 */

import { chromium } from "@playwright/test";
import { mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, ".github", "screenshots");

const URL = process.env.VITE_DEV_URL || "http://localhost:8080";
const EMAIL = process.env.TV_TEST_EMAIL;
const PASSWORD = process.env.TV_TEST_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error("TV_TEST_EMAIL and TV_TEST_PASSWORD are required.");
  process.exit(1);
}

const shots = [
  { name: "dashboard-dark-desktop", path: "/dashboard", w: 1440, h: 900, theme: "dark" },
  { name: "journal-dark-desktop", path: "/journal", w: 1440, h: 900, theme: "dark" },
  { name: "analytics-dark-desktop", path: "/analytics", w: 1440, h: 900, theme: "dark" },
  { name: "overlay-dark-desktop", path: "/dashboard", w: 1440, h: 900, theme: "dark", modal: true },
  { name: "dashboard-light-desktop", path: "/dashboard", w: 1440, h: 900, theme: "light" },
  { name: "dashboard-dark-mobile", path: "/dashboard", w: 380, h: 844, theme: "dark" },
];

async function login(page) {
  await page.goto(`${URL}/login`);
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 15000 });
}

async function capture(browser, { name, path, w, h, theme, modal }) {
  const context = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await context.newPage();

  if (theme === "light") {
    await page.addInitScript(() => document.documentElement.classList.add("light"));
  }

  await login(page);

  if (modal) {
    // Open a trade/add-trade modal so the overlay surface is visible.
    await page.goto(`${URL}${path}`);
    await page.waitForSelector("[data-testid='dashboard-page'], h1", { timeout: 10000 });
    const add = page.getByRole("button", { name: /add trade/i }).first();
    if (await add.isVisible().catch(() => false)) await add.click();
  } else {
    await page.goto(`${URL}${path}`);
  }

  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: false });
  await context.close();
  console.log(`✓ ${name}.png`);
}

(async () => {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  for (const shot of shots) {
    await capture(browser, shot);
  }
  await browser.close();
  console.log(`\nScreenshots written to ${OUT}`);
})();
