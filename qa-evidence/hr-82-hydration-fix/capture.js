// HR-82 verification: React #418 hydration mismatch on /dashboard notifications
// timestamps (caught in qa-evidence/hr-76-analytics/live/verdict.json — two
// pageerrors on employee dashboard load). Trimmed employee-login variant of the
// HR-76 capture: logs in as an employee who has notification rows, cold-loads
// /dashboard (full SSR + hydration, the path that raised React #418), and asserts:
//   1. the notifications list renders >=1 row (otherwise the error check is vacuous)
//   2. every timestamp matches the deterministic "MMM D, YYYY, HH:mm UTC" format
//   3. zero pageerrors and zero console errors across login + dashboard
// Usage: node capture.js <baseUrl> <employeeEmail> <employeePass> [verdictSuffix]
//   verdictSuffix lets a pre-deploy run save verdict-before.json for fail->pass evidence.
const { chromium } = require("playwright");
const fs = require("fs");
const BASE = process.argv[2];
const EMP = { email: process.argv[3], pass: process.argv[4] };
const SUFFIX = process.argv[5] || "";
const OUTDIR = __dirname;
const results = [];
const errors = [];
// en-US + timeZone:UTC + h23, e.g. "Aug 1, 2026, 15:59 UTC"
const TS_RE = /^[A-Z][a-z]{2} \d{1,2}, \d{4}, \d{2}:\d{2} UTC$/;

function check(name, ok, notes = []) {
  results.push({ name, ok, notes });
  console.log(`${ok ? "PASS" : "FAIL"} ${name} ${notes.join(" | ")}`);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 1000 }, colorScheme: "dark" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`pageerror@${page.url()}: ${e.message.slice(0, 140)}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console@${page.url()}: ${m.text().slice(0, 140)}`); });

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#email", EMP.email);
  await page.fill("#password", EMP.pass);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 25000 });

  // Cold navigation so /dashboard is server-rendered then hydrated — the exact
  // sequence that logged React #418. Then give hydration + the Realtime
  // subscription a few seconds so any late errors surface before we assert.
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  const notifSection = page.locator("section").filter({ has: page.locator("h2", { hasText: /Notifications/i }) });
  await notifSection.waitFor({ timeout: 15000 });
  await page.waitForTimeout(4000);

  const stamps = (await notifSection.locator("li p.font-mono").allInnerTexts()).map((s) => s.trim());
  check("notification rows render", stamps.length >= 1, [`rows=${stamps.length}`]);
  check("timestamps deterministic en-US/UTC", stamps.length >= 1 && stamps.every((s) => TS_RE.test(s)), stamps.slice(0, 3));
  check("zero console/page errors (bug was 2x React #418)", errors.length === 0, errors);

  await page.screenshot({ path: `${OUTDIR}/01-dashboard-notifications${SUFFIX}.png`, fullPage: true });
  await browser.close();

  const summary = { base: BASE, passed: results.filter((r) => r.ok).length, total: results.length, errors, results };
  fs.writeFileSync(`${OUTDIR}/verdict${SUFFIX}.json`, JSON.stringify(summary, null, 2));
  console.log(`\n==== SUMMARY ${summary.passed}/${summary.total} passed, errors=${errors.length} ====`);
  if (errors.length) console.log(errors.join("\n"));
  process.exit(summary.passed === summary.total ? 0 : 2);
})().catch((e) => { console.error("HARNESS_CRASH", e); process.exit(1); });
