// HR-72 FULL E2E regression + mutation flow against the LIVE Vercel deployment,
// run AFTER redeploying HR-68 to production. Beyond the read-only route sweep in
// capture.js, this exercises the real write paths and tests admin surfaces as an
// actual admin:
//   employee: login -> geo check-in -> People Hub (directory/profile/org/kudos)
//             -> attendance history -> submit leave request
//   manager:  login -> leave approvals -> APPROVE the request
//   employee: login -> confirm approval notification
//   admin:    login -> admin dashboard/attendance/leave/employees/sites
// Emits e2e-full.json + full-page dark-mode screenshots.
const fs = require("fs");
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL || "https://hr-system-2-iota.vercel.app";
const PW = "TestPass123!";
const EMP = "hr13.employee@example.com";
const MGR = "hr13.manager@example.com";
const ADMIN = "hr13.admin@example.com";
const GEO = { latitude: 32.0853, longitude: 34.7818 }; // inside HR-30 QA Site geofence
const OUTDIR = __dirname;

const results = [];
function rec(step, ok, detail) {
  results.push({ step, ok, detail: detail || "" });
  console.log(`${ok ? "PASS" : "FAIL"}  ${step}${detail ? " — " + detail : ""}`);
}
const BAD = ["application error", "internal server error", "this page could not be found", "unhandled runtime error", "client-side exception"];
async function pageText(page) { return (await page.locator("body").innerText().catch(() => "")).toLowerCase(); }
async function assertClean(page, step, extra) {
  const t = await pageText(page);
  const hit = BAD.filter((m) => t.includes(m));
  rec(step, hit.length === 0, hit.length ? "ERROR_MARKERS:" + hit.join("|") : (extra || "clean"));
  return hit.length === 0;
}
async function shot(page, name) {
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.screenshot({ path: `${OUTDIR}/${name}.png`, fullPage: true }).catch(() => {});
}
async function ctx(browser) {
  return browser.newContext({ viewport: { width: 1360, height: 940 }, colorScheme: "dark", geolocation: GEO, permissions: ["geolocation"] });
}
async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#email", email);
  await page.fill("#password", PW);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/dashboard`, { timeout: 30000 });
}

(async () => {
  const browser = await chromium.launch();

  // ===== EMPLOYEE =====
  {
    const c = await ctx(browser); const page = await c.newPage();
    try {
      await login(page, EMP); rec("employee/login", true, "/dashboard");
      await assertClean(page, "employee/dashboard-render");
      await shot(page, "v-01-employee-dashboard");

      // geo check-in
      const btn = page.getByRole("button", { name: /Check In|Check Out/ });
      const label = (await btn.textContent())?.trim();
      if (label === "Check In") {
        await btn.click(); await page.waitForTimeout(4000);
        const after = (await page.getByRole("button", { name: /Check In|Check Out/ }).textContent())?.trim();
        rec("attendance/check-in", after === "Check Out", `button -> "${after}"`);
      } else { rec("attendance/check-in", true, `already "${label}"`); }
      await shot(page, "v-02-checked-in");

      // People Hub — the regressed routes
      await page.goto(`${BASE}/dashboard/directory`, { waitUntil: "domcontentloaded" });
      const dir = await page.locator('a[href^="/dashboard/directory/"]').count();
      await assertClean(page, "people/directory-render", `${dir} people`);
      rec("people/directory-populated", dir > 0, `${dir} people links`);
      await shot(page, "v-03-directory");

      await page.locator('a[href^="/dashboard/directory/"]').first().click();
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      await assertClean(page, "people/profile-render", page.url().replace(BASE, ""));
      await shot(page, "v-04-profile");

      await page.goto(`${BASE}/dashboard/org`, { waitUntil: "domcontentloaded" });
      await assertClean(page, "people/org-render");
      await shot(page, "v-05-org");

      await page.goto(`${BASE}/dashboard/kudos`, { waitUntil: "domcontentloaded" });
      await assertClean(page, "people/kudos-render");
      await shot(page, "v-06-kudos");

      await page.goto(`${BASE}/dashboard/attendance`, { waitUntil: "domcontentloaded" });
      await assertClean(page, "attendance/history-render");
      await shot(page, "v-07-attendance-history");

      // submit leave request
      await page.goto(`${BASE}/dashboard/leave`, { waitUntil: "domcontentloaded" });
      await page.fill("#startDate", "2026-09-14");
      await page.fill("#endDate", "2026-09-16");
      await page.selectOption("#leaveType", "vacation");
      await page.fill("#reason", "HR-72 E2E regression verification request");
      await page.click('button[type="submit"]');
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1500);
      const lt = await pageText(page);
      rec("leave/submit", /pending/.test(lt), /pending/.test(lt) ? "pending row present" : "no pending row");
      await shot(page, "v-08-leave-submitted");
      await c.close();
    } catch (e) { rec("employee/flow", false, String(e).slice(0, 200)); await shot(page, "v-ERR-employee"); await c.close(); }
  }

  // ===== MANAGER: approve =====
  {
    const c = await ctx(browser); const page = await c.newPage();
    try {
      await login(page, MGR); rec("manager/login", true, "/dashboard");
      await page.goto(`${BASE}/dashboard/leave/approvals`, { waitUntil: "domcontentloaded" });
      await assertClean(page, "manager/approvals-render");
      await shot(page, "v-09-approvals-before");
      const approve = page.getByRole("button", { name: /^Approve$/ }).first();
      if (await approve.count()) {
        const comment = page.locator('textarea[name="comment"]').first();
        if (await comment.count()) await comment.fill("Approved — HR-72 verification");
        await approve.click();
        await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(2000);
        rec("leave/approve", true, "approve submitted");
      } else { rec("leave/approve", false, "no Approve button (no pending request)"); }
      await shot(page, "v-10-approvals-after");
      await c.close();
    } catch (e) { rec("manager/flow", false, String(e).slice(0, 200)); await shot(page, "v-ERR-manager"); await c.close(); }
  }

  // ===== EMPLOYEE: notification =====
  {
    const c = await ctx(browser); const page = await c.newPage();
    try {
      await login(page, EMP);
      const t = await pageText(page);
      const notif = /approv/.test(t) || /notification/.test(t);
      rec("notifications/approval", notif, notif ? "approval/notification text on dashboard" : "not found");
      await shot(page, "v-11-employee-notifications");
      await c.close();
    } catch (e) { rec("notifications/flow", false, String(e).slice(0, 200)); await c.close(); }
  }

  // ===== ADMIN (as real admin) =====
  {
    const c = await ctx(browser); const page = await c.newPage();
    try {
      await login(page, ADMIN); rec("admin/login", true, "/dashboard");
      for (const [name, path, key] of [
        ["v-12-admin-dashboard", "/admin", "admin/dashboard"],
        ["v-13-admin-attendance", "/admin/attendance", "admin/attendance"],
        ["v-14-admin-leave", "/admin/leave", "admin/leave"],
        ["v-15-admin-employees", "/admin/employees", "admin/employees"],
        ["v-16-admin-sites", "/admin/sites", "admin/sites"],
      ]) {
        await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
        const landed = page.url().replace(BASE, "");
        const onAdmin = landed.startsWith("/admin");
        await assertClean(page, key + "-render", `landed ${landed}`);
        rec(key + "-access", onAdmin, onAdmin ? "admin access granted" : `redirected to ${landed}`);
        await shot(page, name);
      }
      await c.close();
    } catch (e) { rec("admin/flow", false, String(e).slice(0, 200)); await shot(page, "v-ERR-admin"); await c.close(); }
  }

  await browser.close();
  const pass = results.filter((r) => r.ok).length, fail = results.length - pass;
  fs.writeFileSync(`${OUTDIR}/e2e-full.json`, JSON.stringify({ base: BASE, pass, fail, results }, null, 2));
  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  process.exit(fail ? 1 : 0);
})().catch((err) => { console.error("HARNESS_CRASH", err); process.exit(2); });
