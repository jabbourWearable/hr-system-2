// HR-72 admin-flow verification against LIVE prod. Signs in as an admin and
// walks every /admin surface, asserting real content (not redirect/404/500).
// Usage: node capture-admin.js <baseUrl> <adminEmail> <adminPass>
const { chromium } = require("playwright");
const BASE = process.argv[2];
const ADMIN = { email: process.argv[3], pass: process.argv[4] };
const OUTDIR = __dirname;
const results = [];

function badMarkers(t) {
  t = t.toLowerCase();
  return ["application error", "internal server error", "this page could not be found", "unhandled runtime error", "client-side exception"].filter((m) => t.includes(m));
}
async function visit(page, name, path) {
  const e = { name, path, ok: false, finalUrl: null, status: null, notes: [] };
  try {
    const r = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    e.status = r ? r.status() : null;
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => e.notes.push("networkidle-timeout"));
    e.finalUrl = page.url().replace(BASE, "");
    const body = await page.locator("body").innerText().catch(() => "");
    const bad = badMarkers(body);
    if (bad.length) e.notes.push("ERROR_MARKERS:" + bad.join("|"));
    if (e.finalUrl !== path && !e.finalUrl.startsWith(path)) e.notes.push("redirected->" + e.finalUrl);
    await page.screenshot({ path: `${OUTDIR}/${name}.png`, fullPage: true }).catch((x) => e.notes.push("shot-fail"));
    // admin surface is healthy only if it stayed on an /admin path with no error
    e.ok = bad.length === 0 && e.finalUrl.startsWith("/admin");
  } catch (x) { e.notes.push("EXCEPTION:" + x.message); }
  results.push(e);
  console.log(`${e.ok ? "PASS" : "FAIL"} ${name} [${e.status}] -> ${e.finalUrl} ${e.notes.join(" ")}`);
}
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 940 }, colorScheme: "dark" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#email", ADMIN.email);
  await page.fill("#password", ADMIN.pass);
  await page.click('button[type="submit"]');
  let loggedIn = true;
  try { await page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 25000 }); }
  catch { loggedIn = false; }
  const body0 = await page.locator("body").innerText().catch(() => "");
  console.log("admin login ->", page.url().replace(BASE, ""), loggedIn ? "" : "FAILED snippet:" + body0.slice(0, 160).replace(/\n/g, " "));
  results.push({ name: "admin-login", ok: loggedIn, path: "/login", notes: loggedIn ? [] : ["LOGIN_FAILED"] });
  if (loggedIn) {
    await visit(page, "adm-01-admin-home", "/admin");
    await visit(page, "adm-02-employees", "/admin/employees");
    await visit(page, "adm-03-attendance", "/admin/attendance");
    await visit(page, "adm-04-leave", "/admin/leave");
    await visit(page, "adm-05-sites", "/admin/sites");
  }
  await browser.close();
  const fs = require("fs");
  const summary = { base: BASE, total: results.length, passed: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).map((r) => ({ name: r.name, notes: r.notes, finalUrl: r.finalUrl })), results };
  fs.writeFileSync(`${OUTDIR}/verdict-admin.json`, JSON.stringify(summary, null, 2));
  console.log("\n==== ADMIN SUMMARY ====");
  console.log(`passed ${summary.passed}/${summary.total}`);
  if (summary.failed.length) console.log("FAILURES:", JSON.stringify(summary.failed, null, 2));
  process.exit(summary.failed.length ? 2 : 0);
})().catch((e) => { console.error("HARNESS_CRASH", e); process.exit(1); });
